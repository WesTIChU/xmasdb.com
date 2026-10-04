import assert from 'node:assert/strict';
import { getMovieNetworkPremiereDateKey, getMoviePremiereDateKey } from '../src/utils/catalogue-lifecycle';
import { getCalendarAlternativeTitle } from '../src/utils/calendar';

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

assert.equal(getCalendarAlternativeTitle({ title: 'The Trouble With Mistletoe', alternativeTitles: [{ title: 'the trouble   with mistletoe', country: 'US' }, { title: 'The Trouble With Christmas Mistletoe', country: 'US' }] }), 'The Trouble With Christmas Mistletoe', 'calendar skips duplicate alternatives and keeps one useful US title');
assert.equal(getCalendarAlternativeTitle({ title: 'A Christmas Story', alternativeTitles: [{ title: 'A Christmas Story', country: 'GB' }, { title: 'Un autre titre', country: 'FR' }] }), 'Un autre titre', 'calendar falls back to one non-US useful alternative');
assert.equal(getCalendarAlternativeTitle({ title: 'A Christmas Story', alternativeTitles: [{ title: ' a christmas   story ', country: 'US' }] }), null, 'calendar hides effectively duplicate alternatives');

console.log('Calendar network premiere date tests passed.');
