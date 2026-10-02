import assert from 'node:assert/strict';
import { getSeasonalLogo, HALLOWEEN_LOGO, NORMAL_LOGO } from '../src/utils/seasonalLogo';

const ukDate = (value: string) => new Date(`${value}Z`);

assert.equal(getSeasonalLogo(ukDate('2026-09-30T22:59:00')), NORMAL_LOGO);
assert.equal(getSeasonalLogo(ukDate('2026-09-30T23:00:00')), HALLOWEEN_LOGO);
assert.equal(getSeasonalLogo(ukDate('2026-10-15T12:00:00')), HALLOWEEN_LOGO);
assert.equal(getSeasonalLogo(ukDate('2026-10-31T23:59:00')), HALLOWEEN_LOGO);
assert.equal(getSeasonalLogo(ukDate('2026-11-01T00:00:00')), NORMAL_LOGO);
assert.equal(getSeasonalLogo(ukDate('2026-12-25T12:00:00')), NORMAL_LOGO);

console.log('seasonal logo tests passed');
