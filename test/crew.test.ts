import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MOVIES } from '../src/data/movies';
import { getActorByTmdbId, getAllActors } from '../src/data/actors';
import { buildActorDetail, buildMovieDetail } from '../src/server/catalogue-api';
import { buildActorSeo } from '../src/utils/seo';
import { getCreativeCrew } from '../src/utils/creative-crew';
import { renderServerContent } from '../src/server/seo';
import { fetchTmdbMovie } from '../src/utils/tmdb';
import { ActorDetail } from '../src/components/ActorDetail';

const sisterSwap = MOVIES.find((movie) => movie.tmdbId === 866665);
assert.ok(sisterSwap, 'Sister Swap: A Hometown Holiday should exist in the catalogue');
const sisterSwapDetail = buildMovieDetail('866665', sisterSwap!.slug);
assert.ok(sisterSwapDetail, 'Sister Swap detail should resolve');
assert.equal(sisterSwapDetail!.movie.directorCredit?.tmdbPersonId, 129952);
assert.deepStrictEqual(
  sisterSwapDetail!.movie.writingCredits.map((credit) => credit.name),
  ['Claire Boyles', 'Erik Patterson', 'Zac Hug', 'Jessica Scott'],
);
assert.ok(sisterSwapDetail!.movie.writingCredits.every((credit) => credit.tmdbPersonId > 0 && credit.slug));

const originalFetch = globalThis.fetch;
globalThis.fetch = (async () => new Response(JSON.stringify({
  id: 999001,
  title: 'Crew Fixture',
  credits: {
    cast: [],
    crew: [
      { id: 1, name: 'Director Fixture', job: 'Director', department: 'Directing', profile_path: '/director.jpg' },
      { id: 2, name: 'Writer Fixture', job: 'Writer', department: 'Writing', profile_path: '/writer.jpg' },
      { id: 2, name: 'Writer Fixture', job: 'Producer', department: 'Production' },
    ],
  },
}), { status: 200 })) as typeof fetch;
try {
  const fetched = await fetchTmdbMovie(999001, 'tmdb-key');
  assert.deepStrictEqual(fetched?.crew?.map((credit) => credit.job), ['Director', 'Writer']);
  assert.equal(fetched?.crew?.[0].profileUrl, 'https://image.tmdb.org/t/p/w500/director.jpg');
} finally {
  globalThis.fetch = originalFetch;
}

const castOnly = getAllActors().find((person) => {
  const detail = buildActorDetail(String(person.tmdbPersonId));
  return Boolean(detail?.actingFilmography.length && !detail.directingFilmography.length && !detail.writingFilmography.length);
});
assert.ok(castOnly, 'A cast-only person should resolve through the shared person model');

const directorOnly = getAllActors().find((person) => {
  const detail = buildActorDetail(String(person.tmdbPersonId));
  return Boolean(detail?.directingFilmography.length && !detail.actingFilmography.length);
});
assert.ok(directorOnly, 'A director-only person should receive an XmasDB person page');

const writerOnly = getAllActors().find((person) => {
  const detail = buildActorDetail(String(person.tmdbPersonId));
  return Boolean(detail?.writingFilmography.length && !detail.actingFilmography.length && !detail.directingFilmography.length);
});
assert.ok(writerOnly, 'A writer-only person should receive an XmasDB person page');

const multipleJobs = MOVIES.flatMap((movie) => getCreativeCrew(movie.crew))
  .reduce((map, member) => map.set(member.id, (map.get(member.id) || new Set()).add(member.job)), new Map<number, Set<string>>());
const multiJobId = [...multipleJobs.entries()].find(([, jobs]) => jobs.size > 1)?.[0];
assert.ok(multiJobId, 'A person with multiple crew jobs should be represented once by TMDB ID');
const multiJobDetail = buildActorDetail(String(multiJobId!));
assert.ok(multiJobDetail?.filmography.some((movie) => (movie.crewJobs?.length || 0) > 1));

const sean = getActorByTmdbId(129952);
assert.ok(sean, 'Sister Swap director should resolve as a shared person');
const seanDetail = buildActorDetail('129952');
assert.ok(seanDetail?.actingFilmography.length, 'A person can retain existing acting credits');
assert.ok(seanDetail?.directingFilmography.length, 'The same person can also have directing credits');
assert.match(JSON.stringify(buildActorSeo(sean!, seanDetail!.filmography).schema) || '', /Director/);
const sisterSwapHtml = renderServerContent(`/movie/866665/${sisterSwap!.slug}/`);
assert.match(sisterSwapHtml, /Sean McNamara/);
assert.match(sisterSwapHtml, /Claire Boyles/);
assert.match(sisterSwapHtml, /\/actor\/129952\/sean-mcnamara\//);
const seanHtml = renderServerContent(`/actor/129952/${sean!.slug}/`);
assert.match(seanHtml, /<h2>Directing<\/h2>/);
assert.match(seanHtml, /Christmas movie filmography/);

const roleFixture = (overrides: Record<string, unknown> = {}) => ({
  id: 'role-fixture',
  slug: 'role-fixture',
  title: 'Role Fixture',
  year: 2024,
  brandId: 'hallmark',
  tmdbId: 999002,
  posterUrl: '',
  releaseDate: '2024-12-01',
  ...overrides,
});
const roleFixtureHtml = renderToStaticMarkup(React.createElement(ActorDetail, {
  actor: { id: 'fixture', slug: 'fixture', name: 'Fixture Person', tmdbPersonId: 999003 },
  filmography: [roleFixture({ character: 'Mason', crewJobs: [] }), roleFixture({ id: 'crew-only', slug: 'crew-only', character: undefined, crewJobs: ['Director'] }), roleFixture({ id: 'both', slug: 'both', character: 'Alex', crewJobs: ['Writer'] }), roleFixture({ id: 'none', slug: 'none', character: undefined, crewJobs: [] })],
  actingFilmography: [roleFixture({ character: 'Mason', crewJobs: [] }), roleFixture({ id: 'both', slug: 'both', character: 'Alex', crewJobs: ['Writer'] })],
  directingFilmography: [roleFixture({ id: 'crew-only', slug: 'crew-only', character: undefined, crewJobs: ['Director'] })],
  writingFilmography: [],
  backdropUrl: null,
  onNavigate: () => undefined,
  onSelectMovie: () => undefined,
}));
assert.match(roleFixtureHtml, /as Mason/);
assert.match(roleFixtureHtml, />Director</);
assert.match(roleFixtureHtml, />Writer</);
assert.doesNotMatch(roleFixtureHtml, /as Mason<\/p>0/);

console.log('Crew ingestion, shared person identity, categorized credits, and Sister Swap regression tests passed.');
