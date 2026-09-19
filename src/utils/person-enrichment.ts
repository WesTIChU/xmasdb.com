import fs from 'node:fs/promises';
import path from 'node:path';
import { Actor, CastMember, Movie } from '../types';
import { fetchTmdbPerson } from './tmdb';
import { writeFileAtomically } from './atomic-file';
import { cacheLocalImage } from './local-images';

const actorsPath = path.join(process.cwd(), 'src/data/actors.json');

export interface PersonEnrichmentResult {
  total: number;
  updated: number;
  failures: Array<{ tmdbPersonId: number; name: string; message: string }>;
  actor?: Actor;
  actors: Actor[];
}

async function readActors(): Promise<Map<number, Actor>> {
  try {
    const actors = JSON.parse(await fs.readFile(actorsPath, 'utf8')) as Actor[];
    return new Map(actors.filter((actor) => actor.tmdbPersonId).map((actor) => [actor.tmdbPersonId, actor]));
  } catch {
    return new Map();
  }
}

async function cacheProfile(url: string | undefined, tmdbPersonId: number): Promise<string | undefined> {
  return cacheLocalImage(url, `/images/people/${tmdbPersonId}.webp`);
}

function cataloguePeople(movies: Movie[]): Map<number, CastMember> {
  const people = new Map<number, CastMember>();
  for (const movie of movies) {
    for (const cast of movie.cast) {
      if (cast.tmdbPersonId && !people.has(cast.tmdbPersonId)) people.set(cast.tmdbPersonId, cast);
    }
  }
  return people;
}

export async function enrichCataloguePeople(
  movies: Movie[],
  apiKey: string,
  personId?: number,
  onProgress?: (current: number, total: number, person: CastMember) => void
): Promise<PersonEnrichmentResult> {
  const people = cataloguePeople(movies);
  const target = personId ? new Map([[personId, people.get(personId)!]]) : people;
  if (personId && !target.get(personId)) {
    throw new Error(`TMDB person ${personId} is not represented in the local XmasDB catalogue.`);
  }

  const actorsById = await readActors();
  const failures: PersonEnrichmentResult['failures'] = [];
  let updated = 0;
  let current = 0;
  let lastActor: Actor | undefined;

  const entries = [...target.entries()];
  let nextIndex = 0;
  const refreshWorker = async () => {
    while (nextIndex < entries.length) {
      const entry = entries[nextIndex++];
      if (!entry) return;
      const [tmdbPersonId, cast] = entry;
      current++;
      onProgress?.(current, target.size, cast);
      try {
        const existing = actorsById.get(tmdbPersonId);
        const fetched = await fetchTmdbPerson(tmdbPersonId, apiKey);
        if (!fetched) throw new Error('TMDB returned no person data');
        const profileUrl = await cacheProfile(fetched.profileUrl, tmdbPersonId);
        const actor: Actor = {
          id: existing?.id || cast.slug,
          slug: existing?.slug || cast.slug,
          name: fetched.name || existing?.name || cast.name,
          tmdbPersonId,
          photoUrl: profileUrl || existing?.photoUrl || cast.profileUrl,
          profileUrl: profileUrl || existing?.profileUrl || cast.profileUrl,
          birthday: fetched.birthday ?? existing?.birthday ?? cast.birthday,
          deathday: fetched.deathday ?? existing?.deathday ?? cast.deathday,
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
          tmdbUpdatedAt: new Date().toISOString(),
        };
        actorsById.set(tmdbPersonId, actor);
        lastActor = actor;
        updated++;
      } catch (error) {
        failures.push({ tmdbPersonId, name: cast.name, message: error instanceof Error ? error.message : String(error) });
      }
      if (nextIndex < entries.length) await new Promise((resolve) => setTimeout(resolve, 150));
    }
  };
  await Promise.all(Array.from({ length: Math.min(5, entries.length) }, () => refreshWorker()));

  await writeFileAtomically(actorsPath, JSON.stringify([...actorsById.values()].sort((a, b) => a.name.localeCompare(b.name)), null, 2));
  return { total: target.size, updated, failures, actor: lastActor, actors: [...actorsById.values()] };
}
