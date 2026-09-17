import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  fetchTmdb,
  fetchTmdbPerson,
  loadPersonCache,
  savePersonCache,
  enrichCastData
} from './enrich-cast.js';
import { ensureCachedImage } from './local-assets.js';
import { saveMoviesAndSync, saveUpcomingMovies, saveCastData } from '../movie-storage.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const token = (process.env.TMDB_API_KEY || process.env.TMDB_TOKEN || process.env.TMDB_KEY || process.env.TMDB_BEARER_TOKEN || '').trim();

function readJson(file, fallback) {
  const target = path.join(ROOT, file);
  return fs.existsSync(target) ? JSON.parse(fs.readFileSync(target, 'utf8')) : fallback;
}

if (!token) throw new Error('No TMDB credential configured. Set TMDB_API_KEY or TMDB_TOKEN.');

const movies = readJson('movies.json', []);
const upcoming = readJson('upcoming.json', []);
const refreshTargets = [...movies, ...upcoming];
const existingCast = readJson('cast.json', {});
const personCache = loadPersonCache(ROOT);
const refreshedMovieCast = {};
const personIds = new Set();
const today = new Date().toISOString().slice(0, 10);
const report = { moviesProcessed: 0, movieFailures: 0, postersDownloaded: 0, posterFailures: 0, peopleProcessed: 0, peopleFailures: 0, profilesDownloaded: 0, profileFailures: 0 };

for (const movie of refreshTargets) {
  const id = Number(movie.tmdbId || movie.tmdb_id);
  if (!Number.isSafeInteger(id) || id <= 0) continue;
  try {
    const { data } = await fetchTmdb(`movie/${id}`, { append_to_response: 'external_ids,credits,videos' }, token);
    const poster = await ensureCachedImage({ kind: 'poster', id, filePath: data.poster_path, rootDir: ROOT, force: true });
    if (poster.status === 'downloaded') report.postersDownloaded++;
    if (poster.status === 'failed') report.posterFailures++;
    Object.assign(movie, {
      title: data.title || movie.title,
      year: data.release_date ? Number(data.release_date.slice(0, 4)) : movie.year,
      release_date: data.release_date || movie.release_date || null,
      overview: data.overview || movie.overview || '',
      vote_average: Number.isFinite(Number(data.vote_average)) ? Number(data.vote_average) : null,
      vote_count: Number.isFinite(Number(data.vote_count)) ? Number(data.vote_count) : null,
      imdbId: data.external_ids?.imdb_id || movie.imdbId || null,
      imdb_id: data.external_ids?.imdb_id || movie.imdb_id || null,
      backdrop: data.backdrop_path ? `https://image.tmdb.org/t/p/w1280${data.backdrop_path}` : movie.backdrop || null,
      tagline: data.tagline || movie.tagline || null,
      runtime: data.runtime || movie.runtime || null,
      genres: Array.isArray(data.genres) ? data.genres : (movie.genres || []),
      videos: (data.videos?.results || []).filter(video => video.site === 'YouTube' && video.key).slice(0, 5).length > 0
        ? (data.videos.results || []).filter(video => video.site === 'YouTube' && video.key).slice(0, 5)
        : (movie.videos || [])
    });
    if (upcoming.includes(movie) && data.release_date) {
      movie.premiereDate = data.release_date;
    }
    if (data.release_date > today && Array.isArray(data.credits?.cast)) {
      movie.cast = data.credits.cast.map((credit, index) => ({
        id: credit.id,
        name: credit.name,
        character: credit.character || '',
        order: credit.order ?? index,
        profile_path: credit.profile_path || null
      }));
      movie.castSummary = movie.cast.slice(0, 8).map(credit => credit.name).join(', ');
    }
    if (poster.path) movie.poster = poster.path;
    refreshedMovieCast[String(id)] = data.credits?.cast || [];
    for (const credit of data.credits?.cast || []) if (credit.id) personIds.add(Number(credit.id));
    report.moviesProcessed++;
  } catch (error) {
    report.movieFailures++;
    console.warn(`Movie refresh failed for ${id}: ${error.message}`);
  }
}

saveMoviesAndSync(movies);

for (const id of personIds) {
  try {
    const person = await fetchTmdbPerson(id, token, personCache, true, ROOT);
    const image = await ensureCachedImage({ kind: 'person', id, filePath: person.profile_path, rootDir: ROOT, force: true });
    if (image.status === 'downloaded') report.profilesDownloaded++;
    if (image.status === 'failed') report.profileFailures++;
    if (image.path) {
      person.profile_path = image.path;
      person.profile = image.path;
    }
    report.peopleProcessed++;
  } catch (error) {
    report.peopleFailures++;
    console.warn(`Person refresh failed for ${id}: ${error.message}`);
  }
}

savePersonCache(personCache, ROOT);
for (const movie of upcoming) {
  movie.cast = (movie.cast || []).map(credit => {
    const person = personCache[String(credit.id)];
    return person ? { ...credit, birthday: person.birthday, deathday: person.deathday, profile_path: person.profile_path, profile: person.profile } : credit;
  });
}
saveUpcomingMovies(upcoming);
const castData = enrichCastData(refreshedMovieCast, personCache, ROOT);
saveCastData(castData);

console.log(`Monthly catalog refresh complete: ${JSON.stringify(report)}`);
