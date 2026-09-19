import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getMovies, getUpcomingMovies, saveCatalogSources } from '../movie-storage.js';
import { loadPersonCache, savePersonCache } from './enrich-cast.js';
import { createSourceBackups } from './source-backups.js';
import { ingestTmdbMovie, normalizeMovieCrew, validateTmdbMovieImport } from './tmdb-movie.js';
import { refreshSeoOutput } from './refresh-seo.js';
import { getRadarrEligibleMovies, toRadarrEntry } from './generate-radarr-feeds.js';
import { localImagePath } from './local-assets.js';
import { getRefreshTargets } from './refresh-scope.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const token = (process.env.TMDB_API_KEY || process.env.TMDB_TOKEN || process.env.TMDB_KEY || process.env.TMDB_BEARER_TOKEN || '').trim();
const args = new Set(process.argv.slice(2));
const idsArg = process.argv.find(arg => arg.startsWith('--ids='));
const requestedIds = idsArg
  ? new Set(idsArg.slice('--ids='.length).split(',').map(Number).filter(Number.isSafeInteger))
  : null;
const dryRun = args.has('--dry-run');
const comingSoonOnly = args.has('--coming-soon-only');
const collectionOnly = args.has('--collection-only');

if (comingSoonOnly && collectionOnly) throw new Error('Choose only one refresh scope.');

if (!token) throw new Error('No TMDB credential configured. Set TMDB_API_KEY or TMDB_TOKEN.');

function readJson(file, fallback) {
  return fs.existsSync(path.join(ROOT, file)) ? JSON.parse(fs.readFileSync(path.join(ROOT, file), 'utf8')) : fallback;
}

function movieId(movie) {
  return Number(movie.tmdbId || movie.tmdb_id);
}

