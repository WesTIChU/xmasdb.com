import assert from 'node:assert/strict';
import { buildHomePayload, getActorActingFilmographyCount } from '../src/server/catalogue-api';
import { getPopularActorsByBrand } from '../src/data/actors';

const lifetimeActors = getPopularActorsByBrand('lifetime', 8);
const corey = lifetimeActors.find(({ actor }) => actor.slug === 'corey-sevier');
assert.ok(corey, 'Corey Sevier should be selected for Lifetime popular actors');
assert.equal(corey!.movieCount, 8, 'Lifetime ranking should retain the network-specific count');
assert.equal(getActorActingFilmographyCount(String(corey!.actor.tmdbPersonId)), 14, 'Corey Sevier total acting filmography should be 14');

const lifetimeHomepageActors = buildHomePayload(new Date('2026-09-20')).popularActors.find((group) => group.brandId === 'lifetime')?.actors || [];
assert.equal(lifetimeHomepageActors.find((actor) => actor.slug === 'corey-sevier')?.movieCount, 14, 'homepage Lifetime card should display Corey Sevier total movies');
assert.equal(lifetimeHomepageActors.find((actor) => actor.slug === 'melissa-joan-hart')?.movieCount, 7, 'homepage Lifetime card should display Melissa Joan Hart total movies');

console.log('Popular Christmas Stars total acting counts passed.');
