import { Actor, CastMember, CrewMember, Genre, Movie, ReleaseDateInfo, Trailer } from '../types';
import { MOVIES } from '../data/movies';
import { getTmdbPersonIdForSlug } from '../data/actors';

export { calculateAge, calculateAgeAtDeath, formatActorDate } from './actor-dates';

export function requireTmdbApiKey(): string {
  const key = typeof process !== 'undefined' ? process.env?.TMDB_API_KEY : undefined;
  if (!key || key.trim().length === 0) {
    throw new Error('TMDB_API_KEY is not configured. Add it to .env or the server environment.');
  }
  return key.trim();
}

/**
 * TMDB Person API Response structure from /3/person/{person_id}?append_to_response=external_ids
 */
export interface TmdbPersonApiResponse {
  id: number;
  name: string;
  birthday: string | null;
  deathday: string | null;
  place_of_birth: string | null;
  biography: string | null;
  profile_path: string | null;
  imdb_id: string | null;
  also_known_as?: string[];
  external_ids?: {
    imdb_id?: string | null;
    wikidata_id?: string | null;
    instagram_id?: string | null;
    twitter_id?: string | null;
    facebook_id?: string | null;
  };
  gender?: number;
  known_for_department?: string | null;
  combined_credits?: {
    cast?: Array<{ id: number }>;
    crew?: Array<{ id: number }>;
  };
}

export interface TmdbMovieApiResponse {
  id: number;
  title?: string;
  original_title?: string;
  overview?: string;
  release_date?: string;
  runtime?: number | null;
  poster_path?: string | null;
  backdrop_path?: string | null;
  tagline?: string | null;
  genres?: Genre[];
  vote_average?: number;
  vote_count?: number;
  external_ids?: { imdb_id?: string | null };
  videos?: { results?: Array<{ key: string; site: string; type: string; name: string; official?: boolean }> };
  release_dates?: { results?: Array<{ iso_3166_1: string; release_dates?: Array<{ release_date: string; type?: number; certification?: string; note?: string }> }> };
  credits?: {
    cast?: Array<{ id: number; name: string; character?: string; order?: number; profile_path?: string | null }>;
    crew?: Array<{ id: number; name: string; job: string; credit_id?: string }>;
  };
}

interface TmdbMovieSearchResponse {
  results?: Array<{ id: number; title?: string; release_date?: string }>;
}

interface TmdbFindResponse {
  movie_results?: Array<{ id: number }>;
}

function tmdbImageUrl(pathValue?: string | null, size: string = 'w500'): string | undefined {
  if (!pathValue) return undefined;
  const cleanPath = pathValue.startsWith('/') ? pathValue : `/${pathValue}`;
  return `https://image.tmdb.org/t/p/${size}${cleanPath}`;
}

function tmdbGenderLabel(gender?: number): string | undefined {
  return ({ 1: 'Female', 2: 'Male', 3: 'Non-binary' } as Record<number, string>)[gender || 0];
}

async function fetchTmdbJson<T>(url: string): Promise<T | null> {
  const retryableStatuses = new Set([408, 429, 500, 502, 503, 504]);
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(url, { headers: { Accept: 'application/json' } });
      if (res.ok) return await res.json() as T;
      if (!retryableStatuses.has(res.status)) {
        console.error(`[TMDB] Request failed: HTTP ${res.status}`);
        return null;
      }
      if (attempt < 2) await new Promise((resolve) => setTimeout(resolve, 500 * 2 ** attempt));
    } catch (error) {
      if (attempt === 2) {
        console.error(`[TMDB] Request failed: ${error instanceof Error ? error.message : String(error)}`);
        return null;
      }
      await new Promise((resolve) => setTimeout(resolve, 500 * 2 ** attempt));
    }
  }
  return null;
}

