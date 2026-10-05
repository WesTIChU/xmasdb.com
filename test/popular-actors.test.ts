import assert from 'node:assert/strict';
import { MOVIES } from '../src/data/movies';
import { buildHomePayload, getActorActingFilmographyCount } from '../src/server/catalogue-api';
import { getActorBySlug, getPopularActorsByBrand } from '../src/data/actors';

const lifetimeActors = getPopularActorsByBrand('lifetime', 8);
const corey = lifetimeActors.find(({ actor }) => actor.slug === 'corey-sevier');
assert.ok(corey, 'Corey Sevier should be selected for Lifetime popular actors');
const coreyActingMovies = MOVIES.filter((movie) => movie.cast.some((member) =>
  member.tmdbPersonId === corey!.actor.tmdbPersonId
  || (!member.tmdbPersonId && member.slug === corey!.actor.slug),
));
const distinctCoreyActingMovies = new Set(coreyActingMovies.map((movie) => movie.tmdbId));
const distinctCoreyLifetimeMovies = new Set(coreyActingMovies.filter((movie) => movie.brandId === 'lifetime').map((movie) => movie.tmdbId));
assert.ok(distinctCoreyActingMovies.size > 0, 'Corey Sevier should have acting filmography entries');
assert.equal(corey!.movieCount, distinctCoreyLifetimeMovies.size, 'Lifetime ranking should retain the network-specific count');
assert.equal(getActorActingFilmographyCount(String(corey!.actor.tmdbPersonId)), distinctCoreyActingMovies.size, 'Corey Sevier total acting filmography should match distinct acting credits');

const lifetimeHomepageActors = buildHomePayload(new Date('2026-09-20')).popularActors.find((group) => group.brandId === 'lifetime')?.actors || [];
assert.equal(lifetimeHomepageActors.find((actor) => actor.slug === 'corey-sevier')?.movieCount, distinctCoreyActingMovies.size, 'homepage Lifetime card should display Corey Sevier total acting movies');
const melissa = getActorBySlug('melissa-joan-hart');
assert.ok(melissa, 'Melissa Joan Hart should exist in the actor catalogue');
const melissaActingMovies = MOVIES.filter((movie) => movie.cast.some((member) =>
  member.tmdbPersonId === melissa!.tmdbPersonId
  || (!member.tmdbPersonId && member.slug === melissa!.slug),
));
const distinctMelissaActingMovies = new Set(melissaActingMovies.map((movie) => movie.tmdbId));
assert.ok(melissaActingMovies.some((movie) => movie.brandId === 'lifetime'));
assert.ok(melissaActingMovies.some((movie) => movie.brandId === 'hallmark'));
assert.equal(
  lifetimeHomepageActors.find((actor) => actor.slug === melissa!.slug)?.movieCount,
  distinctMelissaActingMovies.size,
  'homepage Lifetime card should display Melissa Joan Hart total acting movies across networks',
);
assert.equal(getActorActingFilmographyCount(String(melissa!.tmdbPersonId)), distinctMelissaActingMovies.size);

console.log('Popular Christmas Stars total acting counts passed.');
