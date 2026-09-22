import assert from 'node:assert/strict';
import type { Actor, Movie } from '../src/types';
import { enrichNewCatalogueActors, getNewPeople } from '../src/server/actor-import';
import { findIncompleteCataloguePeople, isActorEnriched } from '../src/utils/person-enrichment';

function movie(id: string, people: Array<{ id: number; name: string }>): Movie {
  return {
    id,
    slug: id,
    title: id,
    year: 2026,
    brandId: 'gaf',
    releaseDate: '2026-12-01',
    synopsis: '',
    posterUrl: '',
    cast: people.map((person) => ({
      actorId: String(person.id),
      name: person.name,
      character: 'Alex',
      slug: person.name.toLowerCase().replaceAll(' ', '-'),
      tmdbPersonId: person.id,
    })),
    tmdbId: Number(id.replace(/\D/g, '')) || 456,
    status: 'collection',
  };
}

function actor(id: number, name: string, enriched = false): Actor {
  return {
    id: String(id),
    slug: name.toLowerCase().replaceAll(' ', '-'),
    name,
    tmdbPersonId: id,
    ...(enriched ? { tmdbUpdatedAt: 'already-refreshed' } : {}),
  };
}

const originalFetch = globalThis.fetch;
const requests = new Map<number, number>();
const failures = new Set<number>();

globalThis.fetch = (async (input) => {
  const match = String(input).match(/\/person\/(\d+)\?/);
  assert.ok(match, `unexpected TMDB request: ${String(input)}`);
  const id = Number(match![1]);
  requests.set(id, (requests.get(id) || 0) + 1);
  if (failures.has(id)) return new Response('{}', { status: 404 });
  return new Response(JSON.stringify({
    id,
    name: `Person ${id}`,
    birthday: '1980-01-02',
    place_of_birth: 'Toronto, Canada',
    biography: `Biography for ${id}`,
    imdb_id: `nm${id}`,
    gender: 2,
    known_for_department: 'Acting',
    external_ids: { imdb_id: `nm${id}` },
    combined_credits: { cast: [{ id: id * 10 }], crew: [{ id: id * 10 + 1 }] },
  }), { status: 200 });
}) as typeof fetch;

try {
  const movies = [
    movie('movie-1', [{ id: 101, name: 'First Person' }, { id: 102, name: 'Second Person' }]),
    movie('movie-2', [{ id: 101, name: 'First Person' }, { id: 103, name: 'Failed Person' }]),
  ];
  const complete = actor(101, 'First Person', true);
  const incomplete = actor(102, 'Second Person');
  const detected = findIncompleteCataloguePeople(movies, [complete, incomplete]);
  assert.deepEqual(detected.map((person) => person.tmdbPersonId).sort((a, b) => a - b), [102, 103]);
  assert.equal(isActorEnriched(complete), true);
  assert.equal(isActorEnriched(incomplete), false);

  failures.add(103);
  const firstBatch = await enrichNewCatalogueActors(movies, [complete, incomplete], 'tmdb-key');
  assert.equal(requests.get(101) || 0, 0, 'already-complete people should be skipped');
  assert.equal(requests.get(102), 1, 'incomplete people should be fetched once');
  assert.equal(requests.get(103), 1, 'failed people should still be attempted');
  assert.ok(firstBatch.find((candidate) => candidate.tmdbPersonId === 102)?.tmdbUpdatedAt);
  assert.equal(firstBatch.find((candidate) => candidate.tmdbPersonId === 103), undefined, 'failed new people remain retryable');

  failures.clear();
  const secondBatch = await enrichNewCatalogueActors(movies, firstBatch, 'tmdb-key');
  assert.equal(requests.get(102), 1, 'successful people should not be fetched again');
  assert.equal(requests.get(103), 2, 'failed people should be retried');
  assert.ok(secondBatch.find((candidate) => candidate.tmdbPersonId === 103)?.tmdbUpdatedAt);

  const importedPeople = getNewPeople(movies, new Map(secondBatch.map((candidate) => [candidate.tmdbPersonId, candidate])));
  assert.equal(importedPeople.length, 0, 'a successful multi-movie import leaves no seed-only people');
} finally {
  globalThis.fetch = originalFetch;
}

console.log('Actor enrichment detection, batching, retry, and deduplication tests passed.');
