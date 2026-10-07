import { Movie } from '../types';

/** Minimal lifecycle fields shared by full movies and lightweight listing records. */
export interface MovieLifecycleFields {
  brandId?: string;
  year?: number;
  status?: string;
  premiereDate?: string;
  networkPremiereDate?: string;
  releaseDate?: string;
  releaseDates?: Array<{ releaseDate: string; note?: string }>;
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

const NETWORK_RELEASE_NOTE_PATTERNS: Record<string, RegExp> = {
  hallmark: /hallmark/i,
  lifetime: /lifetime/i,
  gaf: /(?:\bgaf\b|great american family|gac family)/i,
  uptv: /up\s*tv/i,
};

function validDateKey(value: string | undefined): string | null {
  if (!value || typeof value !== 'string') return null;
  const dateOnly = value.match(/^\d{4}-\d{2}-\d{2}/)?.[0];
  if (dateOnly && !Number.isNaN(Date.parse(`${dateOnly}T00:00:00Z`))) return dateOnly;
  return null;
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

/** Calendar-only date: a curated network premiere takes precedence without changing lifecycle identity. */
export function getMovieNetworkPremiereDateKey(movie: MovieLifecycleFields): string | null {
  if (movie.networkPremiereDate && typeof movie.networkPremiereDate === 'string') {
    const dateOnly = movie.networkPremiereDate.match(/^\d{4}-\d{2}-\d{2}/)?.[0];
    if (dateOnly && !Number.isNaN(Date.parse(`${dateOnly}T00:00:00Z`))) return dateOnly;
  }
  return getMoviePremiereDateKey(movie);
}

/** Returns the year used by a network-specific archive without changing movie chronology. */
export function getMovieArchiveYear(movie: MovieLifecycleFields, networkId?: string): number | null {
  const explicitNetworkDate = validDateKey(movie.networkPremiereDate);
  if (explicitNetworkDate) return Number(explicitNetworkDate.slice(0, 4));

  const pattern = networkId ? NETWORK_RELEASE_NOTE_PATTERNS[networkId.toLowerCase()] : undefined;
  if (pattern) {
    const networkDates = (movie.releaseDates || [])
      .filter((entry) => pattern.test(entry.note || ''))
      .map((entry) => validDateKey(entry.releaseDate))
      .filter((date): date is string => Boolean(date))
      .sort();
    if (networkDates[0]) return Number(networkDates[0].slice(0, 4));
  }

  const releaseDate = validDateKey(movie.releaseDate);
  return releaseDate ? Number(releaseDate.slice(0, 4)) : movie.year ?? null;
}

export function getArchiveYearsForNetwork(movies: MovieLifecycleFields[], networkId: string): number[] {
  const normalizedNetworkId = networkId.toLowerCase();
  return Array.from(new Set(
    movies
      .filter((movie) => movie.brandId?.toLowerCase() === normalizedNetworkId)
      .map((movie) => getMovieArchiveYear(movie, normalizedNetworkId))
      .filter((year): year is number => year !== null),
  )).sort((left, right) => right - left);
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
