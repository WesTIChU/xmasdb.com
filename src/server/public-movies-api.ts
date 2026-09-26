import { MOVIES } from '../data/movies';
import { getBrandById, getBrandBySlug } from '../data/brands';
import { getAllActors, getTmdbPersonIdForSlug } from '../data/actors';
import { FINGERPRINTS, getFingerprintById } from '../data/fingerprints';
import { getMovieFingerprints, movieHasFingerprint } from '../data/movie-fingerprints';
import type { Movie } from '../types';
import { getActorPath, getMoviePath, toCanonicalUrl } from '../utils/urls';

const MAX_LIMIT = 1000;

export interface PublicMoviesQuery {
  network?: unknown;
  year?: unknown;
  limit?: unknown;
  actor?: unknown;
  ingredient?: unknown;
}

export interface PublicActor {
  name: string;
  tmdb_id: number;
  xmasdb_movie_count: number;
  xmasdb_url: string;
}

export interface PublicIngredient {
  id: string;
  name: string;
  movie_count: number;
}

export interface PublicMovie {
  title: string;
  year: number;
  network: string;
  tmdb_id: number;
  imdb_id: string | null;
  actors: Array<{ name: string; tmdb_id: number }>;
  christmas_ingredients: Array<{ id: string; name: string }>;
  xmasdb_url: string;
}

export interface PublicMoviesResponse {
  count: number;
  movies: PublicMovie[];
}

export interface PublicMoviesQueryError {
  error: string;
}

export interface PublicActorDetail extends PublicActor {
  movies: PublicMovie[];
}

export interface PublicIngredientDetail extends PublicIngredient {
  movies: PublicMovie[];
}

function getQueryValue(value: unknown, name: string): string | undefined | PublicMoviesQueryError {
  if (value === undefined) return undefined;
  if (typeof value !== 'string' || value.trim() === '') return { error: `Invalid ${name} parameter.` };
  return value.trim();
}

function getCastPersonId(member: Movie['cast'][number]): number {
  return member.tmdbPersonId || getTmdbPersonIdForSlug(member.slug);
}

function toPublicMovie(movie: Movie): PublicMovie {
  const brand = getBrandById(movie.brandId);
  const actors = movie.cast.map((member) => ({
    name: member.name,
    tmdb_id: getCastPersonId(member),
  }));
  return {
    title: movie.title,
    year: movie.year,
    network: brand?.shortName || movie.brandId,
    tmdb_id: movie.tmdbId,
    imdb_id: movie.imdbId || null,
    actors,
    christmas_ingredients: getMovieFingerprints(movie).map((ingredient) => ({ id: ingredient.id, name: ingredient.label })),
    xmasdb_url: toCanonicalUrl(getMoviePath(movie.tmdbId, movie.slug)),
  };
}

let publicMovieCache: Map<string, PublicMovie> | null = null;

function getPublicMovie(movie: Movie): PublicMovie {
  if (!publicMovieCache) publicMovieCache = new Map();
  const cached = publicMovieCache.get(movie.id);
  if (cached) return cached;
  const result = toPublicMovie(movie);
  publicMovieCache.set(movie.id, result);
  return result;
}

function buildPublicActorIndex(): Map<number, { name: string; slug: string; movieIds: Set<string> }> {
  const actors = new Map<number, { name: string; slug: string; movieIds: Set<string> }>();
  const canonicalActors = new Map(getAllActors().map((actor) => [actor.tmdbPersonId, actor]));
  for (const movie of MOVIES) {
    for (const member of movie.cast) {
      const tmdbId = getCastPersonId(member);
      const actor = canonicalActors.get(tmdbId);
      const existing = actors.get(tmdbId);
      if (existing) {
        existing.movieIds.add(movie.id);
      } else {
        actors.set(tmdbId, { name: actor?.name || member.name, slug: actor?.slug || member.slug, movieIds: new Set([movie.id]) });
      }
    }
  }
  return actors;
}

let publicActorIndex: Map<number, { name: string; slug: string; movieIds: Set<string> }> | null = null;
let publicActorsCache: PublicActor[] | null = null;

function getPublicActors(): PublicActor[] {
  if (publicActorsCache) return publicActorsCache;
  if (!publicActorIndex) publicActorIndex = buildPublicActorIndex();
  publicActorsCache = [...publicActorIndex.entries()]
    .map(([tmdbId, actor]) => ({
      name: actor.name,
      tmdb_id: tmdbId,
      xmasdb_movie_count: actor.movieIds.size,
      xmasdb_url: toCanonicalUrl(getActorPath(tmdbId, actor.slug)),
    }))
    .sort((left, right) => left.name.localeCompare(right.name) || left.tmdb_id - right.tmdb_id);
  return publicActorsCache;
}

