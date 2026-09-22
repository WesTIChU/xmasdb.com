import assert from 'node:assert/strict';
import type { Movie } from '../src/types';
import { enrichNewCatalogueActors } from '../src/server/actor-import';

const movie = {
  id: 'gaf-2026-new-actor',
  slug: 'new-actor-christmas',
  title: 'New Actor Christmas',
  year: 2026,
  brandId: 'gaf',
  releaseDate: '2026-12-01',
  synopsis: '',
  posterUrl: '',
  cast: [{ actorId: '123', name: 'New Actor', character: 'Alex', slug: 'new-actor', tmdbPersonId: 123 }],
  tmdbId: 456,
  status: 'collection',
} satisfies Movie;

const originalFetch = globalThis.fetch;
let personRequests = 0;
globalThis.fetch = (async (input) => {
  assert.match(String(input), /\/person\/123\?/);
  personRequests += 1;
  return new Response(JSON.stringify({
    id: 123,
    name: 'New Actor',
    birthday: '1980-01-02',
    deathday: null,
    place_of_birth: 'Toronto, Canada',
    biography: 'A full TMDB biography.',
    profile_path: '/new-actor.jpg',
    imdb_id: 'nm1234567',
    known_for_department: 'Acting',
    external_ids: { imdb_id: 'nm1234567' },
    combined_credits: { cast: [{ id: 1 }, { id: 2 }], crew: [{ id: 3 }] },
  }), { status: 200 });
}) as typeof fetch;

try {
  const actors = await enrichNewCatalogueActors([movie], [], 'tmdb-key');
  const actor = actors.find((candidate) => candidate.tmdbPersonId === 123);
  assert.ok(actor);
  assert.equal(actor!.biography, 'A full TMDB biography.');
  assert.equal(actor!.birthday, '1980-01-02');
  assert.equal(actor!.placeOfBirth, 'Toronto, Canada');
  assert.equal(actor!.profileUrl, 'https://image.tmdb.org/t/p/w500/new-actor.jpg');
  assert.equal(actor!.knownCredits, 3);
  assert.ok(actor!.tmdbUpdatedAt);
  assert.equal(personRequests, 1);

  const refreshed = await enrichNewCatalogueActors([movie], [{ ...actor!, tmdbUpdatedAt: 'already-refreshed' }], 'tmdb-key');
  assert.equal(personRequests, 1, 'already enriched actors should not be fetched again');
  assert.equal(refreshed.find((candidate) => candidate.tmdbPersonId === 123)?.biography, actor!.biography);
} finally {
  globalThis.fetch = originalFetch;
}

console.log('New catalogue actor TMDB enrichment tests passed.');
