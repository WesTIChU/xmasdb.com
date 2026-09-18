import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeCollectionMovie, promoteUpcomingToCollection } from '../movie-storage.js';

test('new Collection storage preserves importer-enriched cast records', () => {
  const cast = [{ id: 101, name: 'Actor', character: 'Lead', order: 0, profile_path: '/actor.webp' }];
  const movie = normalizeCollectionMovie({
    title: 'Imported Movie',
    year: 2026,
    tmdbId: 123456,
    originalTitle: 'Imported Movie',
    crew: [],
    videos: []
  }, cast);

  assert.deepEqual(movie.cast, cast.map(person => ({
    ...person,
    birthday: null,
    deathday: null
  })));
  assert.equal(movie.originalTitle, 'Imported Movie');
  assert.equal(movie.status, 'collection');
  assert.equal(movie.castSummary, 'Actor');
});

test('failed Coming Soon promotion leaves the source record untouched', () => {
  const original = { id: 'tmdb-638806', tmdbId: 638806, title: 'Holiday Hearts', videos: [{ key: 'existing' }] };
  const upcoming = [structuredClone(original)];
  let saveCalled = false;

  assert.throws(() => promoteUpcomingToCollection(original.id, null, null, {
    getUpcoming: () => upcoming,
    add: () => { throw new Error('simulated collection write failure'); },
    saveUpcoming: () => { saveCalled = true; }
  }), /simulated collection write failure/);
  assert.deepEqual(upcoming, [original]);
  assert.equal(saveCalled, false);
});

test('successful Coming Soon promotion removes exactly one source record', () => {
  const original = { id: 'tmdb-638806', tmdbId: 638806, title: 'Holiday Hearts' };
  const upcoming = [structuredClone(original), { id: 'tmdb-other', tmdbId: 999, title: 'Other' }];
  let saved;

  promoteUpcomingToCollection(original.id, null, null, {
    getUpcoming: () => upcoming,
    add: movie => ({ count: 1, years: [2019], movie }),
    saveUpcoming: value => { saved = value; return value; }
  });
  assert.deepEqual(saved, [{ id: 'tmdb-other', tmdbId: 999, title: 'Other' }]);
});
