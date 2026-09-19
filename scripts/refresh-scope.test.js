import test from 'node:test';
import assert from 'node:assert/strict';
import { getRefreshTargets } from './refresh-scope.js';

const collection = [{ tmdbId: 1, title: 'Collection Movie' }];
const upcoming = [{ tmdbId: 2, title: 'Coming Soon Movie' }];

test('refresh scope selects only Coming Soon movies for nightly refreshes', () => {
  const targets = getRefreshTargets(collection, upcoming, { scope: 'coming-soon' });
  assert.deepEqual(targets.map(target => target.movie.tmdbId), [2]);
  assert.equal(targets[0].collection, false);
});

test('refresh scope selects only Collection movies for monthly refreshes', () => {
  const targets = getRefreshTargets(collection, upcoming, { scope: 'collection' });
  assert.deepEqual(targets.map(target => target.movie.tmdbId), [1]);
  assert.equal(targets[0].collection, true);
});

test('refresh scope applies requested ID filtering after selecting the scope', () => {
  const targets = getRefreshTargets(collection, upcoming, {
    scope: 'coming-soon',
    requestedIds: new Set([1])
  });
  assert.deepEqual(targets, []);
});
