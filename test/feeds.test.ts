import assert from 'assert';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MOVIES } from '../src/data/movies';
import { getActorByTmdbId, getAllActors } from '../src/data/actors';
import { buildFeedsMeta } from '../src/server/catalogue-api';
import { FeedsPage, formatFeedPullCount } from '../src/components/FeedsPage';
import {
  buildRadarrFeed,
  getRadarrActorFeedCount,
  getRadarrActorFeedJson,
  getRadarrAllFeedJson,
  getRadarrFeedAudit,
  getRadarrNetworkFeedJson,
  getRadarrYearFeedJson,
  getRadarrArchiveYear,
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
const afterGafEligibilityWindowDate = new Date('2026-11-15T00:00:00.000Z');
const afterGafEligibilityWindow = buildFeedsMeta(afterGafEligibilityWindowDate);
const actors = getAllActors();
const actorFeedCountsBeforeGafWindow = new Map(actors.map((actor) => [
  actor.tmdbPersonId,
  getRadarrActorFeedCount(actor.tmdbPersonId, feedsMetaReferenceDate),
]));
const actorFeedCountsAfterGafWindow = new Map<number, number>();
const getAfterGafWindowCount = (tmdbPersonId: number): number => {
  const cached = actorFeedCountsAfterGafWindow.get(tmdbPersonId);
  if (cached !== undefined) return cached;
  const count = getRadarrActorFeedCount(tmdbPersonId, afterGafEligibilityWindowDate);
  actorFeedCountsAfterGafWindow.set(tmdbPersonId, count);
  return count;
};
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
const dateSensitiveActor = getAllActors().find((actor) => (
  actorFeedCountsBeforeGafWindow.get(actor.tmdbPersonId)
  !== getAfterGafWindowCount(actor.tmdbPersonId)
));
assert.ok(dateSensitiveActor, 'Date-sensitive actor fixture should exist');
const dateSensitiveActorId = dateSensitiveActor.tmdbPersonId;
assert.notStrictEqual(
  beforeGafEligibilityWindow.counts.actors[String(dateSensitiveActorId)],
  afterGafEligibilityWindow.counts.actors[String(dateSensitiveActorId)]
);
const actorCountMismatches = actors.filter((actor) => (
  beforeGafEligibilityWindow.counts.actors[String(actor.tmdbPersonId)]
  !== actorFeedCountsBeforeGafWindow.get(actor.tmdbPersonId)
));
assert.deepStrictEqual(actorCountMismatches, []);

const year = lifetimeMovie.year;
const yearFeed = JSON.parse(getRadarrYearFeedJson(year)) as { title: string; imdb_id: string }[];
assert.ok(yearFeed.some((item) => item.title.endsWith(`(${year})`)));

const archiveFeedCases = [
  [1191059, 2025, 2023, 'Merry Mystery Christmas (2023)', 'tt29904237'],
  [1175674, 2024, 2023, 'Coupled Up for Christmas (2023)'],
  [1032588, 2023, 2022, 'A Belgian Chocolate Christmas (2022)'],
  [649520, 2022, 2019, "My Best Friend's Christmas (2019)"],
  [1386531, 2025, 2024, 'Jingle All the Way to Love (2024)'],
  [1380983, 2026, 2024, 'Renovation Romance (2024)'],
  [1549507, 2026, 2025, 'Christmas in the Ballroom (2025)'],
] as const;
for (const [tmdbId, archiveYear, releaseYear, expectedTitle, expectedImdbId] of archiveFeedCases) {
  const movie = MOVIES.find((candidate) => candidate.tmdbId === tmdbId)!;
  assert.equal(getRadarrArchiveYear(movie), archiveYear, `${movie.title} should use its network archive year`);
  const archiveFeed = JSON.parse(getRadarrYearFeedJson(archiveYear)) as { title: string; imdb_id: string }[];
  const oldFeed = JSON.parse(getRadarrYearFeedJson(releaseYear)) as { title: string; imdb_id: string }[];
  assert.ok(archiveFeed.some((item) => item.imdb_id === (expectedImdbId || movie.imdbId)), `${movie.title} should be in its archive-year feed`);
  if (archiveYear !== releaseYear) assert.ok(!oldFeed.some((item) => item.imdb_id === movie.imdbId), `${movie.title} should not be in its original-year feed`);
  const entry = archiveFeed.find((item) => item.imdb_id === movie.imdbId);
  assert.equal(entry?.title, expectedTitle, `${movie.title} feed title should retain its original release year`);
}

const actorId = lifetimeMovie.cast.find((cast) => cast.tmdbPersonId)?.tmdbPersonId;
assert.ok(actorId, 'Actor fixture should exist');
assert.ok(getActorByTmdbId(actorId));
const actorMovies = MOVIES.filter((movie) => movie.cast.some((cast) => cast.tmdbPersonId === actorId));
const actorFeed = JSON.parse(getRadarrActorFeedJson(actorId) || '[]') as { imdb_id: string }[];
const expectedActorIds = new Set(buildRadarrFeed(actorMovies).map((item) => item.imdb_id));
assert.ok(actorFeed.every((item) => expectedActorIds.has(item.imdb_id)));

assert.equal(formatFeedPullCount(0), "This feed hasn't been pulled yet.");
assert.equal(formatFeedPullCount(1), 'This feed has been pulled 1 time.');
assert.equal(formatFeedPullCount(12481), 'This feed has been pulled 12,481 times.');
const feedsMarkup = renderToStaticMarkup(React.createElement(FeedsPage, {
  meta: buildFeedsMeta(feedsMetaReferenceDate),
  initialPullTotals: {
    'collection:all': 5832,
    'collection:hallmark': 1,
  },
}));
assert.match(feedsMarkup, /This feed has been pulled 5,832 times\./);
assert.match(feedsMarkup, /This feed has been pulled 1 time\./);
assert.doesNotMatch(feedsMarkup, /5,832 pulls/);

console.log('Radarr feed regression tests passed.');
