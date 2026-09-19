import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getMovies, getUpcomingMovies, saveCatalogSources } from '../movie-storage.js';
import { loadPersonCache, savePersonCache } from './enrich-cast.js';
import { ingestTmdbMovie, validateTmdbMovieImport } from './tmdb-movie.js';
import { refreshSeoOutput } from './refresh-seo.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MANIFEST_FILE = path.join(ROOT, 'catalog', 'movies.json');
const ALLOWED_STATUSES = new Set(['collection', 'coming-soon']);

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function movieId(movie) {
  return Number(movie.tmdbId || movie.tmdb_id);
}

export function validateManifest(manifest, { movies = [], upcoming = [] } = {}) {
  if (!Array.isArray(manifest)) throw new Error('catalog/movies.json must contain an array.');

  const seen = new Set();
  for (const [index, entry] of manifest.entries()) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      throw new Error(`Manifest entry ${index + 1} must be an object.`);
    }
    const keys = Object.keys(entry).sort();
    if (keys.length !== 2 || keys[0] !== 'status' || keys[1] !== 'tmdbId') {
      throw new Error(`Manifest entry ${index + 1} must contain only tmdbId and status.`);
    }
    if (!Number.isSafeInteger(entry.tmdbId) || entry.tmdbId <= 0) {
      throw new Error(`Manifest entry ${index + 1} has an invalid tmdbId.`);
    }
    if (!ALLOWED_STATUSES.has(entry.status)) {
      throw new Error(`Manifest entry ${index + 1} has invalid status "${entry.status}".`);
    }
    if (seen.has(entry.tmdbId)) throw new Error(`Manifest contains duplicate TMDB ID ${entry.tmdbId}.`);
    seen.add(entry.tmdbId);
  }

  return manifest;
}

export function createSyncPlan(manifest, movies, upcoming) {
  validateManifest(manifest, { movies, upcoming });
  const manifestIds = new Set(manifest.map(entry => entry.tmdbId));
  const collectionById = new Map();
  const upcomingById = new Map();
  for (const movie of movies) collectionById.set(movieId(movie), movie);
  for (const movie of upcoming) if (!collectionById.has(movieId(movie))) upcomingById.set(movieId(movie), movie);

  const additions = [];
  const statusChanges = [];
  for (const entry of manifest) {
    const id = entry.tmdbId;
    const currentStatus = collectionById.has(id) ? 'collection' : upcomingById.has(id) ? 'coming-soon' : null;
    if (!currentStatus) additions.push(entry);
    else if (currentStatus !== entry.status) statusChanges.push({ ...entry, from: currentStatus });
  }
  const removedIds = [...new Set([...movies, ...upcoming].map(movieId))]
    .filter(id => !manifestIds.has(id));
  return {
    additions,
    statusChanges,
    removedIds,
    duplicateUpcomingIds: upcoming.filter(movie => collectionById.has(movieId(movie))).map(movieId)
  };
}

export function prepareCatalogLists(movies, upcoming, plan) {
  const collectionIds = new Set(movies.map(movieId));
  const statusChangeIds = new Set(plan.statusChanges.map(entry => entry.tmdbId));
  const removedIds = new Set(plan.removedIds);
  return {
    movies: movies.filter(movie => !removedIds.has(movieId(movie)) && !plan.duplicateUpcomingIds.includes(movieId(movie)) && !statusChangeIds.has(movieId(movie))).map(clone),
    upcoming: upcoming.filter(movie => !removedIds.has(movieId(movie)) && !collectionIds.has(movieId(movie)) && !statusChangeIds.has(movieId(movie))).map(clone)
  };
}

function readManifest() {
  return JSON.parse(fs.readFileSync(MANIFEST_FILE, 'utf8'));
}

function tokenFromEnvironment() {
  return (process.env.TMDB_API_KEY || '').trim();
}

async function syncManifest({ token = tokenFromEnvironment(), dryRun = false } = {}) {
  const manifest = readManifest();
  const movies = getMovies();
  const upcoming = getUpcomingMovies();
  const plan = createSyncPlan(manifest, movies, upcoming);
  console.log(`Manifest: ${manifest.length} entries`);
  console.log(`Additions: ${plan.additions.length}`);
  console.log(`Status changes: ${plan.statusChanges.length}`);
  console.log(`Removals: ${plan.removedIds.length}`);
  console.log(`Duplicate upcoming records removed in canonical output: ${plan.duplicateUpcomingIds.length}`);
  if (dryRun) return plan;
  if (plan.additions.length + plan.statusChanges.length === 0 && plan.removedIds.length === 0 && plan.duplicateUpcomingIds.length === 0) {
    console.log('No catalog changes required.');
    return plan;
  }
  if (plan.additions.length + plan.statusChanges.length > 0 && !token) {
    throw new Error('No TMDB_API_KEY configured.');
  }

  const personCache = loadPersonCache(ROOT);
  const currentById = new Map(movies.map(movie => [movieId(movie), movie]));
  for (const movie of upcoming) if (!currentById.has(movieId(movie))) currentById.set(movieId(movie), movie);
  const changes = new Map([...plan.additions, ...plan.statusChanges].map(entry => [entry.tmdbId, entry]));
  const prepared = prepareCatalogLists(movies, upcoming, plan);
  const nextMovies = prepared.movies;
  const nextUpcoming = prepared.upcoming;

  for (const entry of manifest) {
    if (!changes.has(entry.tmdbId)) continue;
    const existing = currentById.get(entry.tmdbId) || {};
    const imported = await ingestTmdbMovie(entry.tmdbId, {
      token,
      existing,
      personCache,
      rootDir: ROOT,
      status: entry.status === 'collection' ? 'collection' : 'upcoming',
      refreshPeople: true
    });
    validateTmdbMovieImport(imported.data, imported.movie, entry.tmdbId);
    if (entry.status === 'collection') nextMovies.push(imported.movie);
    else nextUpcoming.push(imported.movie);
  }

  savePersonCache(personCache, ROOT);
  saveCatalogSources(nextMovies, nextUpcoming);
  await refreshSeoOutput();
  return plan;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = new Set(process.argv.slice(2));
  if (args.has('--validate-only')) {
    const manifest = readManifest();
    validateManifest(manifest, { movies: getMovies(), upcoming: getUpcomingMovies() });
    console.log(`Manifest valid: ${manifest.length} entries.`);
  } else {
    syncManifest({ dryRun: args.has('--dry-run') }).catch(error => {
      console.error(error.message);
      process.exitCode = 1;
    });
  }
}

export { syncManifest };