/** Searches TMDB server-side for conservative catalogue import matching. */
export async function searchTmdbMovies(title: string, year?: number, apiKey?: string): Promise<Array<{ id: number; title: string; releaseDate?: string }>> {
  const key = apiKey || (typeof process !== 'undefined' ? process.env?.TMDB_API_KEY : undefined);
  if (!key) return [];
  const yearQuery = year ? `&year=${year}` : '';
  const url = `https://api.themoviedb.org/3/search/movie?api_key=${encodeURIComponent(key)}&query=${encodeURIComponent(title)}${yearQuery}&include_adult=false`;
  const data = await fetchTmdbJson<TmdbMovieSearchResponse>(url);
  return (data?.results || [])
    .filter((result): result is { id: number; title: string; release_date?: string } => Number.isInteger(result.id) && Boolean(result.title))
    .map((result) => ({ id: result.id, title: result.title, releaseDate: result.release_date }));
}

/** Resolves a movie through TMDB's stable external IMDb identifier. */
export async function findTmdbMovieByImdbId(imdbId: string, apiKey?: string): Promise<number | undefined> {
  const key = apiKey || (typeof process !== 'undefined' ? process.env?.TMDB_API_KEY : undefined);
  if (!key || !/^tt\d+$/.test(imdbId)) return undefined;
  const url = `https://api.themoviedb.org/3/find/${encodeURIComponent(imdbId)}?api_key=${encodeURIComponent(key)}&external_source=imdb_id`;
  const data = await fetchTmdbJson<TmdbFindResponse>(url);
  return data?.movie_results?.[0]?.id;
}

/** Fetches rich movie metadata server-side for import/refresh tooling. */
export async function fetchTmdbMovie(tmdbId: number, apiKey?: string): Promise<Partial<Movie> | null> {
  const key = apiKey || (typeof process !== 'undefined' ? process.env?.TMDB_API_KEY : undefined);
  if (!key) return null;

  const url = `https://api.themoviedb.org/3/movie/${tmdbId}?api_key=${encodeURIComponent(key)}&append_to_response=credits,videos,release_dates,external_ids`;
  try {
    const data = await fetchTmdbJson<TmdbMovieApiResponse>(url);
    if (!data) return null;
    const cast: CastMember[] | undefined = data.credits?.cast?.map((member) => ({
      actorId: String(member.id),
      name: member.name,
      character: member.character || '',
      slug: member.name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''),
      tmdbPersonId: member.id,
      profileUrl: tmdbImageUrl(member.profile_path),
      order: member.order,
    }));
    const crew: CrewMember[] | undefined = data.credits?.crew?.map((member) => ({
      id: member.id,
      name: member.name,
      job: member.job,
      creditId: member.credit_id,
    }));
    const releaseDates: ReleaseDateInfo[] | undefined = data.release_dates?.results?.flatMap((country) =>
      (country.release_dates || []).map((release) => ({
        country: country.iso_3166_1,
        releaseDate: release.release_date,
        type: release.type,
        certification: release.certification,
        note: release.note,
      }))
    );
    const videos: Trailer[] | undefined = data.videos?.results?.map((video) => ({
      key: video.key,
      site: video.site,
      type: video.type,
      name: video.name,
      official: video.official,
    }));
    const director = crew?.find((member) => member.job === 'Director')?.name;

    return {
      tmdbId: data.id,
      imdbId: data.external_ids?.imdb_id || undefined,
      title: data.title,
      originalTitle: data.original_title,
      synopsis: data.overview,
      releaseDate: data.release_date,
      runtimeMinutes: data.runtime || undefined,
      posterUrl: tmdbImageUrl(data.poster_path),
      backdropUrl: tmdbImageUrl(data.backdrop_path, 'w1280'),
      tagline: data.tagline || undefined,
      genres: data.genres,
      voteAverage: data.vote_average,
      voteCount: data.vote_count,
      trailers: videos,
      trailerYoutubeKey: videos?.find((video) => video.site === 'YouTube')?.key,
      releaseDates,
      cast,
      crew,
      director,
    };
  } catch (error) {
    console.error(`[TMDB] Error fetching movie ${tmdbId}:`, error);
    return null;
  }
}

/**
 * Server-side helper to fetch a single person's details from TMDB.
 * Never called from visitor browser.
 */
