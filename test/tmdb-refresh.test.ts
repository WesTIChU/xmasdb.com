import assert from 'assert';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { Movie } from '../src/types';
import { normalizeTmdbAlternativeTitles, normalizeTmdbGenres, normalizeTmdbKeywords, resolveTmdbReleaseDate } from '../src/utils/tmdb';
import { mergeTmdbCertification, mergeTmdbMovie, refreshTmdbMovie, selectPeopleRefreshMovies } from '../src/utils/tmdb-refresh';
import { cacheLocalImage, createImageRefreshBudget } from '../src/utils/local-images';

console.log('Running TMDB refresh tests...');

assert.deepStrictEqual(
  normalizeTmdbAlternativeTitles({ titles: [
    { title: 'A Hot Cocoa Christmas', iso_3166_1: 'US' },
    { title: 'a hot cocoa christmas', iso_3166_1: 'GB' },
    { title: 'Much Ado About Christmas', iso_3166_1: 'US' },
  ] }, 'Much Ado About Christmas', 'Much Ado About Christmas'),
  [{ title: 'A Hot Cocoa Christmas', country: 'US' }],
  'TMDB alternative titles are normalized, deduplicated and exclude primary/original titles',
);
assert.equal(resolveTmdbReleaseDate('2011-06-21', [
  { country: 'US', releaseDate: '2010-11-28T00:00:00.000Z', type: 6, note: 'CBS' },
  { country: 'IT', releaseDate: '2011-06-21T00:00:00.000Z', type: 3 },
], [{ id: 10770, name: 'TV Movie' }]), '2010-11-28', 'an earlier US TV premiere beats a later foreign theatrical release');
assert.equal(resolveTmdbReleaseDate('2020-05-01', [{ country: 'US', releaseDate: '2020-05-01T00:00:00.000Z', type: 3 }], [{ id: 18, name: 'Drama' }]), '2020-05-01', 'normal US theatrical releases are preferred');
assert.equal(resolveTmdbReleaseDate('2022-12-15', [
  { country: 'US', releaseDate: '2022-12-15T00:00:00.000Z', type: 4 },
  { country: 'US', releaseDate: '2023-12-01T00:00:00.000Z', type: 6 },
], [{ id: 10770, name: 'TV Movie' }]), '2022-12-15', 'an earlier digital release beats a later US TV premiere');
assert.equal(resolveTmdbReleaseDate('2022-12-15', [
  { country: 'US', releaseDate: '2022-12-15T00:00:00.000Z', type: 4 },
], [{ id: 10770, name: 'TV Movie' }]), '2022-12-15', 'US digital premieres are used when no US TV premiere exists');
assert.equal(resolveTmdbReleaseDate('2024-11-01', [
  { country: 'US', releaseDate: '2026-07-04T00:00:00.000Z', type: 6, note: 'Hallmark Channel' },
], [{ id: 10770, name: 'TV Movie' }]), '2024-11-01', 'a later US network premiere does not replace the original release');
assert.equal(resolveTmdbReleaseDate('2022-01-01', [
  { country: 'US', releaseDate: '2021-01-03T00:00:00.000Z', type: 3 },
  { country: 'US', releaseDate: '2020-12-20T00:00:00.000Z', type: 3 },
], [{ id: 18, name: 'Drama' }]), '2020-12-20', 'the earliest legitimate US theatrical entry wins');
assert.equal(resolveTmdbReleaseDate('2020-06-01', [{ country: 'GB', releaseDate: '2020-05-01T00:00:00.000Z', type: 3 }], [{ id: 18, name: 'Drama' }]), '2020-05-01', 'an earlier legitimate non-US release is not discarded');
assert.equal(resolveTmdbReleaseDate('2020-06-01', undefined, [{ id: 18, name: 'Drama' }]), '2020-06-01', 'primary release date is the safe fallback without release data');
assert.equal(resolveTmdbReleaseDate('not-a-date', [{ country: 'US', releaseDate: 'not-a-date', type: 6 }]), undefined, 'malformed release dates are ignored');
const novemberChristmasReleaseDate = resolveTmdbReleaseDate('2011-06-21', [
  { country: 'US', releaseDate: '2010-11-28T00:00:00.000Z', type: 6, note: 'CBS' },
  { country: 'IT', releaseDate: '2011-06-21T00:00:00.000Z', type: 3 },
], [{ id: 10770, name: 'TV Movie' }]);
assert.equal(novemberChristmasReleaseDate, '2010-11-28', 'TMDB 52688 resolves to its US television premiere');

