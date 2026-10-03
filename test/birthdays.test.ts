import assert from 'node:assert/strict';
import { buildHomePayload } from '../src/server/catalogue-api';
import { ageOnBirthday, birthdayDistance, getHomepageBirthdayGroups, isBirthdayToday, parseBirthday } from '../src/utils/birthdays';

const referenceDate = new Date('2026-10-02T12:00:00');
const groups = getHomepageBirthdayGroups(buildHomePayload(referenceDate).birthdays, referenceDate);

assert.ok(groups.today.length > 0, 'October 2 should have birthdays today');
assert.ok(groups.tomorrow.length > 0, 'October 3 should have birthdays tomorrow');
assert.equal(groups.comingUp.length, 5, 'Homepage should show five coming-up birthdays');
assert.ok(groups.comingUp.every((actor) => (birthdayDistance(actor.birthday, referenceDate) ?? 0) > 1));
assert.ok(groups.comingUp.every((actor) => !groups.today.includes(actor) && !groups.tomorrow.includes(actor)));
assert.ok(groups.comingUp.some((actor) => parseBirthday(actor.birthday)?.month === 10 && parseBirthday(actor.birthday)?.day === 4));

const boundaryActors = buildHomePayload(new Date('2026-12-30T12:00:00')).birthdays;
const boundaryGroups = getHomepageBirthdayGroups(boundaryActors, new Date('2026-12-30T12:00:00'));
assert.ok(boundaryGroups.comingUp.length > 0, 'Coming Up should cross the December to January boundary');

assert.equal(ageOnBirthday('1980-10-03', new Date('2026-10-03T12:00:00')), 46, 'Birthday today uses the age just reached');
assert.equal(ageOnBirthday('1980-10-04', new Date('2026-10-03T12:00:00')), 46, 'Birthday tomorrow uses the upcoming birthday age');
assert.equal(ageOnBirthday('1980-12-31', new Date('2026-10-03T12:00:00')), 46, 'Later birthday this year uses the upcoming birthday age');
assert.equal(ageOnBirthday('1980-01-01', new Date('2026-12-31T12:00:00')), 47, 'Next-year birthday crosses the year boundary');
assert.equal(ageOnBirthday('2000-02-29', new Date('2026-02-28T12:00:00')), 26, 'Leap-day birthdays use the upcoming occurrence year');

assert.equal(isBirthdayToday('1980-10-03', new Date('2026-10-03T12:00:00')), true, 'Birthday today shows the indicator');
assert.equal(isBirthdayToday('1980-10-04', new Date('2026-10-03T12:00:00')), false, 'Birthday tomorrow hides the indicator');
assert.equal(isBirthdayToday('1980-10-02', new Date('2026-10-03T12:00:00')), false, 'Birthday yesterday hides the indicator');
assert.equal(isBirthdayToday('2000-02-29', new Date('2028-02-29T12:00:00')), true, 'Leap-day birthday matches on February 29');
assert.equal(isBirthdayToday('2000-02-29', new Date('2026-02-28T12:00:00')), false, 'Leap-day birthday does not match on February 28');

console.log('Homepage birthday grouping regression tests passed.');
