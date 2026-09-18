import 'dotenv/config';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { fetchTmdb } from './enrich-cast.js';
import { selectTrailerVideos } from './trailer-utils.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MOVIES_FILE = path.join(ROOT, 'movies.json');
const PUBLIC_MOVIES_FILE = path.join(ROOT, 'public', 'movies.json');
const UPCOMING_FILE = path.join(ROOT, 'upcoming.json');
const BACKUP_FILE = path.join(ROOT, 'movies.json.before-trailer-recovery.json');
const token = (process.env.TMDB_API_KEY || process.env.TMDB_TOKEN || process.env.TMDB_KEY || process.env.TMDB_BEARER_TOKEN || '').trim();

if (!token) {
  throw new Error('No TMDB credential configured. Set TMDB_API_KEY or TMDB_TOKEN in the environment or .env.');
}

const readJson = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const movieId = movie => Number(movie.tmdbId || movie.tmdb_id);

function writeAtomically(file, content) {
  const temporary = `${file}.tmp`;
  fs.writeFileSync(temporary, content, 'utf8');
  fs.renameSync(temporary, file);
}

const movies = readJson(MOVIES_FILE);
if (!Array.isArray(movies)) throw new Error('movies.json must contain an array.');
const originalMovies = readJson(MOVIES_FILE);
const upcomingHash = crypto.createHash('sha256').update(fs.readFileSync(UPCOMING_FILE)).digest('hex');

fs.copyFileSync(MOVIES_FILE, BACKUP_FILE);
let restored = 0;
let withoutVideos = 0;
let videoRecords = 0;

for (const [index, movie] of movies.entries()) {
  const id = movieId(movie);
  if (!Number.isSafeInteger(id) || id <= 0) throw new Error(`Invalid TMDB ID at movies.json index ${index}.`);
  const { data } = await fetchTmdb(`movie/${id}/videos`, {}, token);
  const videos = selectTrailerVideos(data?.results);
  if (videos.length > 0) {
    movie.videos = videos;
    restored++;
    videoRecords += videos.length;
  } else {
    withoutVideos++;
  }
  if (index < movies.length - 1) await new Promise(resolve => setTimeout(resolve, 100));
}

const content = `${JSON.stringify(movies, null, 2)}\n`;
const unchangedFields = movies.every((movie, index) => {
  const before = originalMovies[index];
  return Object.keys({ ...before, ...movie }).every(key => key === 'videos' || JSON.stringify(before[key]) === JSON.stringify(movie[key]));
});
if (!unchangedFields) {
  throw new Error('Trailer recovery validation failed.');
}

writeAtomically(MOVIES_FILE, content);
if (fs.existsSync(path.dirname(PUBLIC_MOVIES_FILE))) writeAtomically(PUBLIC_MOVIES_FILE, content);
const publicMatches = !fs.existsSync(PUBLIC_MOVIES_FILE) || fs.readFileSync(PUBLIC_MOVIES_FILE, 'utf8') === content;
const upcomingUnchanged = crypto.createHash('sha256').update(fs.readFileSync(UPCOMING_FILE)).digest('hex') === upcomingHash;
if (!publicMatches || !upcomingUnchanged) throw new Error('Trailer recovery output validation failed.');

console.log(`Trailer recovery complete: ${movies.length} collection movies checked.`);
console.log(`Videos restored for ${restored} movies; ${withoutVideos} had no TMDB trailers.`);
console.log(`Stored ${videoRecords} video records.`);
console.log(`Backup created: ${path.basename(BACKUP_FILE)}`);
console.log(`Non-video movie fields unchanged: ${unchangedFields}`);
console.log(`upcoming.json unchanged: ${upcomingUnchanged}`);
