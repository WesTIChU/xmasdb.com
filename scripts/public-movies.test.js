import test from 'node:test';
import assert from 'node:assert/strict';
import { getPublicMovies } from '../public-movies.js';

test('public movies keeps collection records ahead of Coming Soon duplicates', () => {
  const collection = [{ tmdbId: 10, title: 'Collected' }];
  const upcoming = [
    { tmdbId: 10, title: 'Duplicate upcoming' },
    { tmdbId: 11, title: 'Coming Soon' }
  ];

  assert.deepEqual(getPublicMovies(collection, upcoming), [
    { tmdbId: 10, title: 'Collected', status: 'collection' },
    { tmdbId: 11, title: 'Coming Soon', status: 'upcoming' }
  ]);
});

test('public movies includes Coming Soon-only titles', () => {
  const result = getPublicMovies([], [{ tmdbId: 1594516, title: 'Holiday Ever After' }]);
  assert.equal(result.length, 1);
  assert.equal(result[0].status, 'upcoming');
});
