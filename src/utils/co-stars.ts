import type { Actor, CastMember, Movie } from '../types';
import { getAllActors } from '../data/actors';
import { MOVIES } from '../data/movies';
import { getTmdbPersonIdForSlug } from '../data/actors';

export interface FrequentCoStar {
  actor: Actor;
  sharedMovieCount: number;
}

function castPersonId(member: CastMember): number {
  return member.tmdbPersonId || getTmdbPersonIdForSlug(member.slug);
}

function movieKey(movie: Movie): string {
  return movie.tmdbId > 0 ? `tmdb:${movie.tmdbId}` : `catalogue:${movie.id}`;
}

export function getFrequentCoStars(
  actor: Pick<Actor, 'tmdbPersonId'>,
  movies: Movie[] = MOVIES,
  actors: Actor[] = getAllActors(),
  minimumSharedMovies = 2,
  limit = 6,
): FrequentCoStar[] {
  const actorIds = new Set<number>([actor.tmdbPersonId]);
  const sharedMovies = new Map<number, Set<string>>();
  const actorsById = new Map(actors.map((candidate) => [candidate.tmdbPersonId, candidate]));

  for (const movie of movies) {
    const actingCast = new Set(movie.cast.map(castPersonId));
    if (![...actorIds].some((actorId) => actingCast.has(actorId))) continue;

    const key = movieKey(movie);
    for (const coStarId of actingCast) {
      if (actorIds.has(coStarId)) continue;
      const movieIds = sharedMovies.get(coStarId) || new Set<string>();
      movieIds.add(key);
      sharedMovies.set(coStarId, movieIds);
    }
  }

  return [...sharedMovies.entries()]
    .map(([tmdbPersonId, movieIds]) => ({ actor: actorsById.get(tmdbPersonId), sharedMovieCount: movieIds.size }))
    .filter((entry): entry is { actor: Actor; sharedMovieCount: number } => Boolean(entry.actor) && entry.sharedMovieCount >= minimumSharedMovies)
    .sort((left, right) => right.sharedMovieCount - left.sharedMovieCount || left.actor.name.localeCompare(right.actor.name) || left.actor.tmdbPersonId - right.actor.tmdbPersonId)
    .slice(0, limit);
}
