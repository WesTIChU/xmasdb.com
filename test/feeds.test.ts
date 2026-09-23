import assert from 'assert';
import { MOVIES } from '../src/data/movies';
import { getActorByTmdbId } from '../src/data/actors';
import { buildFeedsMeta } from '../src/server/catalogue-api';
import {
  buildRadarrFeed,
  getRadarrActorFeedJson,
  getRadarrAllFeedJson,
  getRadarrFeedAudit,
  getRadarrNetworkFeedJson,
  getRadarrYearFeedJson,
  isMovieEligibleForRadarr,
} from '../src/utils/feeds';

const referenceDate = new Date('2026-09-19T00:00:00.000Z');
const feedsMetaReferenceDate = new Date('2026-09-23T18:02:29.000Z');
const lifetimeMovie = MOVIES.find((movie) => movie.brandId === 'lifetime' && movie.imdbId);
const hallmarkMovie = MOVIES.find((movie) => movie.brandId === 'hallmark' && movie.imdbId);
const gafMovie = MOVIES.find((movie) => movie.brandId === 'gaf' && movie.imdbId);

assert.ok(lifetimeMovie, 'Lifetime fixture should exist');
assert.ok(hallmarkMovie, 'Hallmark fixture should exist');
assert.ok(gafMovie, 'GAF fixture should exist');

const lifetimeFeed = JSON.parse(getRadarrNetworkFeedJson('lifetime')) as { title: string; imdb_id: string }[];
const allFeed = JSON.parse(getRadarrAllFeedJson()) as { title: string; imdb_id: string }[];
const lifetimeId = lifetimeMovie.imdbId!;

assert.ok(lifetimeFeed.some((item) => item.imdb_id === lifetimeId));
assert.ok(allFeed.some((item) => item.imdb_id === lifetimeId));
assert.ok(!JSON.parse(getRadarrNetworkFeedJson('lifetime')).some((item: { imdb_id: string }) => item.imdb_id === hallmarkMovie.imdbId));
assert.ok(!JSON.parse(getRadarrNetworkFeedJson('lifetime')).some((item: { imdb_id: string }) => item.imdb_id === gafMovie.imdbId));

const missingImdb = { ...lifetimeMovie, imdbId: undefined };
const missingAudit = getRadarrFeedAudit([missingImdb], referenceDate);
assert.strictEqual(missingAudit.withImdb, 0);
assert.deepStrictEqual(missingAudit.missingImdbTitles, [lifetimeMovie.title]);
assert.strictEqual(buildRadarrFeed([missingImdb], referenceDate).length, 0);

const eightDaysAway = { ...lifetimeMovie, releaseDate: '2026-09-27', premiereDate: '2026-09-27', isComingSoon: true };
const sevenDaysAway = { ...lifetimeMovie, releaseDate: '2026-09-26', premiereDate: '2026-09-26', isComingSoon: true };
assert.strictEqual(isMovieEligibleForRadarr(eightDaysAway, referenceDate), false);
assert.strictEqual(isMovieEligibleForRadarr(sevenDaysAway, referenceDate), true);
assert.strictEqual(isMovieEligibleForRadarr({ ...lifetimeMovie, releaseDate: '2020-12-01', isComingSoon: false }, referenceDate), true);

const duplicateFeed = buildRadarrFeed([lifetimeMovie, lifetimeMovie], referenceDate);
assert.strictEqual(duplicateFeed.length, 1);
assert.strictEqual(new Set(duplicateFeed.map((item) => item.imdb_id)).size, duplicateFeed.length);

const beforeGafEligibilityWindow = buildFeedsMeta(feedsMetaReferenceDate);
const afterGafEligibilityWindow = buildFeedsMeta(new Date('2026-11-15T00:00:00.000Z'));
for (const brandId of ['hallmark', 'lifetime', 'gaf', 'uptv']) {
  const expected = buildRadarrFeed(
    MOVIES.filter((movie) => movie.brandId === brandId),
    feedsMetaReferenceDate
  ).length;
  assert.strictEqual(beforeGafEligibilityWindow.counts.brands[brandId], expected);
}
assert.notStrictEqual(
  beforeGafEligibilityWindow.counts.brands.gaf,
  afterGafEligibilityWindow.counts.brands.gaf
);
const dateSensitiveActorId = MOVIES.find((movie) => movie.tmdbId === 1754947)?.cast[0]?.tmdbPersonId;
assert.ok(dateSensitiveActorId, 'Date-sensitive actor fixture should exist');
assert.notStrictEqual(
  beforeGafEligibilityWindow.counts.actors[String(dateSensitiveActorId)],
  afterGafEligibilityWindow.counts.actors[String(dateSensitiveActorId)]
);

const year = lifetimeMovie.year;
const yearFeed = JSON.parse(getRadarrYearFeedJson(year)) as { title: string; imdb_id: string }[];
assert.ok(yearFeed.every((item) => item.title.endsWith(`(${year})`)));

const actorId = lifetimeMovie.cast.find((cast) => cast.tmdbPersonId)?.tmdbPersonId;
assert.ok(actorId, 'Actor fixture should exist');
assert.ok(getActorByTmdbId(actorId));
const actorMovies = MOVIES.filter((movie) => movie.cast.some((cast) => cast.tmdbPersonId === actorId));
const actorFeed = JSON.parse(getRadarrActorFeedJson(actorId) || '[]') as { imdb_id: string }[];
const expectedActorIds = new Set(buildRadarrFeed(actorMovies).map((item) => item.imdb_id));
assert.ok(actorFeed.every((item) => expectedActorIds.has(item.imdb_id)));

console.log('Radarr feed regression tests passed.');
