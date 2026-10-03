import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { ingestManagedImage, summarizeManagedImagePublication } from '../src/server/managed-images';
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
