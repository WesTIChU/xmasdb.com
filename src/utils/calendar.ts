import type { Movie } from '../types';

function normalizedTitle(value: string): string {
  return value.trim().replace(/\s+/g, ' ').toLocaleLowerCase();
}

/** Selects one useful, non-duplicate alternative title for the calendar. */
export function getCalendarAlternativeTitle(movie: Pick<Movie, 'title' | 'alternativeTitles'>): string | null {
  const primary = normalizedTitle(movie.title);
  const alternatives = (movie.alternativeTitles || [])
    .filter((entry) => typeof entry.title === 'string' && normalizedTitle(entry.title) !== primary);
  const preferred = alternatives.find((entry) => entry.country.toUpperCase() === 'US') || alternatives[0];
  return preferred?.title.trim() || null;
}
