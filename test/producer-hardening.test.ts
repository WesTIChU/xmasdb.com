import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { addMovie, prepareManagedArtwork } from '../scripts/add-movie';
import { localAssetPath } from '../scripts/import-xmasdb';
import { convertImageToWebp, detectImageMagickExecutable } from '../src/server/image-processing';

const execFileAsync = promisify(execFile);

assert.equal(detectImageMagickExecutable((executable) => { if (executable !== 'magick') throw new Error('missing'); }), 'magick');
assert.equal(detectImageMagickExecutable((executable) => { if (executable !== 'convert') throw new Error('missing'); }), 'convert');

const metadata = { posterUrl: 'https://image.tmdb.org/t/p/w500/poster.jpg', backdropUrl: 'https://image.tmdb.org/t/p/w1280/backdrop.jpg' };
const successful = await prepareManagedArtwork(123, metadata, async (_source, destination) => destination);
assert.equal(successful.posterUrl, '/images/posters/123.jpg');
assert.equal(successful.backdropUrl, '/images/backdrops/123.jpg');

const failed = await prepareManagedArtwork(124, metadata, async () => { throw new Error('R2 unavailable'); });
assert.equal(failed.posterUrl, undefined, 'failed poster publication must not fall back to TMDB');
assert.equal(failed.backdropUrl, undefined, 'failed backdrop publication must not fall back to TMDB');

let persistedMovie: Record<string, unknown> | undefined;
await addMovie({
  tmdbId: 125,
  brandId: 'hallmark',
  status: 'collection',
  apiKey: 'test-key',
  movies: [],
  fetchMovie: async () => ({ title: 'Safe Import', releaseDate: '2026-12-01', ...metadata }),
  ingest: async () => { throw new Error('R2 unavailable'); },
  writeMovies: async (movies) => { persistedMovie = movies[0] as unknown as Record<string, unknown>; },
});
assert.ok(persistedMovie?.posterUrl === undefined || persistedMovie?.posterUrl === '', 'failed add-movie publication must not persist TMDB poster URLs');
assert.equal(persistedMovie?.backdropUrl, undefined, 'failed add-movie publication must not persist TMDB backdrop URLs');

let publishedMovie: Record<string, unknown> | undefined;
await addMovie({
  tmdbId: 126,
  brandId: 'hallmark',
  status: 'collection',
  apiKey: 'test-key',
  movies: [],
  fetchMovie: async () => ({ title: 'Published Import', releaseDate: '2026-12-01', ...metadata }),
  ingest: async (_source, destination) => destination,
  writeMovies: async (movies) => { publishedMovie = movies[0] as unknown as Record<string, unknown>; },
});
assert.equal(publishedMovie?.posterUrl, '/images/posters/126.jpg');
assert.equal(publishedMovie?.backdropUrl, '/images/backdrops/126.jpg');

assert.equal(localAssetPath('/images/people/456.jpg', 'people', 456), '/images/people/456.webp');

const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'xmasdb-webp-'));
const source = path.join(directory, 'source.jpg');
await execFileAsync('magick', ['-size', '2x2', 'xc:red', source]);
await convertImageToWebp(source);
const { stdout } = await execFileAsync('magick', ['identify', '-format', '%m', source]);
assert.equal(stdout.trim(), 'WEBP', 'people conversion must produce genuine WebP bytes');
await fs.rm(directory, { recursive: true, force: true });

console.log('Producer hardening tests passed.');
