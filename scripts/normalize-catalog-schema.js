import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getMovies, getUpcomingMovies, saveCatalogSources } from '../movie-storage.js';
import { normalizeStoredMovie } from './tmdb-movie.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const checkOnly = process.argv.includes('--check') || process.argv.includes('--dry-run');

function normalize(list) {
  return list.map(normalizeStoredMovie);
}

function changed(before, after) {
  return JSON.stringify(before) !== JSON.stringify(after);
}

const movies = getMovies();
const upcoming = getUpcomingMovies();
const normalizedMovies = normalize(movies);
const normalizedUpcoming = normalize(upcoming);
const report = {
  moviesChanged: changed(movies, normalizedMovies),
  upcomingChanged: changed(upcoming, normalizedUpcoming),
  movieCount: movies.length,
  upcomingCount: upcoming.length
};

if (!checkOnly) saveCatalogSources(normalizedMovies, normalizedUpcoming);
console.log(`CATALOG SCHEMA NORMALIZATION${checkOnly ? ' CHECK' : ''}`);
console.log(JSON.stringify(report));
