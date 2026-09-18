import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
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
