import type { Actor } from '../types';
import type { ActorFilmographyItem } from '../api/types';
import { MOVIES } from '../data/movies';
import { getTmdbPersonIdForSlug } from '../data/actors';
import { getCreativeCrew } from './creative-crew';

/** Conservative shared test for whether an actor page has useful unique content. */
let actorCreditCounts: Map<number, number> | null = null;

function buildActorCreditCounts(): Map<number, number> {
  const credits = new Map<number, Set<string>>();
  for (const movie of MOVIES) {
    const people = new Set<number>();
    for (const member of movie.cast) people.add(member.tmdbPersonId || getTmdbPersonIdForSlug(member.slug));
    for (const member of getCreativeCrew(movie.crew)) people.add(member.id);
    for (const personId of people) {
      const movies = credits.get(personId) || new Set<string>();
      movies.add(movie.id);
      credits.set(personId, movies);
    }
  }
  return new Map([...credits].map(([personId, movies]) => [personId, movies.size]));
}

export function getActorCreditCount(tmdbPersonId: number): number {
  actorCreditCounts ??= buildActorCreditCounts();
  return actorCreditCounts.get(tmdbPersonId) || 0;
}

export function isActorIndexWorthy(actor: Actor, filmography: { length: number }): boolean {
  if (filmography.length >= 2) return true;
  const biography = actor.biography?.replace(/\s+/g, ' ').trim() || '';
  const wordCount = biography ? biography.split(' ').filter(Boolean).length : 0;
  return filmography.length === 1 && biography.length >= 160 && wordCount >= 25;
}
