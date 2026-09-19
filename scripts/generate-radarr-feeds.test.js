import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  filterRadarrReadyMovies,
  getRadarrActorMovieIds,
  getRadarrEligibleMovies,
  toRadarrEntry
} from './generate-radarr-feeds.js';

const generatorSource = fs.readFileSync(path.join(process.cwd(), 'scripts', 'generate-radarr-feeds.js'), 'utf8');

const collectionMovie = (id, title = 'Collection Movie', year = 2025) => ({
  tmdbId: id,
  title,
  year,
  imdbId: `tt${id}`
});

const comingSoonMovie = (id, title = 'Coming Soon Movie', year = 2026, actorId = 62909) => ({
  tmdbId: id,
  title,
  year,
  imdbId: `tt${id}`,
  cast: [{ id: actorId, name: 'Coming Soon Actor' }]
});

test('combines collection and approved Coming Soon movies, but not candidates', () => {
  const collection = [collectionMovie(1)];
  const comingSoon = [comingSoonMovie(2)];
  const candidate = comingSoonMovie(3, 'Private Candidate');
  const eligible = getRadarrEligibleMovies(collection, comingSoon);

  assert.deepEqual(eligible.map(movie => movie.tmdbId), [1, 2]);
  assert.equal(eligible.some(movie => movie.tmdbId === candidate.tmdbId), false);
});

test('Coming Soon movies participate in year and actor feed inputs', () => {
  const upcoming = comingSoonMovie(2);
  const eligible = getRadarrEligibleMovies([collectionMovie(1)], [upcoming]);
  const yearMovies = eligible.filter(movie => Number(movie.year) === 2026);
  const actorMovies = getRadarrActorMovieIds(eligible, {}, [upcoming], [collectionMovie(1)]).get('62909');

  assert.deepEqual(yearMovies.map(movie => movie.tmdbId), [2]);
  assert.deepEqual([...actorMovies], ['2']);
  assert.equal(getRadarrActorMovieIds(eligible, {}, [upcoming], [collectionMovie(1)]).has('12345'), false);
});

test('TMDB identity deduplicates and collection version wins', () => {
  const collection = [collectionMovie(7, 'Released Title', 2025)];
  const upcoming = [comingSoonMovie(7, 'Upcoming Title', 2026)];
  const eligible = getRadarrEligibleMovies(collection, upcoming);

  assert.equal(eligible.length, 1);
  assert.equal(eligible[0].title, 'Released Title');
  assert.equal(toRadarrEntry(eligible[0]).title, 'Released Title (2025)');
});

test('moving Coming Soon to Collection preserves one Radarr identity and schema', () => {
  const upcoming = comingSoonMovie(8);
  const before = getRadarrEligibleMovies([], [upcoming]);
  const after = getRadarrEligibleMovies([collectionMovie(8, upcoming.title, upcoming.year)], []);

  assert.deepEqual(before.map(movie => movie.tmdbId), after.map(movie => movie.tmdbId));
  assert.deepEqual(Object.keys(toRadarrEntry(upcoming)).sort(), ['imdb_id', 'title']);
});

test('year feed entries are materialized before mapping for Node 20 compatibility', () => {
  assert.match(generatorSource, /\.\.\.\[\.\.\.yearEntries\.entries\(\)\]\.map/);
});

test('Coming Soon movies are withheld before the seven-day Radarr window', () => {
  const movie = { ...comingSoonMovie(1), premiereDate: '2026-12-12' };
  const result = filterRadarrReadyMovies([], [movie], { now: '2026-12-04' });
  assert.deepEqual(result.ready, []);
  assert.equal(result.withheld[0].eligibilityDate, '2026-12-05');
});

test('Coming Soon movies become Radarr-ready exactly seven days before premiere', () => {
  const movie = { ...comingSoonMovie(1), premiereDate: '2026-12-12' };
  const result = filterRadarrReadyMovies([], [movie], { now: '2026-12-05' });
  assert.deepEqual(result.ready.map(item => item.tmdbId), [1]);
  assert.deepEqual(result.withheld, []);
});

test('Coming Soon movies remain Radarr-ready after the eligibility date', () => {
  const movie = { ...comingSoonMovie(1), premiereDate: '2026-12-12' };
  const result = filterRadarrReadyMovies([], [movie], { now: '2026-12-20' });
  assert.deepEqual(result.ready.map(item => item.tmdbId), [1]);
});

test('Coming Soon movies without a valid premiere date are withheld', () => {
  const result = filterRadarrReadyMovies([], [
    { ...comingSoonMovie(1), premiereDate: null },
    { ...comingSoonMovie(2), premiereDate: '2026-02-30' }
  ], { now: '2026-12-20' });
  assert.equal(result.ready.length, 0);
  assert.equal(result.withheld.length, 2);
  assert.equal(result.withheld[0].eligibilityDate, null);
});

test('Collection movies remain included regardless of premiere date', () => {
  const result = filterRadarrReadyMovies([{ ...collectionMovie(1), premiereDate: null }], [], { now: '2026-01-01' });
  assert.deepEqual(result.ready.map(item => item.tmdbId), [1]);
  assert.deepEqual(result.withheld, []);
});
