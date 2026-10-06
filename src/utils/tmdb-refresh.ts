import type { Movie, MovieCertification, ReleaseDateInfo } from '../types';
import { fetchTmdbMovie } from './tmdb';
import { cacheLocalImage, type ImageRefreshBudget } from './local-images';
import { ingestManagedImage } from '../server/managed-images';
import { runJevKeywordRefresh, type JevKeywordRefreshOptions } from '../server/jev-keyword-refresh';
import { normalizeJevKeyword } from './keyword-identity';

function localAssetPath(kind: 'posters' | 'backdrops', id: number): string {
  return `/images/${kind}/${id}.jpg`;
}

export function selectPeopleRefreshMovies(
  movies: Movie[],
  targetMovies: Movie[],
  options: { comingSoonOnly: boolean; requestedId?: number },
): Movie[] {
  if (options.comingSoonOnly) {
    const targetIds = new Set(targetMovies.map((movie) => movie.tmdbId));
    return movies.filter((movie) => targetIds.has(movie.tmdbId));
  }
  if (options.requestedId) return movies.filter((movie) => movie.tmdbId === options.requestedId);
  return movies;
}

function dateOnly(value: string | undefined): string | undefined {
  return value?.match(/^\d{4}-\d{2}-\d{2}/)?.[0];
}

function explicitCertification(releases: ReleaseDateInfo[] | undefined, releaseDate?: string): { value: string; country: 'US' } | undefined {
  const candidates = (releases || []).filter((entry) => entry.country === 'US' && entry.certification?.trim());
  if (candidates.length === 0) return undefined;
  const datedCandidates = dateOnly(releaseDate) ? candidates.filter((entry) => dateOnly(entry.releaseDate) === dateOnly(releaseDate)) : [];
  const selectionPool = datedCandidates.length > 0 ? datedCandidates : candidates;
  const selected = selectionPool[0];
  return { value: selected.certification!.trim(), country: 'US' };
}

export function mergeTmdbKeywords(existing: Movie['keywords'], refreshed: Movie['keywords']): Movie['keywords'] {
  if (refreshed === undefined) return existing;
  const byId = new Map<number, Extract<NonNullable<Movie['keywords']>[number], { id: number }>>();
  const jev = (existing || []).filter((keyword): keyword is Extract<NonNullable<Movie['keywords']>[number], { evidence: string }> => !('id' in keyword));
  for (const keyword of existing || []) if ('id' in keyword) byId.set(keyword.id, keyword);
  for (const keyword of refreshed) {
    if (!('id' in keyword)) continue;
    byId.set(keyword.id, keyword);
  }
  // TMDB is authoritative for an equivalent concept, but distinct TMDB IDs
  // remain distinct even when their names normalize identically.
  const tmdb = [...byId.values()];
  const tmdbNames = new Set(tmdb.map((keyword) => normalizeJevKeyword(keyword.name)));
  return [...tmdb, ...jev.filter((keyword) => !tmdbNames.has(normalizeJevKeyword(keyword.name)))];
}

export function mergeTmdbCertification(
  existing: MovieCertification | undefined,
  releases: ReleaseDateInfo[] | undefined,
  releaseDate: string | undefined,
  confirmedAt: string,
): MovieCertification | undefined {
  const observed = explicitCertification(releases, releaseDate);
  if (!observed) return existing?.country === 'US' ? existing : undefined;
  if (existing && existing.value === observed.value && existing.country === observed.country) {
    return { ...existing, lastConfirmedAt: confirmedAt };
  }
  return { ...observed, source: 'tmdb', lastConfirmedAt: confirmedAt };
}

export function mergeTmdbMovie(movie: Movie, refreshed: Partial<Movie>, posterUrl?: string, backdropUrl?: string): Movie {
  const safeMetadata = Object.fromEntries(Object.entries({
    ...refreshed,
    ...(Object.prototype.hasOwnProperty.call(refreshed, 'keywords')
      ? { keywords: mergeTmdbKeywords(movie.keywords, refreshed.keywords) }
      : {}),
  }).filter(([key, value]) => (
    key === 'genres' || (
      value !== undefined && value !== null &&
      !(typeof value === 'string' && value.trim() === '') &&
      !(Array.isArray(value) && value.length === 0)
    )
  )));
  const merged = {
    ...movie,
    ...safeMetadata,
    id: movie.id,
    slug: movie.slug,
    brandId: movie.brandId,
    status: movie.status,
    isComingSoon: movie.isComingSoon,
    networkPremiereDate: movie.networkPremiereDate,
    year: refreshed.releaseDate ? Number(refreshed.releaseDate.slice(0, 4)) || movie.year : movie.year,
    premiereDate: refreshed.releaseDate || movie.premiereDate,
    releaseDate: refreshed.releaseDate || movie.releaseDate,
    posterUrl: posterUrl || movie.posterUrl,
    backdropUrl: backdropUrl || movie.backdropUrl,
  };
  const tmdbFetchedAt = new Date().toISOString();
  const certification = mergeTmdbCertification(movie.certification, refreshed.releaseDates, refreshed.releaseDate, tmdbFetchedAt);
  if (certification) merged.certification = certification;
  else delete merged.certification;
  const changed = Object.keys(merged).some((key) => JSON.stringify(merged[key as keyof Movie]) !== JSON.stringify(movie[key as keyof Movie]));
  return changed
    ? { ...merged, tmdbUpdatedAt: tmdbFetchedAt, tmdbFetchedAt }
    : { ...movie, tmdbFetchedAt };
}

export interface TmdbImageRefreshFailure {
  localPath: string;
  message: string;
}

export async function refreshTmdbMovie(
  movie: Movie,
  apiKey: string,
  cacheImage: typeof cacheLocalImage = cacheLocalImage,
  imageBudget?: ImageRefreshBudget,
  onImageFailure?: (failure: TmdbImageRefreshFailure) => void,
  jevOptions?: JevKeywordRefreshOptions,
): Promise<Movie> {
  const refreshed = await fetchTmdbMovie(movie.tmdbId, apiKey);
  if (!refreshed) throw new Error(`TMDB returned no movie data for ${movie.tmdbId}`);
  const ingest = async (remoteUrl: string | undefined, localPath: string): Promise<string | undefined> => {
    if (!remoteUrl) return undefined;
    try {
      return cacheImage === cacheLocalImage
        ? await ingestManagedImage(remoteUrl, localPath, { refreshBudget: imageBudget })
        : await cacheImage(remoteUrl, localPath, { refreshBudget: imageBudget });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`[TMDB Refresh] Image ingestion failed for ${localPath}: ${message}`);
      onImageFailure?.({ localPath, message });
      return undefined;
    }
  };
  const posterUrl = await ingest(refreshed.posterUrl, localAssetPath('posters', movie.tmdbId));
  const backdropUrl = await ingest(refreshed.backdropUrl, localAssetPath('backdrops', movie.tmdbId));
  const merged = mergeTmdbMovie(movie, refreshed, posterUrl, backdropUrl);
  if (!jevOptions) return merged;
  const jevResult = await runJevKeywordRefresh(merged, jevOptions);
  if (jevResult.failure) jevOptions.onFailure?.(jevResult.failure);
  return jevResult.movie;
}
