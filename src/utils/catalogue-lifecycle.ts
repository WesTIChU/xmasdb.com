import { Movie } from '../types';

function utcDateKey(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;
}

export function getMoviePremiereDateKey(movie: Movie): string | null {
  if (movie.status?.toLowerCase() === 'coming-soon' && !movie.premiereDate) return null;
  const value = movie.premiereDate || movie.releaseDate;
  if (!value || typeof value !== 'string') return null;
  const dateOnly = value.match(/^\d{4}-\d{2}-\d{2}/)?.[0];
  if (dateOnly && !Number.isNaN(Date.parse(`${dateOnly}T00:00:00Z`))) return dateOnly;
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) return null;
  return utcDateKey(new Date(parsed));
}

export function isMoviePremierePast(movie: Movie, now: Date = new Date()): boolean {
  const premiereDate = getMoviePremiereDateKey(movie);
  return premiereDate !== null && premiereDate < utcDateKey(now);
}

export function isFutureComingSoonMovie(movie: Movie, now: Date = new Date()): boolean {
  const premiereDate = getMoviePremiereDateKey(movie);
  return movie.status?.toLowerCase() === 'coming-soon' && (premiereDate === null || premiereDate >= utcDateKey(now));
}

export function reconcileMovieLifecycle(movie: Movie, now: Date = new Date()): Movie {
  if (movie.status?.toLowerCase() === 'coming-soon' && isMoviePremierePast(movie, now)) {
    return { ...movie, status: 'collection', isComingSoon: false };
  }
  return movie;
}

export function formatMoviePremiereDate(movie: Movie): string | null {
  const dateKey = getMoviePremiereDateKey(movie);
  if (!dateKey) return null;
  const [year, month, day] = dateKey.split('-').map(Number);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${day} ${months[month - 1]} ${year}`;
}