export async function fetchTmdbPerson(
  tmdbPersonId: number,
  apiKey?: string
): Promise<Partial<Actor> | null> {
  const key = apiKey || (typeof process !== 'undefined' ? process.env?.TMDB_API_KEY : undefined);
  if (!key) {
    console.warn(`[TMDB] No API key provided for fetching TMDB person ${tmdbPersonId}`);
    return null;
  }

  const url = `https://api.themoviedb.org/3/person/${tmdbPersonId}?api_key=${encodeURIComponent(
    key
  )}&append_to_response=external_ids,combined_credits`;

  try {
    const data = await fetchTmdbJson<TmdbPersonApiResponse>(url);
    if (!data) return null;

    const result: Partial<Actor> = {
      tmdbPersonId: data.id,
      name: data.name,
      gender: tmdbGenderLabel(data.gender),
      knownForDepartment: data.known_for_department?.trim() || undefined,
      alsoKnownAs: (data.also_known_as || []).map((name) => name.trim()).filter(Boolean),
    };

    const creditIds = new Set([
      ...(data.combined_credits?.cast || []).map((credit) => credit.id),
      ...(data.combined_credits?.crew || []).map((credit) => credit.id),
    ]);
    if (creditIds.size > 0) result.knownCredits = creditIds.size;

    if (data.birthday && data.birthday.trim().length > 0) {
      result.birthday = data.birthday.trim();
    }

    if (data.deathday && data.deathday.trim().length > 0) {
      result.deathday = data.deathday.trim();
    }

    if (data.place_of_birth && data.place_of_birth.trim().length > 0) {
      result.placeOfBirth = data.place_of_birth.trim();
    }

    if (data.biography && data.biography.trim().length > 0) {
      result.biography = data.biography.trim();
    }

    if (data.profile_path && data.profile_path.trim().length > 0) {
      const cleanPath = data.profile_path.startsWith('/') ? data.profile_path : `/${data.profile_path}`;
      result.profileUrl = `https://image.tmdb.org/t/p/w500${cleanPath}`;
    }

    const imdbId = data.imdb_id || data.external_ids?.imdb_id;
    if (imdbId && imdbId.trim().length > 0) {
      result.imdbPersonId = imdbId.trim();
    }

    if (data.external_ids?.instagram_id?.trim()) result.instagramId = data.external_ids.instagram_id.trim();
    if (data.external_ids?.twitter_id?.trim()) result.twitterId = data.external_ids.twitter_id.trim();
    if (data.external_ids?.facebook_id?.trim()) result.facebookId = data.external_ids.facebook_id.trim();

    return result;
  } catch (err) {
    console.error(`[TMDB] Error fetching person ${tmdbPersonId}:`, err);
    return null;
  }
}

/**
 * Deduplicates all actors in the catalogue by TMDB Person ID.
 * Avoids fetching the same person repeatedly when they appear in multiple catalogue movies.
 */
export function getCatalogueUniqueActors(): { tmdbPersonId: number; slug: string; name: string; profileUrl?: string }[] {
  const map = new Map<number, { tmdbPersonId: number; slug: string; name: string; profileUrl?: string }>();

  for (const movie of MOVIES) {
    for (const member of movie.cast) {
      const personId = member.tmdbPersonId || getTmdbPersonIdForSlug(member.slug);
      if (!map.has(personId)) {
        map.set(personId, {
          tmdbPersonId: personId,
          slug: member.slug,
          name: member.name,
          profileUrl: member.profileUrl,
        });
      }
    }
  }

  return Array.from(map.values());
}

/**
 * Executes a full refresh of catalogue actors from TMDB if TMDB_API_KEY is available.
 * Deduplicates actor IDs so no person is fetched repeatedly.
 * Persists results to src/data/actors.json.
 */
export async function refreshActorsFromTmdbPipeline(apiKey?: string): Promise<{
  totalCatalogueActors: number;
  updated: number;
  skipped: number;
  errors: number;
}> {
  const key = apiKey || (typeof process !== 'undefined' ? process.env?.TMDB_API_KEY : undefined);
  const catalogueActors = getCatalogueUniqueActors();
  if (!key) return { totalCatalogueActors: catalogueActors.length, updated: 0, skipped: catalogueActors.length, errors: 0 };

  const { enrichCataloguePeople } = await import('./person-enrichment');
  const result = await enrichCataloguePeople(MOVIES, key);

  return {
    totalCatalogueActors: catalogueActors.length,
    updated: result.updated,
    skipped: 0,
    errors: result.failures.length,
  };
}
