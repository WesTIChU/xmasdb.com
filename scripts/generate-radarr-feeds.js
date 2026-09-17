import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const MOVIES_FILE = path.join(ROOT, 'movies.json');
const UPCOMING_FILE = path.join(ROOT, 'upcoming.json');
const CAST_FILE = path.join(ROOT, 'cast.json');
const FEED_DIRS = [path.join(ROOT, 'json'), path.join(ROOT, 'public', 'json'), path.join(ROOT, 'dist', 'json')];
const ACTOR_DIRS = FEED_DIRS.map(dir => path.join(dir, 'actors'));
const IMDB_PATTERN = /^tt\d+$/i;

const movieId = movie => String(movie?.tmdbId || movie?.tmdb_id || '');
const imdbId = movie => String(movie?.imdbId || movie?.imdb_id || '').trim();
export const toRadarrEntry = movie => ({
  title: `${movie.title}${movie.year ? ` (${movie.year})` : ''}`,
  imdb_id: imdbId(movie),
});

function uniqueRadarrMovies(movies, skipped) {
  const seen = new Set();
  const result = [];
  for (const movie of movies) {
    const id = movieId(movie);
    const imdb = imdbId(movie);
    if (!id || seen.has(id)) continue;
    if (!movie?.title || !IMDB_PATTERN.test(imdb)) {
      skipped.add(`${id || 'unknown'}: ${movie?.title || 'Untitled'}`);
      continue;
    }
    seen.add(id);
    result.push(toRadarrEntry(movie));
  }
  return result;
}

function writeFeed(file, entries) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(entries, null, 2)}\n`, 'utf8');
}

function removeStaleFiles(directory, expected) {
  if (!fs.existsSync(directory)) return;
  for (const file of fs.readdirSync(directory)) {
    if (/^(?:\d+|all)\.json$/.test(file) && !expected.has(file)) fs.unlinkSync(path.join(directory, file));
  }
}

function validateFeed(entries, label) {
  const ids = new Set();
  for (const entry of entries) {
    if (Object.keys(entry).length !== 2 || !entry.title || !IMDB_PATTERN.test(entry.imdb_id)) {
      throw new Error(`Invalid StevenLu entry in ${label}`);
    }
    if (ids.has(entry.imdb_id)) throw new Error(`Duplicate movie in ${label}: ${entry.imdb_id}`);
    ids.add(entry.imdb_id);
  }
}

export function getRadarrEligibleMovies(collectionMovies = [], comingSoonMovies = []) {
  const byTmdbId = new Map();
  for (const movie of [...collectionMovies, ...comingSoonMovies]) {
    const id = movieId(movie);
    if (id && !byTmdbId.has(id)) byTmdbId.set(id, movie);
  }
  return [...byTmdbId.values()];
}

export function getRadarrActorMovieIds(movies, castData, comingSoonMovies = [], collectionMovies = []) {
  const movieById = new Map(movies.map(movie => [movieId(movie), movie]));
  const actorMovieIds = new Map();
  const addCast = (id, cast) => {
    if (!movieById.has(id) || !Array.isArray(cast)) return;
    for (const person of cast) {
      const actorId = String(person?.id || '');
      if (!/^\d+$/.test(actorId)) continue;
      if (!actorMovieIds.has(actorId)) actorMovieIds.set(actorId, new Set());
      actorMovieIds.get(actorId).add(id);
    }
  };

  const castByMovie = castData?.castByMovieId || castData?.movieCast || {};
  for (const [id, cast] of Object.entries(castByMovie)) addCast(id, cast);
  const collectionIds = new Set(collectionMovies.map(movieId).filter(Boolean));
  for (const movie of comingSoonMovies) {
    const id = movieId(movie);
    if (!collectionIds.has(id)) addCast(id, movie.cast);
  }
  return actorMovieIds;
}

export function generateRadarrFeeds(movies, castData, comingSoonMovies = []) {
  const skipped = new Set();
  const eligibleMovies = getRadarrEligibleMovies(movies, comingSoonMovies);
  const sortedMovies = eligibleMovies.sort((a, b) => Number(b.year || 0) - Number(a.year || 0) || String(a.title || '').localeCompare(String(b.title || '')));
  const allEntries = uniqueRadarrMovies(sortedMovies, skipped);
  const years = [...new Set(sortedMovies.map(movie => Number(movie.year)).filter(Boolean))].sort((a, b) => b - a);
  const yearEntries = new Map(years.map(year => [year, uniqueRadarrMovies(sortedMovies.filter(movie => Number(movie.year) === year), skipped)]));

  const movieById = new Map(sortedMovies.map(movie => [movieId(movie), movie]));
  const actorMovieIds = getRadarrActorMovieIds(sortedMovies, castData, comingSoonMovies, movies);

  const expectedYears = new Set(years.map(year => `${year}.json`));
  const expectedActors = new Set();
  const outputs = [
    { file: 'all.json', entries: allEntries },
    ...yearEntries.entries().map(([year, entries]) => ({ file: `${year}.json`, entries })),
  ];
  for (const { file, entries } of outputs) {
    validateFeed(entries, file);
    for (const dir of FEED_DIRS) writeFeed(path.join(dir, file), entries);
  }

  for (const [actorId, ids] of actorMovieIds) {
    const entries = uniqueRadarrMovies([...ids].map(id => movieById.get(id)), skipped);
    if (!entries.length) continue;
    validateFeed(entries, `actors/${actorId}.json`);
    expectedActors.add(`${actorId}.json`);
    for (const dir of ACTOR_DIRS) writeFeed(path.join(dir, `${actorId}.json`), entries);
  }

  for (const dir of FEED_DIRS) removeStaleFiles(dir, new Set(['all.json', ...expectedYears]));
  for (const dir of ACTOR_DIRS) removeStaleFiles(dir, expectedActors);

  if (skipped.size) {
    console.warn(`[radarr-feeds] Skipped ${skipped.size} catalogue movies without a valid IMDb ID:`);
    for (const item of skipped) console.warn(`[radarr-feeds] ${item}`);
  }
  console.log(`[radarr-feeds] Generated full feed, ${yearEntries.size} year feeds, and ${expectedActors.size} actor feeds.`);
  console.log(`[radarr-feeds] Skipped movies: ${skipped.size}`);
  return { full: allEntries.length, years: yearEntries.size, actors: expectedActors.size, skipped: [...skipped] };
}

if (process.argv[1] === new URL(import.meta.url).pathname) {
  const movies = JSON.parse(fs.readFileSync(MOVIES_FILE, 'utf8'));
  const castData = JSON.parse(fs.readFileSync(CAST_FILE, 'utf8'));
  const upcoming = fs.existsSync(UPCOMING_FILE) ? JSON.parse(fs.readFileSync(UPCOMING_FILE, 'utf8')) : [];
  generateRadarrFeeds(movies, castData, upcoming);
}
