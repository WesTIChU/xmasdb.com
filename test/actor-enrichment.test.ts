import assert from 'node:assert/strict';
import type { Actor, Movie } from '../src/types';
import { enrichNewCatalogueActors, getNewPeople } from '../src/server/actor-import';
import { isFullCatalogueRefresh } from '../scripts/refresh-tmdb';
import { actorMetadataChanged, findIncompleteCataloguePeople, isActorEnriched, resolveManagedPersonImage } from '../src/utils/person-enrichment';

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

function actor(id: number, name: string, freshness: 'fresh' | 'old' | 'none' = 'none'): Actor {
  const tmdbFetchedAt = freshness === 'fresh'
    ? new Date().toISOString()
    : freshness === 'old'
      ? '2025-01-01T00:00:00.000Z'
      : undefined;
  return {
    id: String(id),
    slug: name.toLowerCase().replaceAll(' ', '-'),
    name,
    tmdbPersonId: id,
    ...(tmdbFetchedAt ? { tmdbFetchedAt, tmdbUpdatedAt: 'already-refreshed' } : {}),
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
     ...(id >= 200 && id <= 202 ? { profile_path: '/profile.jpg' } : {}),
  }), { status: 200 });
}) as typeof fetch;

try {
  const movies = [
    movie('movie-1', [{ id: 101, name: 'First Person' }, { id: 102, name: 'Second Person' }]),
    movie('movie-2', [{ id: 101, name: 'First Person' }, { id: 103, name: 'Failed Person' }]),
  ];
  const complete = actor(101, 'First Person', 'fresh');
  const incomplete = actor(102, 'Second Person');
  const detected = findIncompleteCataloguePeople(movies, [complete, incomplete]);
  assert.deepEqual(detected.map((person) => person.tmdbPersonId).sort((a, b) => a - b), [102, 103]);
  assert.equal(isActorEnriched(complete), true);
  assert.equal(isActorEnriched(incomplete), false);
  assert.equal(isActorEnriched(actor(9999999, 'Old Person', 'old')), false, 'old actors require refresh');
  assert.equal(isFullCatalogueRefresh({ comingSoonOnly: false, checkOnly: false }), true, 'normal full refresh enables existing actor synchronization');
  assert.equal(isFullCatalogueRefresh({ comingSoonOnly: true, checkOnly: false }), false, 'Coming Soon refresh does not enable existing actor synchronization');
  assert.equal(isFullCatalogueRefresh({ comingSoonOnly: false, requestedId: '1773368', checkOnly: false }), false, 'targeted movie refresh does not enable existing actor synchronization');
  assert.equal(isFullCatalogueRefresh({ comingSoonOnly: false, checkOnly: true }), false, 'authentication check does not enable existing actor synchronization');
  assert.equal(resolveManagedPersonImage(undefined, '/images/people/300.webp'), '/images/people/300.webp');
  assert.equal(resolveManagedPersonImage(undefined, 'https://image.tmdb.org/t/p/w500/300.jpg'), undefined);
  assert.equal(resolveManagedPersonImage('/images/people/301.webp', 'https://image.tmdb.org/t/p/w500/301.jpg'), '/images/people/301.webp');

  const metadataFixture = actor(304, 'Existing Person', 'fresh');
  metadataFixture.notableRoles = 'Locally curated role';
  metadataFixture.biography = 'Existing biography';
  metadataFixture.alsoKnownAs = ['Existing Alias'];
  metadataFixture.instagramId = 'existing-instagram';
  metadataFixture.twitterId = 'existing-twitter';
  metadataFixture.facebookId = 'existing-facebook';
  const unchangedMetadata = { ...metadataFixture, id: 'different-local-id', slug: 'different-local-slug', notableRoles: 'Local-only role', tmdbFetchedAt: 'new-fetch', tmdbUpdatedAt: 'new-update' };
  assert.equal(actorMetadataChanged(metadataFixture, unchangedMetadata), false, 'timestamps and local-only identity fields do not count as TMDB metadata changes');
  assert.equal(actorMetadataChanged(metadataFixture, { ...unchangedMetadata, biography: 'New expanded biography' }), true, 'biography changes are detected');
  assert.equal(actorMetadataChanged(metadataFixture, { ...unchangedMetadata, name: 'Updated Person', alsoKnownAs: ['Updated Alias'], instagramId: 'updated-instagram', twitterId: 'updated-twitter', facebookId: 'updated-facebook' }), true, 'person identity metadata changes are detected');
  assert.equal(metadataFixture.notableRoles, 'Locally curated role', 'locally owned notableRoles remains available when TMDB metadata changes');

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

  const oldActor = actor(9999999, 'Old Person', 'old');
  const refreshedPeople = await enrichNewCatalogueActors([movie('movie-4', [{ id: 9999999, name: 'Old Person' }])], [oldActor], 'tmdb-key');
  assert.equal(requests.get(9999999), 1, 'old actor is refreshed');
  assert.ok(refreshedPeople.find((candidate) => candidate.tmdbPersonId === 9999999)?.tmdbFetchedAt, 'successful actor refresh records fetched timestamp');
  assert.ok(oldActor.tmdbFetchedAt, 'old actor fixture has a prior fetch timestamp');

  const managedExisting = actor(200, 'Managed Existing');
  managedExisting.photoUrl = '/images/people/200.webp';
  managedExisting.profileUrl = '/images/people/200.webp';
  const failureIngestor = async () => { throw new Error('R2 unavailable'); };
  const preserved = await enrichNewCatalogueActors([movie('movie-5', [{ id: 200, name: 'Managed Existing' }])], [managedExisting], 'tmdb-key', failureIngestor);
  assert.equal(preserved.find((candidate) => candidate.tmdbPersonId === 200)?.profileUrl, '/images/people/200.webp');

  const newPerson = await enrichNewCatalogueActors([movie('movie-6', [{ id: 201, name: 'New Person' }])], [], 'tmdb-key', failureIngestor);
  const failedNewPerson = newPerson.find((candidate) => candidate.tmdbPersonId === 201);
  assert.equal(failedNewPerson?.profileUrl, undefined, 'new person with failed publication must not retain a TMDB URL');
  assert.equal(failedNewPerson?.photoUrl, undefined, 'new person with failed publication must not retain a TMDB URL');

  const published = await enrichNewCatalogueActors([movie('movie-7', [{ id: 202, name: 'Published Person' }])], [], 'tmdb-key', async (_source, destination) => destination);
  assert.equal(published.find((candidate) => candidate.tmdbPersonId === 202)?.profileUrl, '/images/people/202.webp');
} finally {
  globalThis.fetch = originalFetch;
}

console.log('Actor enrichment detection, batching, retry, and deduplication tests passed.');
