import type { Actor, Movie } from '../types';
import { fetchTmdbPerson } from '../utils/tmdb';
import { getTmdbPersonIdForSlug } from '../data/actors';
import { getCreativeCrew, getPersonSlug } from '../utils/creative-crew';
import { cacheLocalImage } from '../utils/local-images';
import { isActorEnriched } from '../utils/person-enrichment';

interface PersonSeed {
  tmdbPersonId: number;
  id: string;
  name: string;
  slug: string;
  profileUrl?: string;
}

export function getNewPeople(movies: Movie[], existingActors: Map<number, Actor>): PersonSeed[] {
  const people = new Map<number, PersonSeed>();
  for (const movie of movies) {
    for (const cast of movie.cast) {
      const tmdbPersonId = cast.tmdbPersonId || getTmdbPersonIdForSlug(cast.slug);
      if (people.has(tmdbPersonId)) continue;
      people.set(tmdbPersonId, {
        tmdbPersonId,
        id: cast.actorId,
        name: cast.name,
        slug: cast.slug,
        profileUrl: cast.profileUrl,
      });
    }
    for (const crew of getCreativeCrew(movie.crew)) {
      if (people.has(crew.id)) continue;
      people.set(crew.id, {
        tmdbPersonId: crew.id,
        id: String(crew.id),
        name: crew.name,
        slug: getPersonSlug(crew.name),
        profileUrl: crew.profileUrl,
      });
    }
  }
  return [...people.values()].filter((person) => !isActorEnriched(existingActors.get(person.tmdbPersonId)));
}

export async function enrichNewCatalogueActors(
  movies: Movie[],
  existingActors: Actor[],
  apiKey: string,
): Promise<Actor[]> {
  const actorsById = new Map(existingActors.map((actor) => [actor.tmdbPersonId, actor]));
  const people = getNewPeople(movies, actorsById);

  let nextIndex = 0;
  const enrichWorker = async () => {
    while (nextIndex < people.length) {
      const person = people[nextIndex++];
      if (!person) return;
      try {
        const existing = actorsById.get(person.tmdbPersonId);
        const fetched = await fetchTmdbPerson(person.tmdbPersonId, apiKey);
        if (!fetched) throw new Error('TMDB returned no person data');
        const profileUrl = await cacheLocalImage(fetched.profileUrl, `/images/people/${person.tmdbPersonId}.webp`);
        const actor: Actor = {
          ...existing,
          id: existing?.id || person.id,
          slug: existing?.slug || person.slug,
          name: fetched.name || existing?.name || person.name,
          tmdbPersonId: person.tmdbPersonId,
          photoUrl: profileUrl || existing?.photoUrl || person.profileUrl,
          profileUrl: profileUrl || existing?.profileUrl || person.profileUrl,
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
           tmdbUpdatedAt: new Date().toISOString(),
           tmdbFetchedAt: new Date().toISOString(),
         };
        actorsById.set(person.tmdbPersonId, actor);
      } catch (error) {
        console.error(`[Actor Enrichment] Failed for ${person.name} (${person.tmdbPersonId}): ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(5, people.length) }, () => enrichWorker()));

  return [...actorsById.values()].sort((left, right) => left.name.localeCompare(right.name));
}
