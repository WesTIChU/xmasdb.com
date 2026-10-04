import type { CrewMember, Movie } from '../types';
import type { FingerprintId } from '../data/fingerprints';
import { normalizeBrand } from './movie-import';

export interface AdminMovieEditInput {
  brand: string;
  title: string;
  releaseDate: string;
  networkPremiereDate?: string;
  synopsis: string;
  runtimeMinutes: string | number;
  rating: string | number;
  director: string;
  writers: string;
  imdbId: string;
  tmdbId: string | number;
  posterUrl: string;
  backdropUrl: string;
}

export interface ValidatedAdminMovieEdit {
  brand: string;
  title: string;
  releaseDate: string;
  networkPremiereDate?: string;
  synopsis: string;
  runtimeMinutes?: number;
  rating?: number;
  director?: string;
  writers: string[];
  imdbId?: string;
  tmdbId: number;
  posterUrl: string;
  backdropUrl?: string;
}

function requiredText(value: unknown, label: string, maxLength: number): string {
  if (typeof value !== 'string') throw new Error(`${label} is required.`);
  const result = value.trim();
  if (!result) throw new Error(`${label} is required.`);
  if (result.length > maxLength) throw new Error(`${label} is too long.`);
  return result;
}

function optionalText(value: unknown, label: string, maxLength: number): string | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== 'string') throw new Error(`${label} must be text.`);
  const result = value.trim();
  if (result.length > maxLength) throw new Error(`${label} is too long.`);
  return result || undefined;
}

function optionalDate(value: unknown, label: string): string | undefined {
  const result = optionalText(value, label, 10);
  if (result && (!/^\d{4}-\d{2}-\d{2}$/.test(result) || Number.isNaN(Date.parse(`${result}T00:00:00Z`)))) {
    throw new Error(`${label} must use YYYY-MM-DD.`);
  }
  return result;
}

function integer(value: unknown, label: string, min: number, max: number, required: boolean): number | undefined {
  if (value === '' || value === undefined || value === null) {
    if (required) throw new Error(`${label} is required.`);
    return undefined;
  }
  const result = typeof value === 'number' ? value : Number(String(value).trim());
  if (!Number.isInteger(result) || result < min || result > max) throw new Error(`${label} must be a whole number between ${min} and ${max}.`);
  return result;
}

function rating(value: unknown): number | undefined {
  if (value === '' || value === undefined || value === null) return undefined;
  const result = typeof value === 'number' ? value : Number(String(value).trim());
  if (!Number.isFinite(result) || result < 0 || result > 10 || Math.round(result * 10) !== result * 10) throw new Error('Rating must be a number from 0 to 10 with at most one decimal place.');
  return result;
}

function imagePath(value: unknown, kind: 'posters' | 'backdrops', required: boolean): string | undefined {
  if (value === undefined || value === null) {
    if (!required) return undefined;
    throw new Error(`${kind === 'posters' ? 'Poster' : 'Backdrop'} path is required.`);
  }
  if (typeof value !== 'string') throw new Error(`${kind === 'posters' ? 'Poster' : 'Backdrop'} path must be text.`);
  const result = value.trim();
  if (!result && !required) return undefined;
  if (!new RegExp(`^/images/${kind}/[A-Za-z0-9._-]+$`).test(result)) throw new Error(`${kind === 'posters' ? 'Poster' : 'Backdrop'} path must be a safe canonical image path.`);
  return result;
}

function writerNames(value: unknown): string[] {
  if (typeof value !== 'string') throw new Error('Writers must be text.');
  const names = value.split(/[\r\n,]+/).map((name) => name.trim()).filter(Boolean);
  if (names.length > 20 || names.some((name) => name.length > 120)) throw new Error('Writers contain too many or too-long names.');
  return [...new Set(names)];
}

