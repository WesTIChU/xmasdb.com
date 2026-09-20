import type { Movie } from '../types';

export const MOVIE_BRANDS = ['hallmark', 'lifetime', 'gaf'] as const;
export const MOVIE_STATUSES = ['collection', 'coming-soon'] as const;
export type MovieBrand = typeof MOVIE_BRANDS[number];
export type MovieStatus = typeof MOVIE_STATUSES[number];

export interface ParsedMovieInput {
  line: number;
  tmdbId?: number;
  brand?: MovieBrand;
  status?: MovieStatus;
  error?: string;
}

export function normalizeBrand(value: string): MovieBrand | undefined {
  const normalized = value.trim().toLowerCase().replace(/\s+/g, '-');
  if (normalized === 'hallmark') return 'hallmark';
  if (normalized === 'lifetime') return 'lifetime';
  if (normalized === 'gaf' || normalized === 'great-american-family') return 'gaf';
  return undefined;
}

export function normalizeStatus(value: string): MovieStatus | undefined {
  const normalized = value.trim().toLowerCase();
  return MOVIE_STATUSES.includes(normalized as MovieStatus) ? normalized as MovieStatus : undefined;
}

export function extractTmdbId(value: string): number | undefined {
  const trimmed = value.trim();
  const match = trimmed.match(/^(?:https?:\/\/)?(?:www\.)?themoviedb\.org\/movie\/(\d+)(?:[-/?#].*)?$/i);
  if (match) return Number(match[1]);
  if (/^\d+$/.test(trimmed)) return Number(trimmed);
  return undefined;
}

export function parseBulkMovieInput(input: string, defaultBrand: string, defaultStatus: string, max = 50): { items: ParsedMovieInput[]; error?: string } {
  const lines = input.split(/\r?\n/).map((line, index) => ({ value: line.trim(), line: index + 1 })).filter((entry) => entry.value);
  if (lines.length > max) return { items: [], error: `A maximum of ${max} movies can be previewed at once.` };
  const brand = normalizeBrand(defaultBrand);
  const status = normalizeStatus(defaultStatus);
  const items = lines.map(({ value, line }) => {
    const parts = value.split('|').map((part) => part.trim());
    if (parts.length > 3) return { line, error: 'Use TMDb ID, brand and status separated by pipes.' };
    const tmdbId = extractTmdbId(parts[0]);
    if (!tmdbId || tmdbId <= 0) return { line, error: `Line ${line}: "${value}" is not a valid TMDb movie ID or URL.` };
    const itemBrand = parts[1] ? normalizeBrand(parts[1]) : brand;
    const itemStatus = parts[2] ? normalizeStatus(parts[2]) : status;
    if (!itemBrand) return { line, tmdbId, error: `Line ${line}: unsupported brand.` };
    if (!itemStatus) return { line, tmdbId, error: `Line ${line}: status must be collection or coming-soon.` };
    return { line, tmdbId, brand: itemBrand, status: itemStatus };
  });
  const seen = new Set<number>();
  for (const item of items) {
    if (!item.tmdbId || item.error) continue;
    if (seen.has(item.tmdbId)) item.error = `Line ${item.line}: duplicate TMDb ID ${item.tmdbId} in this batch.`;
    seen.add(item.tmdbId);
  }
  return { items };
}

export function generateMoviesModule(movies: Movie[]): string {
  return `import { Movie } from '../types';\n\nexport const MOVIES: Movie[] = ${JSON.stringify(movies, null, 2)};\n\nexport function getMovieBySlug(slug: string): Movie | undefined { return MOVIES.find((m) => m.slug.toLowerCase() === slug.toLowerCase()); }\nexport function getMovieByTmdbId(tmdbId: number): Movie | undefined { return MOVIES.find((m) => m.tmdbId === tmdbId); }\nexport function getMovieByTmdbIdAndSlug(tmdbId: number, slug?: string): Movie | undefined { return getMovieByTmdbId(tmdbId) || (slug ? getMovieBySlug(slug) : undefined); }\nexport function getMovieByIdentifier(identifier: string | number): Movie | undefined { const value = String(identifier).trim(); return /^\\d+$/.test(value) ? getMovieByTmdbId(Number(value)) || getMovieBySlug(value) : getMovieBySlug(value); }\nexport function getMoviesByBrand(brandId: string): Movie[] { return MOVIES.filter((m) => m.brandId.toLowerCase() === brandId.toLowerCase()); }\nexport function getMoviesByActorSlug(actorSlug: string): Movie[] { return MOVIES.filter((m) => m.cast.some((c) => c.slug.toLowerCase() === actorSlug.toLowerCase())); }\nexport function getAllYearsForBrand(brandId?: string): number[] { const filtered = brandId ? getMoviesByBrand(brandId) : MOVIES; return Array.from(new Set(filtered.map((m) => m.year))).sort((a, b) => b - a); }\n`;
}

export function buildMovieFromTmdb(tmdbId: number, metadata: Partial<Movie>, brandId: MovieBrand, status: MovieStatus): Movie {
  const title = metadata.title || metadata.originalTitle || `TMDB movie ${tmdbId}`;
  const slug = title.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || `tmdb-${tmdbId}`;
  const releaseDate = metadata.releaseDate || new Date().toISOString().slice(0, 10);
  return {
    id: `${brandId}-${releaseDate.slice(0, 4)}-${slug}`,
    slug,
    title,
    year: Number(releaseDate.slice(0, 4)) || new Date().getUTCFullYear(),
    brandId,
    releaseDate,
    synopsis: metadata.synopsis || '',
    posterUrl: metadata.posterUrl || '',
    backdropUrl: metadata.backdropUrl,
    cast: metadata.cast || [],
    director: metadata.director,
    tmdbId,
    imdbId: metadata.imdbId,
    isComingSoon: status === 'coming-soon',
    status,
    originalTitle: metadata.originalTitle,
    runtimeMinutes: metadata.runtimeMinutes,
    genres: metadata.genres,
    releaseDates: metadata.releaseDates,
    crew: metadata.crew,
    trailers: metadata.trailers,
    trailerYoutubeKey: metadata.trailerYoutubeKey,
    links: metadata.links,
    tagline: metadata.tagline,
    voteAverage: metadata.voteAverage,
    voteCount: metadata.voteCount,
    tmdbUpdatedAt: new Date().toISOString(),
  };
}
