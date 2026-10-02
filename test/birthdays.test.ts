import assert from 'node:assert/strict';
import { buildHomePayload } from '../src/server/catalogue-api';
import { birthdayDistance, getHomepageBirthdayGroups, parseBirthday } from '../src/utils/birthdays';

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

console.log('Homepage birthday grouping regression tests passed.');
