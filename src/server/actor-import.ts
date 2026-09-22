import type { Actor, Movie } from '../types';
import { fetchTmdbPerson } from '../utils/tmdb';
import { getCreativeCrew, getPersonSlug } from '../utils/creative-crew';

interface PersonSeed {
  tmdbPersonId: number;
  id: string;
  name: string;
  slug: string;
  profileUrl?: string;
}

function getNewPeople(movies: Movie[], existingActors: Map<number, Actor>): PersonSeed[] {
  const people = new Map<number, PersonSeed>();
  for (const movie of movies) {
    for (const cast of movie.cast) {
      if (!cast.tmdbPersonId || people.has(cast.tmdbPersonId)) continue;
      people.set(cast.tmdbPersonId, {
        tmdbPersonId: cast.tmdbPersonId,
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
  return [...people.values()].filter((person) => !existingActors.get(person.tmdbPersonId)?.tmdbUpdatedAt);
}

export async function enrichNewCatalogueActors(
  movies: Movie[],
  existingActors: Actor[],
  apiKey: string,
): Promise<Actor[]> {
  const actorsById = new Map(existingActors.map((actor) => [actor.tmdbPersonId, actor]));
  const people = getNewPeople(movies, actorsById);

  await Promise.all(people.map(async (person) => {
    const existing = actorsById.get(person.tmdbPersonId);
    const fetched = await fetchTmdbPerson(person.tmdbPersonId, apiKey);
    const actor: Actor = {
      ...existing,
      ...(!fetched ? {} : fetched),
      id: existing?.id || person.id,
      slug: existing?.slug || person.slug,
      name: fetched?.name || existing?.name || person.name,
      tmdbPersonId: person.tmdbPersonId,
      photoUrl: fetched?.profileUrl || existing?.photoUrl || person.profileUrl,
      profileUrl: fetched?.profileUrl || existing?.profileUrl || person.profileUrl,
      ...(fetched ? { tmdbUpdatedAt: new Date().toISOString() } : {}),
    };
    actorsById.set(person.tmdbPersonId, actor);
  }));

  return [...actorsById.values()].sort((left, right) => left.name.localeCompare(right.name));
}
