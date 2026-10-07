import type { Movie } from '../types';
import { getPublicAlternativeTitles } from './search-relevance';

/** Selects one useful, non-duplicate alternative title for the calendar. */
export function getCalendarAlternativeTitle(movie: Pick<Movie, 'title' | 'alternativeTitles'>): string | null {
  return getPublicAlternativeTitles(movie.title, movie.alternativeTitles)[0] || null;
}
