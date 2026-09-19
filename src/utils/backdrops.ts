import { Movie } from '../types';

export interface ActorBackdrop {
  url: string;
  movie: Movie;
}

/** Selects one stable local backdrop from the actor's XmasDB filmography only. */
export function getActorBackdrop(movies: Movie[], tmdbPersonId: number): ActorBackdrop | null {
  const candidates = movies
    .filter((movie) => movie.backdropUrl?.startsWith('/images/backdrops/'))
    .sort((a, b) => b.year - a.year || b.releaseDate.localeCompare(a.releaseDate) || b.tmdbId - a.tmdbId);
  if (candidates.length === 0) return null;
  const movie = candidates[tmdbPersonId % candidates.length];
  return { url: movie.backdropUrl!, movie };
}
