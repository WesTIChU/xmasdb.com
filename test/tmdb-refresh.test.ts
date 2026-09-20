import assert from 'assert';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { Movie } from '../src/types';
import { mergeTmdbMovie, selectPeopleRefreshMovies } from '../src/utils/tmdb-refresh';
import { cacheLocalImage } from '../src/utils/local-images';

console.log('Running TMDB refresh tests...');

const movie = {
  id: 'movie-1',
  slug: 'movie-1',
  title: 'Movie 1',
  year: 2026,
  brandId: 'hallmark',
  releaseDate: '2026-12-01',
  premiereDate: '2026-12-01',
  synopsis: 'Old synopsis',
  posterUrl: '',
  cast: [],
  tmdbId: 1773368,
  status: 'coming-soon',
  isComingSoon: true,
} satisfies Movie;

const merged = mergeTmdbMovie(movie, {
  releaseDate: '2026-11-01',
  synopsis: '',
  cast: [{ actorId: '2', name: 'New Actor', character: '', slug: 'new-actor', tmdbPersonId: 2 }],
}, '/images/posters/movie-1-new.jpg');
assert.strictEqual(merged.releaseDate, '2026-11-01');
assert.strictEqual(merged.premiereDate, '2026-11-01');
assert.strictEqual(merged.synopsis, 'Old synopsis');
assert.strictEqual(merged.posterUrl, '/images/posters/movie-1-new.jpg');
assert.strictEqual(merged.brandId, 'hallmark');
assert.strictEqual(merged.status, 'coming-soon');
assert.strictEqual(merged.isComingSoon, true);
const unchanged = mergeTmdbMovie(movie, { releaseDate: movie.releaseDate, synopsis: movie.synopsis }, movie.posterUrl);
assert.strictEqual(unchanged, movie, 'unchanged TMDB data does not update the timestamp');

const castMember = (tmdbPersonId: number, name: string) => ({
  actorId: String(tmdbPersonId), name, character: '', slug: name.toLowerCase().replaceAll(' ', '-'), tmdbPersonId,
});
const unrelatedMovie = { ...movie, tmdbId: 10, slug: 'unrelated', title: 'Unrelated', isComingSoon: false, cast: [castMember(100, 'Unrelated Actor')] } satisfies Movie;
const refreshedComingSoonMovie = { ...movie, cast: [castMember(200, 'Known Actor'), castMember(300, 'New Actor')] } satisfies Movie;
const comingSoonPeopleMovies = selectPeopleRefreshMovies([unrelatedMovie, refreshedComingSoonMovie], [refreshedComingSoonMovie], { comingSoonOnly: true });
assert.deepStrictEqual(comingSoonPeopleMovies.map((entry) => entry.tmdbId), [movie.tmdbId]);
assert.deepStrictEqual(
  [...new Set(comingSoonPeopleMovies.flatMap((entry) => entry.cast.map((cast) => cast.tmdbPersonId)))],
  [200, 300],
  'Coming Soon people include newly discovered cast and exclude unrelated movies',
);
const fullPeopleMovies = selectPeopleRefreshMovies([unrelatedMovie, refreshedComingSoonMovie], [refreshedComingSoonMovie], { comingSoonOnly: false });
assert.deepStrictEqual(fullPeopleMovies.map((entry) => entry.tmdbId), [unrelatedMovie.tmdbId, movie.tmdbId], 'Full refresh still checks the complete movie catalogue');

const root = await fs.mkdtemp(path.join(os.tmpdir(), 'xmasdb-refresh-'));
const manifestPath = path.join(root, 'images/.cache-manifest.json');
const originalFetch = globalThis.fetch;
let downloads = 0;
globalThis.fetch = (async () => {
  downloads += 1;
  return new Response(`image-${downloads}`, { status: 200 });
}) as typeof fetch;
try {
  const first = await cacheLocalImage('https://image.tmdb.org/old.jpg', '/images/posters/1773368.jpg', { publicRoot: root, manifestPath });
  const second = await cacheLocalImage('https://image.tmdb.org/new.jpg', '/images/posters/1773368.jpg', { publicRoot: root, manifestPath });
  const third = await cacheLocalImage('https://image.tmdb.org/new.jpg', '/images/posters/1773368.jpg', { publicRoot: root, manifestPath });
  assert.strictEqual(first, '/images/posters/1773368.jpg');
  assert.ok(second && second !== first);
  assert.strictEqual(third, second);
  assert.strictEqual(downloads, 2);
} finally {
  globalThis.fetch = originalFetch;
  await fs.rm(root, { recursive: true, force: true });
}