function getPublicActorDetail(tmdbId: number): PublicActorDetail | undefined {
  if (!publicActorIndex) publicActorIndex = buildPublicActorIndex();
  const actor = publicActorIndex.get(tmdbId);
  if (!actor) return undefined;
  const movies = MOVIES.filter((movie) => actor.movieIds.has(movie.id)).map(getPublicMovie);
  return {
    name: actor.name,
    tmdb_id: tmdbId,
    xmasdb_movie_count: movies.length,
    xmasdb_url: toCanonicalUrl(getActorPath(tmdbId, actor.slug)),
    movies,
  };
}

let publicIngredientsCache: PublicIngredient[] | null = null;

function getPublicIngredients(): PublicIngredient[] {
  if (publicIngredientsCache) return publicIngredientsCache;
  const counts = new Map<string, number>(FINGERPRINTS.map((ingredient) => [ingredient.id, 0]));
  for (const movie of MOVIES) {
    for (const ingredient of getMovieFingerprints(movie)) counts.set(ingredient.id, (counts.get(ingredient.id) || 0) + 1);
  }
  publicIngredientsCache = FINGERPRINTS.map((ingredient) => ({ id: ingredient.id, name: ingredient.label, movie_count: counts.get(ingredient.id) || 0 }));
  return publicIngredientsCache;
}

function getPublicIngredientDetail(id: string): PublicIngredientDetail | undefined {
  const ingredient = getFingerprintById(id);
  if (!ingredient) return undefined;
  const movies = MOVIES.filter((movie) => movieHasFingerprint(movie, id)).map(getPublicMovie);
  return { id: ingredient.id, name: ingredient.label, movie_count: movies.length, movies };
}

function parseId(value: unknown, name: string): number | PublicMoviesQueryError {
  if (typeof value !== 'string' || !/^\d+$/.test(value) || !Number.isSafeInteger(Number(value)) || Number(value) <= 0) {
    return { error: `Invalid ${name} parameter.` };
  }
  return Number(value);
}

export function buildPublicMoviesResponse(query: PublicMoviesQuery): PublicMoviesResponse | PublicMoviesQueryError {
  const networkValue = getQueryValue(query.network, 'network');
  if (typeof networkValue === 'object') return networkValue;
  const yearValue = getQueryValue(query.year, 'year');
  if (typeof yearValue === 'object') return yearValue;
  const limitValue = getQueryValue(query.limit, 'limit');
  if (typeof limitValue === 'object') return limitValue;
  const actorValue = getQueryValue(query.actor, 'actor');
  if (typeof actorValue === 'object') return actorValue;
  const ingredientValue = getQueryValue(query.ingredient, 'ingredient');
  if (typeof ingredientValue === 'object') return ingredientValue;

  const brand = networkValue ? getBrandBySlug(networkValue) : undefined;
  if (networkValue && !brand) return { error: 'Invalid network parameter.' };

  const year = yearValue === undefined ? undefined : /^\d{4}$/.test(yearValue) ? Number(yearValue) : NaN;
  if (year !== undefined && (!Number.isInteger(year) || year <= 0)) return { error: 'Invalid year parameter.' };

  const limit = limitValue === undefined ? MOVIES.length : /^\d+$/.test(limitValue) ? Number(limitValue) : NaN;
  if (!Number.isInteger(limit) || limit < 1 || limit > MAX_LIMIT) {
    return { error: `Invalid limit parameter. Use a whole number from 1 to ${MAX_LIMIT}.` };
  }

  const actorId = actorValue === undefined ? undefined : parseId(actorValue, 'actor');
  if (typeof actorId === 'object') return actorId;
  if (ingredientValue !== undefined && !getFingerprintById(ingredientValue)) return { error: 'Invalid ingredient parameter.' };

  const movies = MOVIES
    .filter((movie) => !brand || movie.brandId === brand.id)
    .filter((movie) => year === undefined || movie.year === year)
    .filter((movie) => actorId === undefined || movie.cast.some((member) => getCastPersonId(member) === actorId))
    .filter((movie) => ingredientValue === undefined || movieHasFingerprint(movie, ingredientValue))
    .slice(0, limit)
    .map(getPublicMovie);

  return { count: movies.length, movies };
}

export function buildPublicActorsResponse(): { actors: PublicActor[] } {
  return { actors: getPublicActors() };
}

export function buildPublicActorResponse(value: unknown): PublicActorDetail | PublicMoviesQueryError | undefined {
  const id = parseId(value, 'actor');
  if (typeof id === 'object') return id;
  return getPublicActorDetail(id);
}

export function buildPublicIngredientsResponse(): { ingredients: PublicIngredient[] } {
  return { ingredients: getPublicIngredients() };
}

export function buildPublicIngredientResponse(value: unknown): PublicIngredientDetail | PublicMoviesQueryError | undefined {
  if (typeof value !== 'string' || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value)) return { error: 'Invalid ingredient parameter.' };
  return getPublicIngredientDetail(value);
}
