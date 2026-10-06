import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { ingestManagedImage, publishManagedImageFile, summarizeManagedImagePublication } from '../src/server/managed-images';
import { managedObjectKey, R2Storage, R2StorageError } from '../src/server/r2-storage';
import { mergeTmdbMovie } from '../src/utils/tmdb-refresh';
import type { Movie } from '../src/types';

assert.equal(managedObjectKey('/images/posters/foo.jpg'), 'posters/foo.jpg');
assert.equal(managedObjectKey('/images/backdrops/foo.jpg'), 'backdrops/foo.jpg');
assert.equal(managedObjectKey('/images/people/foo.webp'), 'people/foo.webp');
assert.equal(managedObjectKey('/images/optimized/posters/foo.webp'), 'optimized/posters/foo.webp');
assert.equal(managedObjectKey('/images/optimized/people/foo.webp'), 'optimized/people/foo.webp');
assert.equal(managedObjectKey('/images/birthdays/foo-216.webp'), 'birthdays/foo-216.webp');
assert.throws(() => managedObjectKey('/images/404.png'), R2StorageError);

const root = await fs.mkdtemp(path.join(os.tmpdir(), 'xmasdb-managed-image-'));
const cacheImage = async (_source: string | undefined, localPath: string): Promise<string> => {
  const destination = path.join(root, localPath.replace(/^\//, ''));
  await fs.mkdir(path.dirname(destination), { recursive: true });
  await fs.writeFile(destination, Buffer.from('valid image fixture'));
  return localPath;
};
let uploadedKey = '';
const storage = {
  async ensureUploadedAndVerified(key: string) {
    uploadedKey = key;
    return { remote: { key, size: 18, contentType: 'image/jpeg' }, uploaded: true, verified: true as const };
  },
};
assert.equal(await ingestManagedImage('https://source.test/poster.jpg', '/images/posters/new.jpg', { publicRoot: root, cacheImage, storage }), '/images/posters/new.jpg');
assert.equal(uploadedKey, 'posters/new.jpg');
const birthdayRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'xmasdb-birthday-image-'));
const birthdayRelativePath = 'images/birthdays/134848-216.webp';
const birthdayBytes = Buffer.from('birthday image fixture');
await fs.mkdir(path.join(birthdayRoot, 'images/birthdays'), { recursive: true });
await fs.writeFile(path.join(birthdayRoot, birthdayRelativePath), birthdayBytes);
let attemptedBirthdayUpload = false;
const existingBirthdayStorage = {
  async headObject(key: string) {
    return { key, size: birthdayBytes.byteLength, sha256: createHash('sha256').update(birthdayBytes).digest('hex'), contentType: 'image/webp' };
  },
  async ensureUploadedAndVerified() {
    attemptedBirthdayUpload = true;
    throw new Error('existing birthday object must not be uploaded');
  },
};
const reconciledBirthday = await publishManagedImageFile(`/${birthdayRelativePath}`, '/images/birthdays/134848-216.webp', { publicRoot: birthdayRoot, storage: existingBirthdayStorage, overwriteExisting: false });
assert.deepEqual(reconciledBirthday, { canonicalPath: '/images/birthdays/134848-216.webp', uploaded: false, skipped: true, verified: true }, 'existing R2 birthday object is safely reconciled without upload');
assert.equal(attemptedBirthdayUpload, false, 'existing birthday object is never overwritten');
await assert.rejects(
  publishManagedImageFile(`/${birthdayRelativePath}`, '/images/birthdays/134848-216.webp', {
    publicRoot: birthdayRoot,
    storage: { headObject: async (key: string) => ({ key, size: 1, sha256: 'different', contentType: 'image/webp' }), ensureUploadedAndVerified: async () => { throw new Error('must not upload'); } },
    overwriteExisting: false,
  }),
  /Refusing to overwrite existing object/,
  'mismatched existing birthday object remains protected',
);

const r2 = new R2Storage({ accountId: 'account', accessKeyId: 'key', secretAccessKey: 'secret', bucket: 'bucket' });
const originalFetch = globalThis.fetch;
try {
  let headAttempts = 0;
  globalThis.fetch = (async () => {
    headAttempts += 1;
    return headAttempts === 1
      ? new Response(null, { status: 500 })
      : new Response(null, { status: 200, headers: { 'content-length': '18', 'content-type': 'image/jpeg' } });
  }) as typeof fetch;
  assert.ok(await r2.headObject('people/retry.webp'));
  assert.equal(headAttempts, 2, 'transient R2 HEAD failures should retry');

  let networkAttempts = 0;
  globalThis.fetch = (async () => {
    networkAttempts += 1;
    if (networkAttempts === 1) throw new Error('ECONNRESET');
    return new Response(null, { status: 200, headers: { 'content-length': '18', 'content-type': 'image/jpeg' } });
  }) as typeof fetch;
  assert.ok(await r2.headObject('people/network-retry.webp'));
  assert.equal(networkAttempts, 2, 'transient network failures should retry');

  let exhaustedAttempts = 0;
  globalThis.fetch = (async () => {
    exhaustedAttempts += 1;
    return new Response(null, { status: 500 });
  }) as typeof fetch;
  await assert.rejects(r2.headObject('people/exhausted.webp'), /HEAD failed: HTTP 500/);
  assert.equal(exhaustedAttempts, 3, 'R2 retries should be bounded');

  const body = Buffer.from('r2 retry body');
  const bodyHash = createHash('sha256').update(body).digest('hex');
  let requestIndex = 0;
  globalThis.fetch = (async () => {
    requestIndex += 1;
    if (requestIndex === 1) return new Response(null, { status: 404 });
    if (requestIndex === 2) return new Response(null, { status: 500 });
    if (requestIndex === 3) return new Response(null, { status: 200 });
    return new Response(null, { status: 200, headers: { 'content-length': String(body.byteLength), 'content-type': 'image/webp', 'x-amz-meta-sha256': bodyHash } });
  }) as typeof fetch;
  const retriedUpload = await r2.ensureUploadedAndVerified('people/upload-retry.webp', body, 'image/webp');
  assert.equal(retriedUpload.uploaded, true, 'transient R2 PUT failure should retry and succeed');
  assert.equal(requestIndex, 4, 'R2 PUT retry should be bounded and followed by verification');
} finally {
  globalThis.fetch = originalFetch;
}
assert.deepEqual(summarizeManagedImagePublication([
  { canonicalPath: '/images/optimized/posters/new-1.webp', uploaded: true, skipped: false, verified: true },
  { canonicalPath: '/images/optimized/posters/new-2.webp', uploaded: false, skipped: true, verified: true },
]), { uploaded: 1, skipped: 1, verified: 2 });

await assert.rejects(
  ingestManagedImage('https://source.test/poster.jpg', '/images/posters/failed.jpg', {
    publicRoot: root,
    cacheImage,
    storage: { ensureUploadedAndVerified: async () => { throw new Error('mock R2 upload failure'); } },
  }),
  /R2 publication failed/,
);

const movie: Movie = {
  id: 'movie', slug: 'movie', title: 'Movie', year: 2026, brandId: 'hallmark', releaseDate: '2026-12-01', synopsis: '', posterUrl: '/images/posters/previous.jpg',
  cast: [], tmdbId: 1, status: 'collection',
};
assert.equal(mergeTmdbMovie(movie, { title: 'Updated' }, undefined, undefined).posterUrl, '/images/posters/previous.jpg');
console.log('Managed image ingestion and R2 key tests passed.');
