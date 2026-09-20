import type { ListingMovie, SearchMovieEntry, SearchPersonEntry } from '../api/types';

export interface MovieSearchFields {
  title: string;
  originalTitle?: string;
  secondaryText?: string;
}

export interface ScoredSearchResult<T> {
  item: T;
  score: number;
}

/** Normalizes punctuation without making names such as O'Neil unsearchable. */
export function normalizeSearchText(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[’']/g, '')
    .replace(/[-_/]+/g, ' ')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Scores direct text matches. Higher values represent stronger textual intent;
 * the category-specific helpers deliberately down-weight secondary metadata.
 */
export function scoreTextMatch(text: string, rawQuery: string): number {
  const value = normalizeSearchText(text);
  const query = normalizeSearchText(rawQuery);
  if (!value || !query) return 0;

  const tokens = value.split(' ');
  const queryTokens = query.split(' ');
  const compactValue = value.replace(/\s+/g, '');
  const compactQuery = query.replace(/\s+/g, '');

  if (value === query || compactValue === compactQuery) return 1000;
  if (queryTokens.length === 1 && tokens.includes(query)) return 900;
  if (value.startsWith(query) || compactValue.startsWith(compactQuery)) return 800;
  if (tokens.some((token) => token.startsWith(query))) return 700;
  if (value.includes(query) || compactValue.includes(compactQuery)) return 600;
  return 0;
}

export function scoreActorSearchResult(actor: SearchPersonEntry, query: string): number {
  return scoreTextMatch(actor.name, query);
}

export function scoreMovieSearchFields(fields: MovieSearchFields, query: string): number {
  const titleScore = scoreTextMatch(fields.title, query);
  const alternateScore = fields.originalTitle ? Math.floor(scoreTextMatch(fields.originalTitle, query) * 0.45) : 0;
  const secondaryScore = fields.secondaryText ? Math.floor(scoreTextMatch(fields.secondaryText, query) * 0.2) : 0;
  return Math.max(titleScore, alternateScore, secondaryScore);
}

export function scoreMovieSearchEntry(movie: SearchMovieEntry, query: string): number {
  return scoreMovieSearchFields({
    title: movie.title,
    originalTitle: movie.originalTitle,
    secondaryText: movie.terms,
  }, query);
}

export function scoreListingMovieTitle(movie: Pick<ListingMovie, 'title'>, query: string): number {
  return scoreTextMatch(movie.title, query);
}

export function compareScoredResults<T>(a: ScoredSearchResult<T>, b: ScoredSearchResult<T>): number {
  return b.score - a.score;
}
