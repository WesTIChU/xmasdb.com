import assert from 'node:assert/strict';
import { getMovieNetworkPremiereDateKey, getMoviePremiereDateKey } from '../src/utils/catalogue-lifecycle';

const overridden = {
  releaseDate: '2025-11-15',
  premiereDate: '2025-11-15',
  networkPremiereDate: '2026-11-07',
  year: 2025,
  tmdbId: 1,
};

assert.equal(getMovieNetworkPremiereDateKey(overridden), '2026-11-07', 'calendar prefers the network premiere date');
assert.equal(getMoviePremiereDateKey(overridden), '2025-11-15', 'lifecycle date remains the genuine release/premiere date');
assert.equal(overridden.year, 2025, 'network premiere metadata does not change the genuine release year');

const unchanged = { releaseDate: '2025-11-15', premiereDate: '2025-11-15', year: 2025, tmdbId: 2 };
assert.equal(getMovieNetworkPremiereDateKey(unchanged), getMoviePremiereDateKey(unchanged), 'movies without an override behave as before');
assert.equal(getMovieNetworkPremiereDateKey({ releaseDate: '2025-11-15', networkPremiereDate: 'not-a-date' }), '2025-11-15', 'invalid overrides fall back to the normal date');

console.log('Calendar network premiere date tests passed.');
