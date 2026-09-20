import assert from 'assert';
import { MOVIES } from '../src/data/movies';
import { getMoviePremiereDateKey } from '../src/utils/catalogue-lifecycle';
import { buildRadarrFeed } from '../src/utils/feeds';

const hallmark2026Titles = [
  "'Tis the Season for Setups", 'Holiday Touchdown: A Bears Love Story', 'Mr. & Mrs. Christmas', 'Winter Wonderlanes',
  'Forgotten Holiday', 'What If Christmas', "Who's Coming for Christmas?", 'Adopting St. Nick', 'A Danish Christmas',
  'Merry Memories', 'Holiday Unplugged', 'A Season of Promises', 'My Christmas Cowboy', 'The Nights Before Christmas',
  'Mistletoe and Mimosas', 'Our Holiday Playbook', 'Christmas in Blue Dog Valley', 'Double Booked for the Holidays',
  'Christmas Delivered', 'Return to Santa', 'The Christmas Eve Feast', 'Holiday Ever After: A Disney World Wish Come True',
  'The Most Wonderful Secret', 'Eight Nights for Love', 'Miles to Christmas', 'The Snowflake Effect', 'A Grand Biltmore Christmas',
  'An Angel in My Stocking', 'Christmas in Canterbury', 'Snow Globe Town', 'Noelle Nomads', 'Hearts All Aglow',
  'Barking All the Way', 'Save the Date for Christmas',
];
const hallmark2026TitleSet = new Set(hallmark2026Titles);

const imported = MOVIES.filter((movie) => hallmark2026TitleSet.has(movie.title));
assert.strictEqual(imported.length, 34);
assert.ok(imported.every((movie) => movie.brandId === 'hallmark' && movie.status === 'coming-soon' && movie.isComingSoon));
assert.strictEqual(new Set(imported.map((movie) => movie.tmdbId)).size, imported.length);
for (const movie of imported) {
  assert.ok(movie.tmdbId > 0);
  if (movie.premiereDate) assert.strictEqual(getMoviePremiereDateKey(movie), movie.premiereDate.slice(0, 10));
}

const datedMovie = imported.find((movie) => movie.title === 'Save the Date for Christmas')!;
const undated = { ...datedMovie, releaseDate: '', premiereDate: undefined, releaseDates: [] };
assert.strictEqual(getMoviePremiereDateKey(undated), null);
assert.ok(!buildRadarrFeed([undated], new Date('2026-12-01T00:00:00Z')).length);

const first = imported.find((movie) => movie.title === "'Tis the Season for Setups")!;
const firstPremiere = getMoviePremiereDateKey(first);
assert.ok(firstPremiere);
const firstPremiereTime = Date.parse(`${firstPremiere}T00:00:00Z`);
assert.ok(!buildRadarrFeed([first], new Date(firstPremiereTime - 8 * 24 * 60 * 60 * 1000)).length);
assert.strictEqual(buildRadarrFeed([first], new Date(firstPremiereTime - 7 * 24 * 60 * 60 * 1000)).length, 1);

console.log('Hallmark 2026 catalogue regression tests passed.');