assert.deepStrictEqual(normalizeTmdbKeywords({ keywords: [
  { id: 10, name: ' christmas ' }, { id: 10, name: 'duplicate' }, { id: 11, name: 'small town' },
] }), [{ id: 10, name: 'christmas' }, { id: 11, name: 'small town' }], 'TMDB keywords are normalized and deduplicated by ID');
assert.deepStrictEqual(normalizeTmdbKeywords(undefined), [], 'movies without TMDB keywords receive an empty collection');
assert.deepStrictEqual(normalizeTmdbGenres([
  { id: 10770, name: ' TV Movie ' }, { id: 10749, name: 'Romance' }, { id: 10770, name: 'Duplicate' },
]), [{ id: 10770, name: 'TV Movie' }, { id: 10749, name: 'Romance' }], 'TMDB genres are normalized, deduplicated by ID, and retain TMDB order');
assert.deepStrictEqual(normalizeTmdbGenres([]), [], 'an explicit empty TMDB genre response becomes an empty genre list');
assert.equal(normalizeTmdbGenres(undefined), undefined, 'missing TMDB genre data remains distinguishable from an explicit empty list');

const confirmedAt = '2026-10-06T00:00:00.000Z';
const certificationG = { value: 'G', country: 'US', source: 'tmdb' as const, lastConfirmedAt: '2026-10-05T00:00:00.000Z' };
assert.deepStrictEqual(mergeTmdbCertification(undefined, [{ country: 'US', releaseDate: '2020-11-27', certification: 'G' }], '2020-11-27', confirmedAt), { ...certificationG, lastConfirmedAt: confirmedAt }, 'TMDB G is stored when no certification exists');
assert.deepStrictEqual(mergeTmdbCertification(certificationG, [{ country: 'US', releaseDate: '2020-11-27', certification: 'G' }], '2020-11-27', confirmedAt), { ...certificationG, lastConfirmedAt: confirmedAt }, 'same TMDB certification is retained and reconfirmed');
assert.deepStrictEqual(mergeTmdbCertification(certificationG, [{ country: 'US', releaseDate: '2020-11-27', certification: 'PG' }], '2020-11-27', confirmedAt), { value: 'PG', country: 'US', source: 'tmdb', lastConfirmedAt: confirmedAt }, 'an explicit TMDB certification correction replaces the old value');
assert.deepStrictEqual(mergeTmdbCertification(certificationG, [{ country: 'US', releaseDate: '2020-11-27', certification: '' }], '2020-11-27', confirmedAt), certificationG, 'an empty certification retains the old value without reconfirming it');
assert.deepStrictEqual(mergeTmdbCertification(certificationG, [{ country: 'GB', releaseDate: '2020-11-27', certification: '12' }], '2020-11-27', confirmedAt), certificationG, 'another country cannot replace the selected country certification');
assert.deepStrictEqual(mergeTmdbCertification(undefined, [
  { country: 'GB', releaseDate: '2020-11-27', certification: '12' },
  { country: 'US', releaseDate: '2020-11-27', certification: 'G' },
], '2020-11-27', confirmedAt), { ...certificationG, lastConfirmedAt: confirmedAt }, 'the US certification for the selected release date is preferred');
assert.deepStrictEqual(mergeTmdbCertification(undefined, [
  { country: 'BR', releaseDate: '2020-11-27', certification: 'L' },
  { country: 'US', releaseDate: '2020-11-27', certification: 'G' },
], '2020-11-27', confirmedAt), { ...certificationG, lastConfirmedAt: confirmedAt }, 'US G is preferred over BR L');
assert.deepStrictEqual(mergeTmdbCertification(undefined, [
  { country: 'CA', releaseDate: '2020-11-27', certification: 'PG' },
  { country: 'US', releaseDate: '2020-11-27', certification: 'PG' },
], '2020-11-27', confirmedAt), { value: 'PG', country: 'US', source: 'tmdb', lastConfirmedAt: confirmedAt }, 'US PG is preferred over foreign classifications');
assert.equal(mergeTmdbCertification(undefined, [
  { country: 'BR', releaseDate: '2020-11-27', certification: 'L' },
  { country: 'GB', releaseDate: '2020-11-27', certification: 'U' },
], '2020-11-27', confirmedAt), undefined, 'foreign certifications do not populate the field without US data');
assert.deepStrictEqual(mergeTmdbCertification(certificationG, [], '2020-11-27', confirmedAt), certificationG, 'an existing US certification survives missing US data without reconfirmation');
assert.deepStrictEqual(mergeTmdbCertification(certificationG, [{ country: 'US', releaseDate: '2020-11-27', certification: 'PG' }], '2020-11-27', confirmedAt), { value: 'PG', country: 'US', source: 'tmdb', lastConfirmedAt: confirmedAt }, 'a changed US certification replaces the old value');
const brazilianCertification = { value: 'L', country: 'BR', source: 'tmdb' as const, lastConfirmedAt: '2026-10-05T00:00:00.000Z' };
assert.deepStrictEqual(mergeTmdbCertification(brazilianCertification, [{ country: 'US', releaseDate: '2020-11-27', certification: 'G' }], '2020-11-27', confirmedAt), { ...certificationG, lastConfirmedAt: confirmedAt }, 'a stored foreign certification is replaced when US data becomes available');
assert.equal(mergeTmdbCertification(brazilianCertification, [{ country: 'GB', releaseDate: '2020-11-27', certification: 'U' }], '2020-11-27', confirmedAt), undefined, 'a stored foreign certification is discarded without US data');

