import type { Movie } from '../types';
import { fetchTmdbMovie } from './tmdb';
import { cacheLocalImage } from './local-images';

function localAssetPath(kind: 'posters' | 'backdrops', id: number): string {
  return `/images/${kind}/${id}.jpg`;
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
    premiereDate: refreshed.releaseDate || movie.premiereDate,
    releaseDate: refreshed.releaseDate || movie.releaseDate,
    posterUrl: posterUrl || movie.posterUrl,
    backdropUrl: backdropUrl || movie.backdropUrl,
  };
  const changed = Object.keys(merged).some((key) => JSON.stringify(merged[key as keyof Movie]) !== JSON.stringify(movie[key as keyof Movie]));
  return changed ? { ...merged, tmdbUpdatedAt: new Date().toISOString() } : movie;
}

export async function refreshTmdbMovie(
  movie: Movie,
  apiKey: string,
  cacheImage: typeof cacheLocalImage = cacheLocalImage,
): Promise<Movie> {
  const refreshed = await fetchTmdbMovie(movie.tmdbId, apiKey);
  if (!refreshed) throw new Error(`TMDB returned no movie data for ${movie.tmdbId}`);
  const posterUrl = await cacheImage(refreshed.posterUrl, localAssetPath('posters', movie.tmdbId));
  const backdropUrl = await cacheImage(refreshed.backdropUrl, localAssetPath('backdrops', movie.tmdbId));
  return mergeTmdbMovie(movie, refreshed, posterUrl, backdropUrl);
}
