import assert from 'assert';
import { MOVIES } from '../src/data/movies';
import { getMoviePremiereDateKey } from '../src/utils/catalogue-lifecycle';
import { buildRadarrFeed } from '../src/utils/feeds';

const approvedDates: Record<string, string | null> = {
  "'Tis the Season for Setups": '2026-10-16',
  'Holiday Touchdown: A Bears Love Story': '2026-10-17',
  'Mr. & Mrs. Christmas': '2026-10-18',
  'Winter Wonderlanes': '2026-10-23',
  'Forgotten Holiday': '2026-10-24',
  'What If Christmas': '2026-10-25',
  "Who's Coming for Christmas?": '2026-10-30',
  'Adopting St. Nick': '2026-10-31',
  'A Danish Christmas': '2026-11-01',
  'Merry Memories': '2026-11-06',
  'Holiday Unplugged': '2026-11-07',
  'A Season of Promises': '2026-11-08',
  'My Christmas Cowboy': '2026-11-13',
  'The Nights Before Christmas': '2026-11-14',
  'Mistletoe and Mimosas': '2026-11-15',
  'Our Holiday Playbook': '2026-11-20',
  'Christmas in Blue Dog Valley': '2026-11-21',
  'Double Booked for the Holidays': '2026-11-22',
  'Christmas Delivered': '2026-11-26',
  'Return to Santa': '2026-11-27',
  'The Christmas Eve Feast': '2026-11-27',
  'Holiday Ever After: A Disney World Wish Come True': '2026-11-28',
  'The Most Wonderful Secret': '2026-11-28',
  'Eight Nights for Love': '2026-11-29',
  'Miles to Christmas': '2026-11-29',
  'The Snowflake Effect': '2026-12-04',
  'A Grand Biltmore Christmas': '2026-12-05',
  'An Angel in My Stocking': '2026-12-06',
  'Christmas in Canterbury': '2026-12-11',
  'Snow Globe Town': '2026-12-12',
  'Noelle Nomads': '2026-12-13',
  'Hearts All Aglow': '2026-12-18',
  'Barking All the Way': '2026-12-19',
  'Save the Date for Christmas': null,
};

const imported = MOVIES.filter((movie) => Object.hasOwn(approvedDates, movie.title));
assert.strictEqual(imported.length, 34);
assert.ok(imported.every((movie) => movie.brandId === 'hallmark' && movie.status === 'coming-soon' && movie.isComingSoon));
for (const movie of imported) {
  assert.strictEqual(getMoviePremiereDateKey(movie), approvedDates[movie.title]);
  assert.ok(movie.tmdbId > 0);
}

const undated = imported.find((movie) => movie.title === 'Save the Date for Christmas')!;
assert.strictEqual(undated.premiereDate, undefined);
assert.strictEqual(undated.releaseDate, '');
assert.ok(!buildRadarrFeed([undated], new Date('2026-12-01T00:00:00Z')).length);

const first = imported.find((movie) => movie.title === "'Tis the Season for Setups")!;
assert.ok(!buildRadarrFeed([first], new Date('2026-10-08T00:00:00Z')).length);
assert.strictEqual(buildRadarrFeed([first], new Date('2026-10-09T00:00:00Z')).length, 1);

console.log('Hallmark 2026 catalogue regression tests passed.');
