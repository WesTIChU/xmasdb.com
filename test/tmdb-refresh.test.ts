import assert from 'assert';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { Movie } from '../src/types';
import { mergeTmdbMovie, selectPeopleRefreshMovies } from '../src/utils/tmdb-refresh';
import { cacheLocalImage, createImageRefreshBudget } from '../src/utils/local-images';

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
assert.notStrictEqual(unchanged, movie, 'successful unchanged TMDB data records a fetch timestamp');
assert.ok(unchanged.tmdbFetchedAt, 'unchanged TMDB data records tmdbFetchedAt');
assert.equal(unchanged.tmdbUpdatedAt, undefined, 'unchanged TMDB data preserves update semantics');

const castMember = (tmdbPersonId: number, name: string) => ({
  actorId: String(tmdbPersonId), name, character: '', slug: name.toLowerCase().replaceAll(' ', '-'), tmdbPersonId,
});
const unrelatedMovie = { ...movie, tmdbId: 10, slug: 'unrelated', title: 'Unrelated', isComingSoon: false, cast: [castMember(100, 'Unrelated Actor')] } satisfies Movie;
const refreshedComingSoonMovie = {
  ...movie,
  cast: [castMember(200, 'Known Actor'), castMember(300, 'New Actor')],
  crew: [{ id: 400, name: 'New Director', job: 'Director', department: 'Directing', profileUrl: 'https://image.tmdb.org/director.jpg' }],
} satisfies Movie;
const comingSoonPeopleMovies = selectPeopleRefreshMovies([unrelatedMovie, refreshedComingSoonMovie], [refreshedComingSoonMovie], { comingSoonOnly: true });
assert.deepStrictEqual(comingSoonPeopleMovies.map((entry) => entry.tmdbId), [movie.tmdbId]);
assert.deepStrictEqual(
  [...new Set([
    ...comingSoonPeopleMovies.flatMap((entry) => entry.cast.map((cast) => cast.tmdbPersonId)),
    ...comingSoonPeopleMovies.flatMap((entry) => (entry.crew || []).map((crew) => crew.id)),
  ])],
  [200, 300, 400],
  'Coming Soon people include newly discovered cast and creative crew and exclude unrelated movies',
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

  const freshManifestPath = path.join(root, 'images/fresh-manifest.json');
  const freshLocalPath = path.join(root, 'images/posters/fresh.jpg');
  await fs.mkdir(path.dirname(freshLocalPath), { recursive: true });
  await fs.writeFile(freshLocalPath, 'fresh-local');
  await fs.writeFile(freshManifestPath, JSON.stringify({
    '/images/posters/fresh.jpg': { remoteUrl: 'https://image.tmdb.org/fresh.jpg', fetchedAt: new Date().toISOString() },
  }));
  await cacheLocalImage('https://image.tmdb.org/fresh.jpg', '/images/posters/fresh.jpg', { publicRoot: root, manifestPath: freshManifestPath });
  assert.strictEqual(downloads, 2, 'fresh image is reused without downloading');

  const staleManifestPath = path.join(root, 'images/stale-manifest.json');
  const staleLocalPath = path.join(root, 'images/posters/stale.jpg');
  await fs.writeFile(staleLocalPath, 'stale-local');
  await fs.writeFile(staleManifestPath, JSON.stringify({
    '/images/posters/stale.jpg': { remoteUrl: 'https://image.tmdb.org/stale.jpg', fetchedAt: '2025-01-01T00:00:00.000Z' },
  }));
  await cacheLocalImage('https://image.tmdb.org/stale.jpg', '/images/posters/stale.jpg', { publicRoot: root, manifestPath: staleManifestPath, refreshBudget: createImageRefreshBudget(1) });
  assert.strictEqual(downloads, 3, 'stale image is revalidated');

  const legacyManifestPath = path.join(root, 'images/legacy-manifest.json');
  const legacyOne = path.join(root, 'images/posters/legacy-one.jpg');
  const legacyTwo = path.join(root, 'images/posters/legacy-two.jpg');
  await fs.writeFile(legacyOne, 'legacy-one');
  await fs.writeFile(legacyTwo, 'legacy-two');
  await fs.writeFile(legacyManifestPath, JSON.stringify({
    '/images/posters/legacy-one.jpg': 'https://image.tmdb.org/legacy-one.jpg',
    '/images/posters/legacy-two.jpg': 'https://image.tmdb.org/legacy-two.jpg',
  }));
  const legacyBudget = createImageRefreshBudget(1);
  await cacheLocalImage('https://image.tmdb.org/legacy-one.jpg', '/images/posters/legacy-one.jpg', { publicRoot: root, manifestPath: legacyManifestPath, refreshBudget: legacyBudget });
  await cacheLocalImage('https://image.tmdb.org/legacy-two.jpg', '/images/posters/legacy-two.jpg', { publicRoot: root, manifestPath: legacyManifestPath, refreshBudget: legacyBudget });
  assert.strictEqual(downloads, 4, 'legacy image migration is bounded');
} finally {
  globalThis.fetch = originalFetch;
  await fs.rm(root, { recursive: true, force: true });
}

console.log('TMDB metadata, actor freshness, image freshness, and bounded migration tests passed.');
process.exit(0);
