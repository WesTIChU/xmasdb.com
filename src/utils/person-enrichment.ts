import fs from 'node:fs/promises';
import path from 'node:path';
import { Actor, Movie } from '../types';
import { fetchTmdbPerson } from './tmdb';
import { writeFileAtomically } from './atomic-file';
import { ingestManagedImage } from '../server/managed-images';
import { isManagedCanonicalPath } from '../server/r2-storage';
import { getCreativeCrew, getPersonSlug } from './creative-crew';
import { isTmdbFresh, TMDB_MIGRATION_BATCH_SIZE } from './tmdb-freshness';
import type { ImageRefreshBudget } from './local-images';

const actorsPath = path.join(process.cwd(), 'src/data/actors.json');

export interface PersonEnrichmentResult {
  total: number;
  incomplete: number;
  skipped: number;
  updated: number;
  changed: number;
  failures: Array<{ tmdbPersonId: number; name: string; message: string }>;
  imageFailures: Array<{ tmdbPersonId: number; name: string; message: string }>;
  attemptedIds: number[];
  actor?: Actor;
  actors: Actor[];
}

interface CataloguePersonSeed {
  tmdbPersonId: number;
  name: string;
  slug: string;
  id: string;
  profileUrl?: string;
}

const REFRESHED_ACTOR_FIELDS = [
  'name',
  'photoUrl',
  'profileUrl',
  'birthday',
  'deathday',
  'placeOfBirth',
  'biography',
  'imdbPersonId',
  'gender',
  'knownForDepartment',
  'knownCredits',
  'alsoKnownAs',
  'instagramId',
  'twitterId',
  'facebookId',
] as const satisfies ReadonlyArray<keyof Actor>;

export function actorMetadataChanged(existing: Actor | undefined, refreshed: Actor): boolean {
  if (!existing) return true;
  return REFRESHED_ACTOR_FIELDS.some((field) => JSON.stringify(existing[field]) !== JSON.stringify(refreshed[field]));
}

export function isActorEnriched(actor: Pick<Actor, 'tmdbFetchedAt'> | undefined, now: Date = new Date()): boolean {
  return isTmdbFresh(actor?.tmdbFetchedAt, now);
}

/** Only verified managed images may become canonical person artwork. */
export function resolveManagedPersonImage(published: string | undefined, existing: string | undefined): string | undefined {
  return published || (isManagedCanonicalPath(existing) ? existing : undefined);
}

async function readActors(filePath = actorsPath): Promise<Map<number, Actor>> {
  try {
    const actors = JSON.parse(await fs.readFile(filePath, 'utf8')) as Actor[];
    return new Map(actors.filter((actor) => actor.tmdbPersonId).map((actor) => [actor.tmdbPersonId, actor]));
  } catch {
    return new Map();
  }
}

async function cacheProfile(url: string | undefined, tmdbPersonId: number, imageBudget?: ImageRefreshBudget, imageIngestor: typeof ingestManagedImage = ingestManagedImage): Promise<string | undefined> {
  if (!url) return undefined;
  return imageIngestor(url, `/images/people/${tmdbPersonId}.webp`, { refreshBudget: imageBudget });
}

export function cataloguePeople(movies: Movie[]): Map<number, CataloguePersonSeed> {
  const people = new Map<number, CataloguePersonSeed>();
  for (const movie of movies) {
    for (const cast of movie.cast) {
      if (cast.tmdbPersonId && !people.has(cast.tmdbPersonId)) {
        people.set(cast.tmdbPersonId, {
          tmdbPersonId: cast.tmdbPersonId,
          name: cast.name,
          slug: cast.slug,
          id: cast.actorId,
          profileUrl: cast.profileUrl,
        });
      }
    }
    for (const crew of getCreativeCrew(movie.crew)) {
      if (!people.has(crew.id)) {
        people.set(crew.id, {
          tmdbPersonId: crew.id,
          name: crew.name,
          slug: getPersonSlug(crew.name),
          id: String(crew.id),
          profileUrl: crew.profileUrl,
        });
      }
    }
  }
  return people;
}

export function findIncompleteCataloguePeople(movies: Movie[], existingActors: Map<number, Actor> | Actor[]): CataloguePersonSeed[] {
  const actorsById = existingActors instanceof Map
    ? existingActors
    : new Map(existingActors.map((actor) => [actor.tmdbPersonId, actor]));
  return [...cataloguePeople(movies).entries()]
    .filter(([tmdbPersonId]) => !isActorEnriched(actorsById.get(tmdbPersonId)))
    .map(([, person]) => person);
}

