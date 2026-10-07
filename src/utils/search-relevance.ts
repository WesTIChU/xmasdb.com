import type { ListingMovie, SearchIngredientEntry, SearchMovieEntry, SearchPersonEntry } from '../api/types';

export interface MovieSearchFields {
  title: string;
  tmdbId?: number;
  originalTitle?: string;
  alternativeTitles?: string[];
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

export function scoreIngredientSearchResult(ingredient: Pick<SearchIngredientEntry, 'label'>, query: string): number {
  return scoreTextMatch(ingredient.label, query);
}

export function scoreMovieSearchFields(fields: MovieSearchFields, query: string): number {
  const normalizedQuery = normalizeSearchText(query);
  const exactTmdbIdScore = fields.tmdbId !== undefined
    && /^\d+$/.test(normalizedQuery)
    && String(fields.tmdbId) === normalizedQuery
    ? 2000
    : 0;
  const titleScore = scoreTextMatch(fields.title, query);
  const alternateScore = fields.originalTitle ? Math.floor(scoreTextMatch(fields.originalTitle, query) * 0.45) : 0;
  const alternativeTitleScore = Math.max(0, ...(fields.alternativeTitles || []).map((title) => Math.floor(scoreTextMatch(title, query) * 0.45)));
  const secondaryScore = fields.secondaryText ? Math.floor(scoreTextMatch(fields.secondaryText, query) * 0.2) : 0;
  return Math.max(exactTmdbIdScore, titleScore, alternateScore, alternativeTitleScore, secondaryScore);
}

export function getDisplayAlternativeTitles(title: string, alternativeTitles?: string[]): string[] {
  const canonical = normalizeSearchText(title);
  const seen = new Set<string>();
  return (alternativeTitles || []).reduce<string[]>((result, alternativeTitle) => {
    const trimmed = alternativeTitle.trim();
    const normalized = normalizeSearchText(trimmed);
    if (!normalized || normalized === canonical || seen.has(normalized)) return result;
    seen.add(normalized);
    result.push(trimmed);
    return result;
  }, []);
}

export function scoreMovieSearchEntry(movie: SearchMovieEntry, query: string): number {
  return scoreMovieSearchFields({
    title: movie.title,
    tmdbId: movie.tmdbId,
    originalTitle: movie.originalTitle,
    alternativeTitles: movie.alternativeTitles,
    secondaryText: movie.terms,
  }, query);
}

export function scoreListingMovieTitle(movie: Pick<ListingMovie, 'title'>, query: string): number {
  return scoreTextMatch(movie.title, query);
}

export function compareScoredResults<T>(a: ScoredSearchResult<T>, b: ScoredSearchResult<T>): number {
  return b.score - a.score;
}