function changedFields(before, after) {
  const keys = new Set([...Object.keys(before || {}), ...Object.keys(after || {})]);
  keys.delete('lastTmdbRefresh');
  return [...keys].filter(key => {
    if (key === 'dateAdded') return false;
    if (key === 'crew') return !valuesEqual(normalizeMovieCrew(before?.crew), normalizeMovieCrew(after?.crew));
    return !valuesEqual(before?.[key], after?.[key]);
  });
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function populated(value) {
  return value !== null && value !== undefined && value !== '' && (!Array.isArray(value) || value.length > 0);
}

function valuesEqual(left, right) {
  if (!populated(left) && !populated(right)) return true;
  return JSON.stringify(left) === JSON.stringify(right);
}

function fieldValue(movie, field) {
  const aliases = {
    'original title': ['originalTitle', 'original_title'],
    'release date/release_dates': ['release_date', 'release_dates', 'premiereDate'],
    'IMDb ID': ['imdbId', 'imdb_id'],
    'videos/trailer': ['videos']
  };
  return aliases[field] ? aliases[field].map(key => movie[key]).find(populated) : movie[field];
}

function diffAudit(before, after, collection) {
  const fieldNames = {
    title: 'title',
    'original title': 'original title',
    overview: 'overview',
    year: 'year',
    'release date/release_dates': 'release date/release_dates',
    status: 'status',
    'IMDb ID': 'IMDb ID',
    genres: 'genres',
    cast: 'cast',
    crew: 'crew',
    'videos/trailer': 'videos/trailer',
    poster: 'poster',
    backdrop: 'backdrop'
  };
  const fields = [];
  for (const [label] of Object.entries(fieldNames)) {
    const beforeValue = label === 'crew' ? normalizeMovieCrew(fieldValue(before, label)) : fieldValue(before, label);
    const afterValue = label === 'crew' ? normalizeMovieCrew(fieldValue(after, label)) : fieldValue(after, label);
    if (!valuesEqual(beforeValue, afterValue)) fields.push(label);
  }
  const known = new Set(Object.values(fieldNames).flatMap(field => field === 'original title' ? ['originalTitle', 'original_title'] : field === 'release date/release_dates' ? ['release_date', 'release_dates', 'premiereDate'] : field === 'IMDb ID' ? ['imdbId', 'imdb_id'] : field === 'videos/trailer' ? ['videos'] : [field]));
  const other = [...new Set([...Object.keys(before), ...Object.keys(after)])].filter(key => !known.has(key) && !['dateAdded', 'lastTmdbRefresh'].includes(key) && !valuesEqual(before[key], after[key]));
  if (other.length) fields.push('other fields');

  const destructive = [];
  if (populated(before.videos) && !populated(after.videos)) destructive.push('remove existing trailer');
  if (Array.isArray(before.cast) && before.cast.length > (Array.isArray(after.cast) ? after.cast.length : 0)) destructive.push('reduce/remove existing cast');
  if (populated(fieldValue(before, 'IMDb ID')) && !populated(fieldValue(after, 'IMDb ID'))) destructive.push('remove IMDb ID');
  if (populated(before.poster) && !populated(after.poster)) destructive.push('remove poster');
  if (populated(before.backdrop) && !populated(after.backdrop)) destructive.push('remove backdrop');
  if (populated(fieldValue(before, 'release date/release_dates')) && !populated(fieldValue(after, 'release date/release_dates'))) destructive.push('remove release information');
  if (populated(before.premiereDate) && before.premiereDate !== after.premiereDate) destructive.push('overwrite Hallmark/manual premiere date');
  for (const key of new Set([...Object.keys(before), ...Object.keys(after)])) {
    if (['dateAdded', 'lastTmdbRefresh'].includes(key)) continue;
    if (populated(before[key]) && !populated(after[key])) destructive.push(`empty populated field: ${key}`);
  }
  if (before.status && after.status && before.status !== after.status) destructive.push('change Collection/Coming Soon membership');
  return { fields, other, destructive, collection };
}

function noWriteImage({ kind, id, filePath }) {
  return filePath
    ? { status: 'would-cache', path: localImagePath(kind, id) }
    : { status: 'missing', path: null };
}

function summarizePersonCache(before, after) {
  let added = 0;
  let updated = 0;
  let unchanged = 0;
  const comparable = value => {
    if (!value) return value;
    const { lastUpdated, ...rest } = value;
    return rest;
  };
  for (const id of new Set([...Object.keys(before), ...Object.keys(after)])) {
    if (!before[id]) added++;
    else if (JSON.stringify(comparable(before[id])) !== JSON.stringify(comparable(after[id]))) updated++;
    else unchanged++;
  }
  return { existing: Object.keys(before).length, added, updated, unchanged, wouldRewrite: added > 0 || updated > 0 };
}

if (!requestedIds?.size && args.has('--sample-only')) {
  throw new Error('--sample-only requires --ids=...; refusing an unbounded refresh.');
}

const movies = readJson('movies.json', []);
const upcoming = readJson('upcoming.json', []);
const personCache = loadPersonCache(ROOT);
const originalPersonCache = clone(personCache);
const targets = getRefreshTargets(movies, upcoming, {
  scope: comingSoonOnly ? 'coming-soon' : collectionOnly ? 'collection' : 'all',
  requestedIds
});
const report = {
  moviesChecked: targets.length,
  updated: 0,
  unchanged: 0,
  failed: 0,
  newTrailers: 0,
  castChanges: 0,
  releaseDateChanges: 0,
  posterChanges: 0,
  backdropChanges: 0,
  failures: [],
  dryRun,
  fieldChanges: Object.fromEntries(['title', 'original title', 'overview', 'year', 'release date/release_dates', 'status', 'IMDb ID', 'genres', 'cast', 'crew', 'videos/trailer', 'poster', 'backdrop', 'other fields'].map(field => [field, 0])),
  destructiveChanges: [],
  trailerRecovery: [],
  comingSoon: [],
  collectionCount: movies.length,
  comingSoonCount: upcoming.length,
  refreshScope: comingSoonOnly ? 'coming-soon' : collectionOnly ? 'collection' : 'all'
};

if (!dryRun) createSourceBackups(ROOT);

for (const target of targets) {
  const id = movieId(target.movie);
  if (!Number.isSafeInteger(id) || id <= 0) {
    report.failed++;
    report.failures.push({ title: target.movie.title, tmdbId: id, error: 'Invalid TMDB ID' });
    continue;
  }
  try {
    const before = JSON.parse(JSON.stringify(target.movie));
    const imported = await ingestTmdbMovie(id, {
      token,
      existing: target.movie,
      personCache,
      rootDir: ROOT,
      status: target.collection ? 'collection' : 'upcoming',
      refreshPeople: true,
      imageEnsurer: dryRun ? noWriteImage : undefined
    });
    validateTmdbMovieImport(imported.data, imported.movie, id);
    const fields = changedFields(before, imported.movie);
    const audit = diffAudit(before, imported.movie, target.collection);
    for (const field of audit.fields) report.fieldChanges[field]++;
    if (audit.destructive.length) report.destructiveChanges.push({ title: target.movie.title, tmdbId: id, changes: audit.destructive });
    Object.assign(target.movie, imported.movie);
    if (fields.length) report.updated++;
    else report.unchanged++;
    if (!before.videos?.length && imported.movie.videos?.length) report.newTrailers++;
    if (JSON.stringify(before.cast) !== JSON.stringify(imported.movie.cast)) report.castChanges++;
    if (before.release_date !== imported.movie.release_date) report.releaseDateChanges++;
    if (before.poster !== imported.movie.poster) report.posterChanges++;
    if (before.backdrop !== imported.movie.backdrop) report.backdropChanges++;
    if (!populated(before.videos) && imported.movie.videos?.length) {
      const trailer = imported.movie.videos[0];
      report.trailerRecovery.push({ title: imported.movie.title, year: imported.movie.year, tmdbId: id, name: trailer.name || '', key: trailer.key });
    }
    if (!target.collection) {
      const fieldsAdded = ['release date/release_dates', 'IMDb ID', 'poster', 'backdrop', 'cast', 'videos/trailer'].filter(field => audit.fields.includes(field));
      report.comingSoon.push({ title: imported.movie.title, year: imported.movie.year, tmdbId: id, provides: { releaseInformation: Boolean(imported.data.release_date || imported.data.release_dates?.results?.length), imdbId: Boolean(imported.data.external_ids?.imdb_id), poster: Boolean(imported.data.poster_path), backdrop: Boolean(imported.data.backdrop_path), castCount: imported.data.credits?.cast?.length || 0, trailer: Boolean(imported.movie.videos?.length) }, wouldUpdate: fieldsAdded });
    }
  } catch (error) {
    report.failed++;
    report.failures.push({ title: target.movie.title, tmdbId: id, error: error.message });
    console.warn(`[tmdb-refresh] ${target.movie.title || 'Untitled'} (${id}): ${error.message}`);
  }
}

if (!dryRun && report.updated + report.unchanged > 0) {
  savePersonCache(personCache, ROOT);
  saveCatalogSources(movies, upcoming);
  await refreshSeoOutput();
}

console.log('TMDB REFRESH');
console.log(`Movies checked: ${report.moviesChecked}`);
console.log(`Updated: ${report.updated}`);
console.log(`Unchanged: ${report.unchanged}`);
console.log(`Failed: ${report.failed}`);
console.log(`New trailers: ${report.newTrailers}`);
console.log(`Cast changes: ${report.castChanges}`);
console.log(`Release-date changes: ${report.releaseDateChanges}`);
console.log(`Poster changes: ${report.posterChanges}`);
console.log(`Backdrop changes: ${report.backdropChanges}`);
console.log(`Field changes: ${JSON.stringify(report.fieldChanges)}`);
console.log(`Destructive changes: ${JSON.stringify(report.destructiveChanges)}`);
console.log(`Trailer recovery opportunities: ${JSON.stringify(report.trailerRecovery)}`);
console.log(`Coming Soon audit: ${JSON.stringify(report.comingSoon)}`);
console.log(`Person cache audit: ${JSON.stringify(summarizePersonCache(originalPersonCache, personCache))}`);
const proposedRadarr = getRadarrEligibleMovies(movies, upcoming);
const duplicateIds = proposedRadarr.map(movie => String(movie.tmdbId || movie.tmdb_id)).filter((id, index, ids) => ids.indexOf(id) !== index);
console.log(`Radarr audit: ${JSON.stringify({ currentCount: JSON.parse(fs.readFileSync(path.join(ROOT, 'public/json/all.json'), 'utf8')).length, proposedCount: proposedRadarr.filter(movie => /^tt\d+$/i.test(String(movie.imdbId || movie.imdb_id || ''))).length, collectionCount: movies.length, comingSoonCount: upcoming.length, duplicateTmdbIds: [...new Set(duplicateIds)], candidatesOrPrivate: proposedRadarr.filter(movie => movie.candidate || movie.private || movie.status === 'candidate' || movie.status === 'private').map(movie => movie.title) })}`);
for (const failure of report.failures) console.log(`Failure: ${failure.title || 'Untitled'} (${failure.tmdbId}): ${failure.error}`);
if (report.failed) process.exitCode = 1;
