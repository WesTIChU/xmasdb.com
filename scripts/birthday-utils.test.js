import test from 'node:test';
import assert from 'node:assert/strict';
import { getBirthdayAge, getBirthdayGroups, getBirthdayOccurrence, getPublicActors, isBirthdayToday } from '../birthday-utils.js';

const actor = (id, name, birthday, extra = {}) => ({ id, name, birthday, ...extra });

test('finds one and multiple birthdays today alphabetically', () => {
  const today = new Date(2026, 8, 17);
  const groups = getBirthdayGroups([
    actor(2, 'Zoe', '1980-09-17'), actor(1, 'Amy', '1990-09-17'), actor(3, 'Next', '1985-09-18')
  ], today);
  assert.deepEqual(groups.today.map(item => item.name), ['Amy', 'Zoe']);
  assert.equal(groups.upcoming[0].date.getDate(), 18);
});

test('keeps the section data when nobody has a birthday today and returns seven distinct dates', () => {
  const today = new Date(2026, 8, 17);
  const actors = Array.from({ length: 8 }, (_, index) => actor(index, `Actor ${index}`, `1980-09-${String(18 + index).padStart(2, '0')}`));
  const groups = getBirthdayGroups(actors, today);
  assert.equal(groups.today.length, 0);
  assert.equal(groups.upcoming.length, 7);
});

test('groups shared dates, handles December rollover, and calculates upcoming age', () => {
  const today = new Date(2026, 11, 30);
  const groups = getBirthdayGroups([
    actor(1, 'Zed', '1980-12-31'), actor(2, 'Amy', '1990-12-31'), actor(3, 'January', '2000-01-01')
  ], today);
  assert.deepEqual(groups.upcoming[0].actors.map(item => item.name), ['Amy', 'Zed']);
  assert.equal(groups.upcoming[1].date.getMonth(), 0);
  assert.equal(getBirthdayAge('1980-12-31', 2026), 46);
});

test('handles leap-day birthdays on non-leap years', () => {
  const february = new Date(2025, 1, 28);
  assert.equal(isBirthdayToday('2000-02-29', february), true);
  assert.equal(getBirthdayOccurrence('2000-02-29', new Date(2025, 1, 28)).getFullYear(), 2026);
});

test('public actor counts include Coming Soon and exclude private candidates', () => {
  const collection = [{ tmdbId: 10, cast: [{ id: 1, name: 'Both', birthday: '1980-09-17' }] }];
  const upcoming = [{ tmdbId: 11, cast: [{ id: 1, name: 'Both', birthday: '1980-09-17' }, { id: 2, name: 'Upcoming Only', birthday: '1990-09-18' }] }];
  const castData = { actors: [{ id: 99, name: 'Candidate', birthday: '1970-09-17', movieTmdbIds: [999] }] };
  const result = getPublicActors(collection, upcoming, castData);
  assert.equal(result.find(item => item.id === 1).movieCount, 2);
  assert.equal(result.some(item => item.id === 99), false);
  assert.equal(result.find(item => item.id === 2).profile_path, undefined);
});

test('supports deceased actors without a Turns age label', () => {
  const groups = getBirthdayGroups([actor(1, 'Deceased', '1940-09-17', { deathday: '2020-01-01' })], new Date(2026, 8, 17));
  assert.equal(groups.today[0].deathday, '2020-01-01');
});
