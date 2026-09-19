import test from 'node:test';
import assert from 'node:assert/strict';
import { createSyncPlan, prepareCatalogLists, validateManifest } from './sync-catalog-manifest.js';

const collection = [{ tmdbId: 1 }];
const upcoming = [{ tmdbId: 2 }];

test('manifest validation accepts only unique IDs and allowed statuses', () => {
  const manifest = [
    { tmdbId: 1, status: 'collection' },
    { tmdbId: 2, status: 'coming-soon' },
    { tmdbId: 3, status: 'coming-soon' }
  ];
  assert.doesNotThrow(() => validateManifest(manifest, { movies: collection, upcoming }));
  assert.throws(() => validateManifest([{ tmdbId: 1, status: 'private' }], { movies: collection, upcoming }), /invalid status/);
  assert.throws(() => validateManifest([{ tmdbId: 1, status: 'collection' }, { tmdbId: 1, status: 'collection' }], { movies: collection, upcoming }), /duplicate TMDB ID/);
});

test('manifest planning detects additions and promotions without contacting TMDB', () => {
  const plan = createSyncPlan([
    { tmdbId: 1, status: 'collection' },
    { tmdbId: 2, status: 'collection' },
    { tmdbId: 3, status: 'coming-soon' }
  ], collection, upcoming);
  assert.deepEqual(plan.additions, [{ tmdbId: 3, status: 'coming-soon' }]);
  assert.deepEqual(plan.statusChanges, [{ tmdbId: 2, status: 'collection', from: 'coming-soon' }]);
});

test('Collection wins when the same ID exists in both canonical lists', () => {
  const plan = createSyncPlan([
    { tmdbId: 1, status: 'collection' },
    { tmdbId: 2, status: 'coming-soon' }
  ], [{ tmdbId: 1 }], [{ tmdbId: 1 }, { tmdbId: 2 }]);
  assert.deepEqual(plan.duplicateUpcomingIds, [1]);
});

test('status changes remove the old record before the imported record is appended', () => {
  const plan = createSyncPlan([
    { tmdbId: 1, status: 'collection' },
    { tmdbId: 2, status: 'collection' }
  ], collection, upcoming);
  const prepared = prepareCatalogLists(collection, upcoming, plan);
  assert.deepEqual(prepared.movies, collection);
  assert.deepEqual(prepared.upcoming, []);
});

test('removing TMDB ID 1744203 from the manifest removes its canonical record cleanly', () => {
  const removedMovie = { tmdbId: 1744203, title: 'Removed Movie' };
  const plan = createSyncPlan([{ tmdbId: 1, status: 'collection' }], [removedMovie], []);
  const prepared = prepareCatalogLists([removedMovie], [], plan);

  assert.deepEqual(plan.removedIds, [1744203]);
  assert.deepEqual(prepared.movies, []);
  assert.deepEqual(prepared.upcoming, []);
});
