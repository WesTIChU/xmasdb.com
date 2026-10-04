import assert from 'assert';
import { MOVIES } from '../src/data/movies';
import { getMoviePremiereDateKey } from '../src/utils/catalogue-lifecycle';
import { buildRadarrFeed } from '../src/utils/feeds';

const hallmark2026TmdbIds = [
  1772765, 1729134, 1773006, 1773195, 1773382, 1773380, 1773378, 1773374, 1773368, 1773363,
  1773357, 1773353, 1773350, 1773345, 1773340, 1773334, 1773330, 1773329, 1773322, 1773042,
  1773318, 1594516, 1773316, 1773298, 1773293, 1773286, 1602653, 1773280, 1733866, 1773035,
  1773275, 1773270, 1773266, 1773265,
];
const hallmark2026TmdbIdSet = new Set(hallmark2026TmdbIds);

const imported = MOVIES.filter((movie) => hallmark2026TmdbIdSet.has(movie.tmdbId));
assert.strictEqual(imported.length, 34);
assert.ok(imported.every((movie) => movie.brandId === 'hallmark' && movie.status === 'coming-soon' && movie.isComingSoon));
assert.strictEqual(new Set(imported.map((movie) => movie.tmdbId)).size, imported.length);
for (const movie of imported) {
  assert.ok(movie.tmdbId > 0);
  if (movie.premiereDate) assert.strictEqual(getMoviePremiereDateKey(movie), movie.premiereDate.slice(0, 10));
}

const datedMovie = imported.find((movie) => movie.tmdbId === 1773265)!;
const undated = { ...datedMovie, releaseDate: '', premiereDate: undefined, releaseDates: [] };
assert.strictEqual(getMoviePremiereDateKey(undated), null);
assert.ok(!buildRadarrFeed([undated], new Date('2026-12-01T00:00:00Z')).length);

const first = imported.find((movie) => movie.tmdbId === 1772765)!;
const firstPremiere = getMoviePremiereDateKey(first);
assert.ok(firstPremiere);
const firstPremiereTime = Date.parse(`${firstPremiere}T00:00:00Z`);
assert.ok(!buildRadarrFeed([first], new Date(firstPremiereTime - 8 * 24 * 60 * 60 * 1000)).length);
assert.strictEqual(buildRadarrFeed([first], new Date(firstPremiereTime - 7 * 24 * 60 * 60 * 1000)).length, 1);

console.log('Hallmark 2026 catalogue regression tests passed.');