const movie = {
  id: 'movie-1',
  slug: 'movie-1',
  title: 'Movie 1',
  year: 2026,
  brandId: 'hallmark',
  releaseDate: '2026-12-01',
  premiereDate: '2026-12-01',
  networkPremiereDate: '2027-11-06',
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
assert.strictEqual(merged.year, 2026, 'refresh keeps the release year synchronized');
assert.strictEqual(merged.networkPremiereDate, '2027-11-06', 'TMDB refresh preserves XmasDB network premiere metadata');
assert.strictEqual(merged.synopsis, 'Old synopsis');
assert.strictEqual(merged.posterUrl, '/images/posters/movie-1-new.jpg');
assert.strictEqual(merged.brandId, 'hallmark');
assert.strictEqual(merged.status, 'coming-soon');
assert.strictEqual(merged.isComingSoon, true);
const yearShifted = mergeTmdbMovie(movie, { releaseDate: novemberChristmasReleaseDate });
assert.strictEqual(yearShifted.releaseDate, '2010-11-28');
assert.strictEqual(yearShifted.year, 2010, 'a refreshed release date moves the movie year archive');
assert.strictEqual(yearShifted.networkPremiereDate, movie.networkPremiereDate, 'release-date correction leaves network premiere untouched');
const unchanged = mergeTmdbMovie(movie, { releaseDate: movie.releaseDate, synopsis: movie.synopsis }, movie.posterUrl);
assert.notStrictEqual(unchanged, movie, 'successful unchanged TMDB data records a fetch timestamp');
assert.ok(unchanged.tmdbFetchedAt, 'unchanged TMDB data records tmdbFetchedAt');
assert.equal(unchanged.tmdbUpdatedAt, undefined, 'unchanged TMDB data preserves update semantics');

const keywordMovie = { ...movie, keywords: [{ id: 1, name: 'old name' }, { id: 2, name: 'removed' }] } satisfies Movie;
const keywordAdded = mergeTmdbMovie(keywordMovie, { keywords: [{ id: 1, name: 'old name' }, { id: 3, name: 'added' }] });
assert.deepStrictEqual(keywordAdded.keywords, [{ id: 1, name: 'old name' }, { id: 2, name: 'removed' }, { id: 3, name: 'added' }], 'keyword refreshes add new IDs without removing stored keywords');
assert.deepStrictEqual(mergeTmdbMovie({ ...movie, keywords: [] }, { keywords: [{ id: 1, name: 'lawyer' }] }).keywords, [{ id: 1, name: 'lawyer' }], 'new keywords are stored for movies without historical keywords');
assert.deepStrictEqual(mergeTmdbMovie(keywordMovie, { keywords: [{ id: 1, name: 'new name' }] }).keywords, [{ id: 1, name: 'new name' }, { id: 2, name: 'removed' }], 'keyword names update by stable TMDB ID');
assert.deepStrictEqual(mergeTmdbMovie(keywordMovie, { keywords: [] }).keywords, keywordMovie.keywords, 'an empty TMDB keyword response preserves stale keywords');
assert.deepStrictEqual(mergeTmdbMovie(keywordMovie, {}).keywords, keywordMovie.keywords, 'missing TMDB keyword data preserves stale keywords');
assert.deepStrictEqual(mergeTmdbMovie(keywordMovie, { keywords: [{ id: 3, name: 'added' }, { id: 3, name: 'added again' }] }).keywords, [{ id: 1, name: 'old name' }, { id: 2, name: 'removed' }, { id: 3, name: 'added again' }], 'duplicate TMDB IDs produce one stored keyword');
const unchangedKeywords = mergeTmdbMovie(keywordMovie, { keywords: keywordMovie.keywords });
assert.equal(unchangedKeywords.tmdbUpdatedAt, undefined, 'unchanged keywords do not create a metadata update');

const genreMovie = { ...movie, genres: [{ id: 10770, name: 'TV Movie' }, { id: 10749, name: 'Romance' }] } satisfies Movie;
assert.deepStrictEqual(mergeTmdbMovie(genreMovie, { genres: [{ id: 10770, name: 'TV Movie' }, { id: 35, name: 'Comedy' }] }).genres, [{ id: 10770, name: 'TV Movie' }, { id: 35, name: 'Comedy' }], 'TMDB genre refreshes add and remove assignments in TMDB order');
assert.deepStrictEqual(mergeTmdbMovie(genreMovie, { genres: [{ id: 10770, name: 'Television Movie' }] }).genres, [{ id: 10770, name: 'Television Movie' }], 'TMDB genre names update by stable ID');
assert.deepStrictEqual(mergeTmdbMovie(genreMovie, { genres: [] }).genres, [], 'an explicit empty TMDB genre response clears stored genres');

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

const originalMetadataFetch = globalThis.fetch;
const imageMovie = { ...movie, posterUrl: '/images/posters/existing.jpg', backdropUrl: '/images/backdrops/existing.jpg' } satisfies Movie;
let metadataPoster: string | null = null;
let metadataBackdrop: string | null = null;
let metadataUrl = '';
globalThis.fetch = (async (input) => {
  metadataUrl = String(input);
  return new Response(JSON.stringify({
  id: imageMovie.tmdbId,
  title: imageMovie.title,
  release_date: imageMovie.releaseDate,
  overview: imageMovie.synopsis,
  poster_path: metadataPoster,
   backdrop_path: metadataBackdrop,
    genres: [{ id: 10770, name: 'TV Movie' }, { id: 10749, name: 'Romance' }, { id: 10770, name: 'Duplicate' }],
    credits: { cast: [], crew: [] },
   keywords: { keywords: [{ id: 42, name: 'holiday romance' }] },
   alternative_titles: { titles: [{ title: 'An Alternate Movie 1', iso_3166_1: 'US' }] },
  }), { status: 200, headers: { 'content-type': 'application/json' } });
}) as typeof fetch;
try {
  let cacheCalls = 0;
  const cache = async (_url: string | undefined, localPath: string): Promise<string> => {
    cacheCalls++;
    return localPath;
  };
  const optional = await refreshTmdbMovie(imageMovie, 'test-key', cache);
  assert.ok(metadataUrl.includes('append_to_response=credits,videos,release_dates,external_ids,alternative_titles,keywords'), 'keywords are appended to the existing movie request');
  assert.deepEqual(optional.alternativeTitles, [{ title: 'An Alternate Movie 1', country: 'US' }]);
  assert.deepEqual(optional.genres, [{ id: 10770, name: 'TV Movie' }, { id: 10749, name: 'Romance' }], 'TMDB movie import includes normalized genres');
  assert.deepEqual(optional.keywords, [{ id: 42, name: 'holiday romance' }], 'TMDB movie import includes keyword IDs and names');
  assert.equal(cacheCalls, 0, 'missing optional poster/backdrop URLs do not invoke image ingestion');
  assert.equal(optional.posterUrl, imageMovie.posterUrl, 'missing poster preserves existing artwork');
  assert.equal(optional.backdropUrl, imageMovie.backdropUrl, 'missing backdrop preserves existing artwork');

  metadataPoster = '/poster.jpg';
  metadataBackdrop = '/backdrop.jpg';
  const failures: string[] = [];
  const failed = await refreshTmdbMovie(imageMovie, 'test-key', async (_url, localPath) => {
    throw new Error(`failed ${localPath}`);
  }, undefined, (failure) => failures.push(failure.localPath));
  assert.deepEqual(failures, ['/images/posters/1773368.jpg', '/images/backdrops/1773368.jpg']);
  assert.equal(failed.posterUrl, imageMovie.posterUrl, 'failed poster ingestion preserves existing artwork');
  assert.equal(failed.backdropUrl, imageMovie.backdropUrl, 'failed backdrop ingestion preserves existing artwork');
} finally {
  globalThis.fetch = originalMetadataFetch;
}

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