export async function enrichCataloguePeople(
  movies: Movie[],
  apiKey: string,
  personId?: number,
  onProgress?: (current: number, total: number, person: CataloguePersonSeed) => void,
  options: { maxPeople?: number; imageBudget?: ImageRefreshBudget; imageIngestor?: typeof ingestManagedImage; forceRefreshExisting?: boolean; preserveUnchangedTimestamps?: boolean; actorsPath?: string } = {},
): Promise<PersonEnrichmentResult> {
  const people = cataloguePeople(movies);
  const person = personId ? people.get(personId) : undefined;
  if (personId && !person) {
    throw new Error(`TMDB person ${personId} is not represented in the local XmasDB catalogue.`);
  }

  const actorsById = await readActors(options.actorsPath);
  const existingPeople = new Map([...actorsById.values()].map((actor) => [actor.tmdbPersonId, {
    tmdbPersonId: actor.tmdbPersonId,
    name: actor.name,
    slug: actor.slug,
    id: actor.id,
    profileUrl: actor.profileUrl,
  }]));
  const incompletePeople = findIncompleteCataloguePeople(movies, actorsById);
  const candidates = personId
    ? new Map([[personId, person!]])
    : options.forceRefreshExisting
      ? new Map([...existingPeople, ...incompletePeople.filter((entry) => !existingPeople.has(entry.tmdbPersonId)).slice(0, options.maxPeople ?? TMDB_MIGRATION_BATCH_SIZE).map((entry) => [entry.tmdbPersonId, entry] as const)])
      : new Map(incompletePeople.map((entry) => [entry.tmdbPersonId, entry]));
  const maxPeople = options.maxPeople ?? TMDB_MIGRATION_BATCH_SIZE;
  const target = personId
    ? candidates
    : options.forceRefreshExisting
      ? candidates
      : new Map([...candidates.entries()].slice(0, maxPeople));
  const failures: PersonEnrichmentResult['failures'] = [];
  const imageFailures: PersonEnrichmentResult['imageFailures'] = [];
  const attemptedIds: number[] = [];
  let updated = 0;
  let changed = 0;
  let current = 0;
  let lastActor: Actor | undefined;

  const entries = [...target.entries()];
  const total = personId ? 1 : people.size;
  let nextIndex = 0;
  const refreshWorker = async () => {
    while (nextIndex < entries.length) {
      const entry = entries[nextIndex++];
      if (!entry) return;
       const [tmdbPersonId, person] = entry;
       attemptedIds.push(tmdbPersonId);
      current++;
    onProgress?.(current, entries.length, person);
      try {
        const existing = actorsById.get(tmdbPersonId);
        const fetched = await fetchTmdbPerson(tmdbPersonId, apiKey);
        if (!fetched) throw new Error('TMDB returned no person data');
        let profileUrl: string | undefined;
        try {
          profileUrl = await cacheProfile(fetched.profileUrl, tmdbPersonId, options.imageBudget, options.imageIngestor);
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          console.warn(`[Actor Enrichment] Image warning for ${tmdbPersonId}: ${message}`);
          imageFailures.push({ tmdbPersonId, name: person.name, message: `Image ingestion failed: ${message}` });
        }
         const fetchedAt = new Date().toISOString();
         const refreshedActor: Actor = {
           id: existing?.id || person.id,
          slug: existing?.slug || person.slug,
          name: fetched.name || existing?.name || person.name,
          tmdbPersonId,
           photoUrl: resolveManagedPersonImage(profileUrl, existing?.photoUrl),
           profileUrl: resolveManagedPersonImage(profileUrl, existing?.profileUrl),
          birthday: fetched.birthday ?? existing?.birthday,
          deathday: fetched.deathday ?? existing?.deathday,
          placeOfBirth: fetched.placeOfBirth ?? existing?.placeOfBirth,
          biography: fetched.biography ?? existing?.biography,
          imdbPersonId: fetched.imdbPersonId ?? existing?.imdbPersonId,
          gender: fetched.gender ?? existing?.gender,
          knownForDepartment: fetched.knownForDepartment ?? existing?.knownForDepartment,
          knownCredits: fetched.knownCredits ?? existing?.knownCredits,
          alsoKnownAs: fetched.alsoKnownAs?.length ? fetched.alsoKnownAs : existing?.alsoKnownAs,
           instagramId: fetched.instagramId ?? existing?.instagramId,
           twitterId: fetched.twitterId ?? existing?.twitterId,
            facebookId: fetched.facebookId ?? existing?.facebookId,
            notableRoles: existing?.notableRoles,
            tmdbUpdatedAt: fetchedAt,
           tmdbFetchedAt: fetchedAt,
          };
         const metadataChanged = actorMetadataChanged(existing, refreshedActor);
         const shouldWriteActor = !existing || metadataChanged || !options.preserveUnchangedTimestamps;
         const actor: Actor = shouldWriteActor ? refreshedActor : existing!;
         if (shouldWriteActor) {
           actorsById.set(tmdbPersonId, actor);
           changed++;
         }
         lastActor = actor;
         updated++;
      } catch (error) {
        failures.push({ tmdbPersonId, name: person.name, message: error instanceof Error ? error.message : String(error) });
      }
      if (nextIndex < entries.length) await new Promise((resolve) => setTimeout(resolve, 150));
    }
  };
  await Promise.all(Array.from({ length: Math.min(5, entries.length) }, () => refreshWorker()));

  if (changed > 0) {
    await writeFileAtomically(options.actorsPath || actorsPath, JSON.stringify([...actorsById.values()].sort((a, b) => a.name.localeCompare(b.name)), null, 2));
  }
  const considered = personId ? 1 : options.forceRefreshExisting ? target.size : total;
  return {
    total: considered,
    incomplete: entries.length,
    skipped: considered - entries.length,
    updated,
    changed,
    failures,
    imageFailures,
    attemptedIds,
    actor: lastActor,
    actors: [...actorsById.values()],
  };
}
