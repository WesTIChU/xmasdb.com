import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { fetchTmdb } from './enrich-cast.js';
import { enrichMovieCast } from './enrich-movie-cast.js';
import { ensureCachedImage } from './local-assets.js';
import { selectTrailerVideos } from './trailer-utils.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const TMDB_MOVIE_APPEND = 'external_ids,credits,videos,release_dates';

function hasValue(value) {
  return value !== undefined && value !== null && value !== '';
}

function useArray(value, fallback) {
  return Array.isArray(value) && value.length > 0 ? value : (Array.isArray(fallback) ? fallback : []);
}

export function normalizeMovieCast(cast) {
  return (Array.isArray(cast) ? cast : []).map((credit, index) => ({
    id: credit?.id ?? null,
    name: credit?.name || '',
    character: credit?.character || '',
    order: credit?.order ?? index,
    profile_path: credit?.profile_path || null,
    birthday: credit?.birthday || null,
    deathday: credit?.deathday || null
  }));
}

export function normalizeMovieCrew(crew) {
  const normalized = (Array.isArray(crew) ? crew : []).map(credit => ({
    id: credit?.id === undefined || credit?.id === null || credit?.id === '' ? null : Number(credit.id),
    name: credit?.name || '',
    job: credit?.job || '',
    credit_id: credit?.credit_id || null
  }));
  const unique = new Map(normalized.map(credit => [JSON.stringify(credit), credit]));
  return [...unique.values()].sort((left, right) => {
    const job = left.job.localeCompare(right.job);
    if (job) return job;
    const leftId = Number.isFinite(left.id) ? left.id : Number.POSITIVE_INFINITY;
    const rightId = Number.isFinite(right.id) ? right.id : Number.POSITIVE_INFINITY;
    if (leftId !== rightId) return leftId - rightId;
    const credit = String(left.credit_id || '').localeCompare(String(right.credit_id || ''));
    if (credit) return credit;
    return left.name.localeCompare(right.name);
  });
}

export function normalizeMovieVideos(videos) {
  return (Array.isArray(videos) ? videos : []).map(video => ({
    key: video?.key || '',
    site: video?.site || '',
    type: video?.type || '',
    name: video?.name || '',
    official: Boolean(video?.official)
  }));
}

export function normalizeMovieReleaseDates(value) {
  if (Array.isArray(value)) {
    return value.map(release => ({
      country: release?.country || release?.iso_3166_1 || '',
      release_date: release?.release_date || '',
      type: release?.type ?? null,
      certification: release?.certification || '',
      note: release?.note || ''
    }));
  }
  return (value?.results || []).flatMap(group => (group.release_dates || []).map(release => ({
    country: group.iso_3166_1 || '',
    release_date: release.release_date || '',
    type: release.type ?? null,
    certification: release.certification || '',
    note: release.note || ''
  })));
}

export function normalizeStoredMovie(movie) {
  const next = { ...movie };
  if (Array.isArray(movie.cast)) next.cast = normalizeMovieCast(movie.cast);
  if (Array.isArray(movie.crew)) next.crew = normalizeMovieCrew(movie.crew);
  if (Array.isArray(movie.videos)) next.videos = normalizeMovieVideos(movie.videos);
  if (movie.release_dates !== undefined) next.release_dates = normalizeMovieReleaseDates(movie.release_dates);
  delete next.lastTmdbRefresh;
  return next;
}

export async function fetchCompleteTmdbMovie(tmdbId, token, fetcher = fetchTmdb) {
  const id = Number(tmdbId);
  if (!Number.isSafeInteger(id) || id <= 0) throw new Error(`Invalid TMDB movie ID: ${tmdbId}`);
  const { data } = await fetcher(`movie/${id}`, { append_to_response: TMDB_MOVIE_APPEND }, token);
  if (Number(data?.id) !== id) throw new Error(`Invalid TMDB movie response for ${id}`);
  return data;
}

