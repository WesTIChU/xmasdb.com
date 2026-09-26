import { Movie } from '../types';

/** Minimal lifecycle fields shared by full movies and lightweight listing records. */
export interface MovieLifecycleFields {
  status?: string;
  premiereDate?: string;
  releaseDate?: string;
}

export interface SortableMovieLifecycleFields extends MovieLifecycleFields {
  tmdbId: number;
}

function utcDateKey(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;
}

export interface CalendarWeekDateKeys {
  startDateKey: string;
  endDateKey: string;
}

/** Returns the current Monday–Sunday week using UTC calendar dates. */
export function getCalendarWeekDateKeys(now: Date = new Date()): CalendarWeekDateKeys {
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const daysFromMonday = (start.getUTCDay() + 6) % 7;
  start.setUTCDate(start.getUTCDate() - daysFromMonday);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 6);
  return { startDateKey: utcDateKey(start), endDateKey: utcDateKey(end) };
}

/** Matches a movie date's month/day against a Monday–Sunday calendar week. */
export function isDateKeyInCalendarWeek(dateKey: string, week: CalendarWeekDateKeys): boolean {
  const monthDay = dateKey.slice(5);
  const startMonthDay = week.startDateKey.slice(5);
  const endMonthDay = week.endDateKey.slice(5);
  return startMonthDay <= endMonthDay
    ? monthDay >= startMonthDay && monthDay <= endMonthDay
    : monthDay >= startMonthDay || monthDay <= endMonthDay;
}


export function getMoviePremiereDateKey(movie: MovieLifecycleFields): string | null {
  if (movie.status?.toLowerCase() === 'coming-soon' && !movie.premiereDate) return null;
  const value = movie.premiereDate || movie.releaseDate;
  if (!value || typeof value !== 'string') return null;
  const dateOnly = value.match(/^\d{4}-\d{2}-\d{2}/)?.[0];
  if (dateOnly && !Number.isNaN(Date.parse(`${dateOnly}T00:00:00Z`))) return dateOnly;
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) return null;
  return utcDateKey(new Date(parsed));
}

export function isMoviePremierePast(movie: MovieLifecycleFields, now: Date = new Date()): boolean {
  const premiereDate = getMoviePremiereDateKey(movie);
  return premiereDate !== null && premiereDate < utcDateKey(now);
}

export function isFutureComingSoonMovie(movie: MovieLifecycleFields, now: Date = new Date()): boolean {
  const premiereDate = getMoviePremiereDateKey(movie);
  return movie.status?.toLowerCase() === 'coming-soon' && (premiereDate === null || premiereDate >= utcDateKey(now));
}

export function sortMoviesByLifecycle<T extends SortableMovieLifecycleFields>(movies: T[], now: Date = new Date()): T[] {
  return [...movies].sort((left, right) => {
    const leftUpcoming = isFutureComingSoonMovie(left, now);
    const rightUpcoming = isFutureComingSoonMovie(right, now);
    if (leftUpcoming !== rightUpcoming) return leftUpcoming ? -1 : 1;

    const leftDate = getMoviePremiereDateKey(left);
    const rightDate = getMoviePremiereDateKey(right);
    if (leftDate !== rightDate) {
      if (!leftDate) return 1;
      if (!rightDate) return -1;
      return leftUpcoming ? leftDate.localeCompare(rightDate) : rightDate.localeCompare(leftDate);
    }
    return left.tmdbId - right.tmdbId;
  });
}

export function reconcileMovieLifecycle(movie: Movie, now: Date = new Date()): Movie {
  if (movie.status?.toLowerCase() === 'coming-soon' && isMoviePremierePast(movie, now)) {
    return { ...movie, status: 'collection', isComingSoon: false };
  }
  return movie;
}

export function formatMoviePremiereDate(movie: MovieLifecycleFields): string | null {
  const dateKey = getMoviePremiereDateKey(movie);
  if (!dateKey) return null;
  const [year, month, day] = dateKey.split('-').map(Number);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${day} ${months[month - 1]} ${year}`;
}