export function validateAdminMovieEdit(input: Partial<AdminMovieEditInput>): ValidatedAdminMovieEdit {
  const brand = normalizeBrand(requiredText(input.brand, 'Network', 40));
  if (!brand) throw new Error('Unsupported network.');
  const title = requiredText(input.title, 'Title', 200);
  const releaseDate = requiredText(input.releaseDate, 'Release date', 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(releaseDate) || Number.isNaN(Date.parse(`${releaseDate}T00:00:00Z`))) throw new Error('Release date must use YYYY-MM-DD.');
  const tmdbId = integer(input.tmdbId, 'TMDb ID', 1, 9999999999, true)!;
  const networkPremiereDate = optionalDate(input.networkPremiereDate, 'Network premiere date');
  const imdbId = optionalText(input.imdbId, 'IMDb ID', 30);
  if (imdbId && !/^tt\d{7,10}$/i.test(imdbId)) throw new Error('IMDb ID must look like tt1234567.');
  return {
    brand,
    title,
    releaseDate,
    networkPremiereDate,
    synopsis: requiredText(input.synopsis, 'Synopsis', 20000),
    runtimeMinutes: integer(input.runtimeMinutes, 'Runtime', 1, 600, false),
    rating: rating(input.rating),
    director: optionalText(input.director, 'Director', 200),
    writers: writerNames(input.writers),
    imdbId: imdbId?.toLowerCase(),
    tmdbId,
    posterUrl: imagePath(input.posterUrl, 'posters', true)!,
    backdropUrl: imagePath(input.backdropUrl, 'backdrops', false),
  };
}

function slugForTitle(title: string, fallback: string): string {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || fallback;
}

function updateWriters(crew: CrewMember[] | undefined, names: string[]): CrewMember[] | undefined {
  const current = crew || [];
  const nonWriters = current.filter((member) => !/writer/i.test(member.job));
  const oldWriters = current.filter((member) => /writer/i.test(member.job));
  const writers = names.map((name, index) => ({
    ...(oldWriters[index] || { id: 0, department: 'Writing' }),
    name,
    job: oldWriters[index]?.job || 'Writer',
  }));
  const result = [...nonWriters, ...writers];
  return result.length ? result : undefined;
}

export function applyAdminMovieEdit(movie: Movie, input: ValidatedAdminMovieEdit): Movie {
  return {
    ...movie,
    brandId: input.brand,
    title: input.title,
    slug: slugForTitle(input.title, movie.slug),
    releaseDate: input.releaseDate,
    networkPremiereDate: input.networkPremiereDate,
    year: Number(input.releaseDate.slice(0, 4)),
    synopsis: input.synopsis,
    runtimeMinutes: input.runtimeMinutes,
    voteAverage: input.rating,
    director: input.director,
    crew: updateWriters(movie.crew, input.writers),
    imdbId: input.imdbId,
    tmdbId: input.tmdbId,
    posterUrl: input.posterUrl,
    backdropUrl: input.backdropUrl,
  };
}

export function validateMovieUniqueness(movies: Movie[], edited: Movie, originalId = edited.id): void {
  const otherMovies = movies.filter((movie) => movie.id !== originalId);
  if (otherMovies.some((movie) => movie.id === edited.id)) throw new Error('Duplicate movie ID.');
  if (otherMovies.some((movie) => movie.tmdbId === edited.tmdbId)) throw new Error(`TMDb ID ${edited.tmdbId} is already used by another movie.`);
  if (edited.imdbId && otherMovies.some((movie) => movie.imdbId?.toLowerCase() === edited.imdbId!.toLowerCase())) throw new Error(`IMDb ID ${edited.imdbId} is already used by another movie.`);
  if (otherMovies.some((movie) => movie.slug.toLowerCase() === edited.slug.toLowerCase())) throw new Error('The edited title would create a duplicate movie slug.');
}

export function removeMovie(movies: Movie[], id: string): { movie: Movie; movies: Movie[] } {
  const movie = movies.find((entry) => entry.id === id);
  if (!movie) throw new Error('Movie was not found in the canonical catalogue.');
  return { movie, movies: movies.filter((entry) => entry.id !== id) };
}

export function removeMovieFingerprintAssignment(assignments: Record<string, readonly FingerprintId[]> | undefined, id: string): Record<string, readonly FingerprintId[]> | undefined {
  if (!assignments) return undefined;
  return Object.fromEntries(Object.entries(assignments).filter(([movieId]) => movieId !== id));
}

export function searchAdminMovies(movies: Movie[], query: string, limit = 50): Movie[] {
  const normalized = query.trim().toLowerCase();
  return movies
    .filter((movie) => !normalized || movie.title.toLowerCase().includes(normalized) || movie.originalTitle?.toLowerCase().includes(normalized) || movie.alternativeTitles?.some((entry) => entry.title.toLowerCase().includes(normalized)) || movie.slug.toLowerCase().includes(normalized))
    .sort((left, right) => left.title.localeCompare(right.title) || right.year - left.year)
    .slice(0, limit);
}

export function getMovieWriters(movie: Pick<Movie, 'crew'>): string[] {
  return (movie.crew || []).filter((member) => /writer/i.test(member.job)).map((member) => member.name);
}