/** @param {any} data @param {any} options @returns {any} */
export function normalizeTmdbMovie(data, { existing = {}, cast = null, rootDir = ROOT, status = null } = {}) {
  const rawVideos = selectTrailerVideos(data?.videos?.results);
  const next = normalizeStoredMovie(existing);
  const assign = (key, value) => {
    if (hasValue(value)) next[key] = value;
  };

  assign('title', data?.title);
  assign('originalTitle', data?.original_title);
  assign('year', data?.release_date ? Number(data.release_date.slice(0, 4)) : null);
  assign('release_date', data?.release_date);
  if (!hasValue(next.premiereDate) && data?.release_date) next.premiereDate = data.release_date;
  assign('tmdbId', data?.id);
  assign('tmdb_id', data?.id);
  assign('imdbId', data?.external_ids?.imdb_id);
  assign('imdb_id', data?.external_ids?.imdb_id);
  assign('overview', data?.overview);
  assign('vote_average', data?.vote_average);
  assign('vote_count', data?.vote_count);
  assign('tagline', data?.tagline);
  assign('runtime', data?.runtime);
  if (Array.isArray(data?.genres) && data.genres.length) next.genres = data.genres;
  const releaseDates = normalizeMovieReleaseDates(data?.release_dates);
  if (releaseDates.length) next.release_dates = releaseDates;
  if (data?.poster_path) next.poster = data.poster_path;
  if (data?.backdrop_path) next.backdrop = data.backdrop_path;
  if (Array.isArray(data?.credits?.crew) && data.credits.crew.length) next.crew = normalizeMovieCrew(data.credits.crew);
  if (Array.isArray(cast) && cast.length) next.cast = normalizeMovieCast(cast);
  else if (Array.isArray(data?.credits?.cast) && data.credits.cast.length) next.cast = normalizeMovieCast(data.credits.cast);
  if (Array.isArray(next.cast) && next.cast.length) next.castSummary = next.cast.slice(0, 8).map(person => person.name).join(', ');
  if (rawVideos.length) next.videos = normalizeMovieVideos(rawVideos.slice(0, 5));
  else if (!Array.isArray(next.videos)) next.videos = [];
  if (status) next.status = status;
  return next;
}

export function validateTmdbMovieImport(data, movie, id = data?.id) {
  const errors = [];
  if (Array.isArray(data?.credits?.cast) && data.credits.cast.length && !movie.cast?.length) errors.push('cast');
  if (Array.isArray(data?.videos?.results) && data.videos.results.some(video => video?.site === 'YouTube' && video.key && ['Trailer', 'Teaser'].includes(video.type)) && !movie.videos?.length) errors.push('videos');
  if (data?.external_ids?.imdb_id && !(movie.imdbId || movie.imdb_id)) errors.push('imdbId');
  if (data?.release_date && !movie.release_date) errors.push('release_date');
  if (data?.poster_path && !movie.poster) errors.push('poster');
  if (data?.backdrop_path && !movie.backdrop) errors.push('backdrop');
  if (errors.length) throw new Error(`TMDB data failed local validation for ${id}: missing ${errors.join(', ')}`);
  return true;
}

/** @param {any} tmdbId @param {any} options @returns {Promise<any>} */
export async function ingestTmdbMovie(tmdbId, {
  token = '',
  existing = {},
  rootDir = ROOT,
  personCache = {},
  status = null,
  refreshPeople = false,
  fetcher = fetchTmdb,
  castEnricher = enrichMovieCast,
  imageEnsurer = ensureCachedImage
} = {}) {
  const data = await fetchCompleteTmdbMovie(tmdbId, token, fetcher);
  const rawCast = Array.isArray(data.credits?.cast) ? data.credits.cast : [];
  const cast = await castEnricher(rawCast, {
    token,
    personCache,
    rootDir,
    forceRefresh: refreshPeople,
    imageEnsurer
  });
  const movie = normalizeTmdbMovie(data, { existing, cast, status, rootDir });
  const assets = {};
  for (const [kind, filePath] of [['poster', data.poster_path], ['backdrop', data.backdrop_path]]) {
    const existingPath = existing[kind];
    const result = await imageEnsurer({ kind, id: data.id, filePath, rootDir });
    assets[kind] = result;
    if (result.path) movie[kind] = result.path;
    else if (existingPath) movie[kind] = existingPath;
    else {
      delete movie[kind];
      if (filePath) throw new Error(`TMDB returned a ${kind}, but it could not be cached for ${data.id}.`);
    }
  }
  const availableVideos = selectTrailerVideos(data.videos?.results);
  if (!availableVideos.length && Array.isArray(existing.videos)) movie.videos = existing.videos;
  return {
    movie,
    data,
    personCache,
    assets,
    report: {
      tmdbId: Number(data.id),
      castFromTmdb: rawCast.length,
      castSaved: movie.cast?.length || 0,
      videosFromTmdb: availableVideos.length,
      videosSaved: movie.videos?.length || 0,
      posterFromTmdb: Boolean(data.poster_path),
      posterSaved: Boolean(movie.poster),
      backdropFromTmdb: Boolean(data.backdrop_path),
      backdropSaved: Boolean(movie.backdrop),
      releaseDatesFromTmdb: Boolean(data.release_dates?.results?.length),
      externalIdFromTmdb: Boolean(data.external_ids?.imdb_id)
    }
  };
}
