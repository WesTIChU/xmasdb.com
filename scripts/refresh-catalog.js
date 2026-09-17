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
import { saveMoviesAndSync, saveCastData } from '../movie-storage.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const token = (process.env.TMDB_API_KEY || process.env.TMDB_TOKEN || process.env.TMDB_KEY || process.env.TMDB_BEARER_TOKEN || '').trim();

function readJson(file, fallback) {
  const target = path.join(ROOT, file);
  return fs.existsSync(target) ? JSON.parse(fs.readFileSync(target, 'utf8')) : fallback;
}

if (!token) throw new Error('No TMDB credential configured. Set TMDB_API_KEY or TMDB_TOKEN.');

const movies = readJson('movies.json', []);
const existingCast = readJson('cast.json', {});
const personCache = loadPersonCache(ROOT);
const refreshedMovieCast = {};
const personIds = new Set();
const report = { moviesProcessed: 0, movieFailures: 0, postersDownloaded: 0, posterFailures: 0, peopleProcessed: 0, peopleFailures: 0, profilesDownloaded: 0, profileFailures: 0 };

for (const movie of movies) {
  const id = Number(movie.tmdbId || movie.tmdb_id);
  if (!Number.isSafeInteger(id) || id <= 0) continue;
  try {
    const { data } = await fetchTmdb(`movie/${id}`, { append_to_response: 'external_ids,credits' }, token);
    const poster = await ensureCachedImage({ kind: 'poster', id, filePath: data.poster_path, rootDir: ROOT, force: true });
    if (poster.status === 'downloaded') report.postersDownloaded++;
    if (poster.status === 'failed') report.posterFailures++;
    Object.assign(movie, {
      title: data.title || movie.title,
      year: data.release_date ? Number(data.release_date.slice(0, 4)) : movie.year,
      overview: data.overview || movie.overview || '',
      vote_average: Number.isFinite(Number(data.vote_average)) ? Number(data.vote_average) : null,
      vote_count: Number.isFinite(Number(data.vote_count)) ? Number(data.vote_count) : null,
      imdbId: data.external_ids?.imdb_id || movie.imdbId || null,
      imdb_id: data.external_ids?.imdb_id || movie.imdb_id || null
    });
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
const castData = enrichCastData(refreshedMovieCast, personCache, ROOT);
saveCastData(castData);

console.log(`Monthly catalog refresh complete: ${JSON.stringify(report)}`);
