import { Movie } from '../types';

/** Returns the canonical stored poster path, or null when no usable poster is catalogued. */
export function getMoviePoster(movie: Movie): string | null {
  const poster = movie.posterUrl?.trim();
  if (!poster || poster.toLowerCase().includes('placeholder')) return null;
  return poster;
}
