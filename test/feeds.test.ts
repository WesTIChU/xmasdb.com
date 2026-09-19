import assert from 'assert';
import { MOVIES } from '../src/data/movies';
import { getActorByTmdbId } from '../src/data/actors';
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
