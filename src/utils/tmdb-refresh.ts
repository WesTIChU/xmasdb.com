import type { Movie } from '../types';
import { fetchTmdbMovie } from './tmdb';
import { cacheLocalImage, type ImageRefreshBudget } from './local-images';
import { ingestManagedImage } from '../server/managed-images';

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

export function mergeTmdbMovie(movie: Movie, refreshed: Partial<Movie>, posterUrl?: string, backdropUrl?: string): Movie {
  const safeMetadata = Object.fromEntries(Object.entries(refreshed).filter(([, value]) => (
    value !== undefined && value !== null &&
    !(typeof value === 'string' && value.trim() === '') &&
    !(Array.isArray(value) && value.length === 0)
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
  const changed = Object.keys(merged).some((key) => JSON.stringify(merged[key as keyof Movie]) !== JSON.stringify(movie[key as keyof Movie]));
  const tmdbFetchedAt = new Date().toISOString();
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
  return mergeTmdbMovie(movie, refreshed, posterUrl, backdropUrl);
}
