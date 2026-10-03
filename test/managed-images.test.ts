import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { ingestManagedImage, publishManagedImageFile, summarizeManagedImagePublication } from '../src/server/managed-images';
import { managedObjectKey, R2StorageError } from '../src/server/r2-storage';
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
