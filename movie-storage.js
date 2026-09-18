/**
 * Movie Storage & Static Feed Generator Utility
 * 
 * Manages movies.json and automatically generates all per-year feeds
 * (json/YYYY.json) in both root and public/ directories.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { enrichCastData } from './scripts/enrich-cast.js';
import { generateRadarrFeeds } from './scripts/generate-radarr-feeds.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ROOT_DIR = __dirname;
const MOVIES_JSON_PATH = path.join(ROOT_DIR, 'movies.json');
const PUBLIC_MOVIES_JSON_PATH = path.join(ROOT_DIR, 'public', 'movies.json');
const DIST_MOVIES_JSON_PATH = path.join(ROOT_DIR, 'dist', 'movies.json');
const UPCOMING_JSON_PATH = path.join(ROOT_DIR, 'upcoming.json');
const PUBLIC_UPCOMING_JSON_PATH = path.join(ROOT_DIR, 'public', 'upcoming.json');
const DIST_UPCOMING_JSON_PATH = path.join(ROOT_DIR, 'dist', 'upcoming.json');
const CAST_JSON_PATH = path.join(ROOT_DIR, 'cast.json');
const PUBLIC_CAST_JSON_PATH = path.join(ROOT_DIR, 'public', 'cast.json');
const DIST_CAST_JSON_PATH = path.join(ROOT_DIR, 'dist', 'cast.json');
const CAST_SEED_PATH = path.join(ROOT_DIR, 'cast-seed.json');
const JSON_DIR = path.join(ROOT_DIR, 'json');
const PUBLIC_JSON_DIR = path.join(ROOT_DIR, 'public', 'json');
const DIST_JSON_DIR = path.join(ROOT_DIR, 'dist', 'json');
const ACTOR_JSON_DIR = path.join(JSON_DIR, 'actors');
const PUBLIC_ACTOR_JSON_DIR = path.join(PUBLIC_JSON_DIR, 'actors');
const DIST_ACTOR_JSON_DIR = path.join(DIST_JSON_DIR, 'actors');

/**
 * Reads current master movies.json
 */
export function getMovies() {
  if (!fs.existsSync(MOVIES_JSON_PATH)) {
    return [];
  }
  try {
    const raw = fs.readFileSync(MOVIES_JSON_PATH, 'utf8');
    return JSON.parse(raw);
  } catch (err) {
    console.error('Error reading movies.json:', err);
    return [];
  }
}

/**
 * Saves movies array and automatically regenerates all yearly JSON files
 */
export function saveMoviesAndSync(movies) {
  const today = new Date().toISOString().slice(0, 10);
  const scheduled = movies.filter(movie => String(movie.release_date || '').slice(0, 10) > today);
  const catalogMovies = movies.filter(movie => !scheduled.includes(movie));

  // Sort movies by year descending, then title ascending
  const sorted = [...catalogMovies].sort((a, b) => {
    const yearA = a.year || 0;
    const yearB = b.year || 0;
    if (yearB !== yearA) return yearB - yearA;
    return (a.title || '').localeCompare(b.title || '');
  });

  const jsonContent = JSON.stringify(sorted, null, 2);

  // 1. Write root movies.json
  fs.writeFileSync(MOVIES_JSON_PATH, jsonContent, 'utf8');

  // 2. Write public/movies.json and dist/movies.json if directories exist
  const publicDir = path.join(ROOT_DIR, 'public');
  if (fs.existsSync(publicDir)) {
    fs.writeFileSync(PUBLIC_MOVIES_JSON_PATH, jsonContent, 'utf8');
  }
  const distDir = path.join(ROOT_DIR, 'dist');
  if (fs.existsSync(distDir)) {
    fs.writeFileSync(DIST_MOVIES_JSON_PATH, jsonContent, 'utf8');
  }

  // 3. Ensure json directories exist
  if (!fs.existsSync(JSON_DIR)) fs.mkdirSync(JSON_DIR, { recursive: true });
  if (fs.existsSync(publicDir) && !fs.existsSync(PUBLIC_JSON_DIR)) {
    fs.mkdirSync(PUBLIC_JSON_DIR, { recursive: true });
  }
  if (fs.existsSync(distDir) && !fs.existsSync(DIST_JSON_DIR)) {
    fs.mkdirSync(DIST_JSON_DIR, { recursive: true });
  }

  // 4. Extract active years
  const activeYears = [...new Set(sorted.map(m => m.year).filter(Boolean))].sort((a, b) => b - a);

  // Clean existing yearly json files that are no longer active
  const cleanObsoleteYearFiles = (dir) => {
    if (!fs.existsSync(dir)) return;
    const files = fs.readdirSync(dir);
    for (const file of files) {
      if (file.endsWith('.json')) {
        const yearStr = file.replace('.json', '');
        const yearNum = parseInt(yearStr, 10);
        if (!isNaN(yearNum) && !activeYears.includes(yearNum)) {
          try {
            fs.unlinkSync(path.join(dir, file));
          } catch (e) {
            // ignore
          }
        }
      }
    }
  };

  cleanObsoleteYearFiles(JSON_DIR);
  if (fs.existsSync(publicDir)) cleanObsoleteYearFiles(PUBLIC_JSON_DIR);
  if (fs.existsSync(distDir)) cleanObsoleteYearFiles(DIST_JSON_DIR);

  // 5. Generate each yearly json file
  activeYears.forEach(year => {
    const yearMovies = sorted.filter(m => m.year === year);
    const yearContent = JSON.stringify(yearMovies, null, 2);

    fs.writeFileSync(path.join(JSON_DIR, `${year}.json`), yearContent, 'utf8');
    if (fs.existsSync(publicDir)) {
      fs.writeFileSync(path.join(PUBLIC_JSON_DIR, `${year}.json`), yearContent, 'utf8');
    }
    if (fs.existsSync(distDir)) {
      fs.writeFileSync(path.join(DIST_JSON_DIR, `${year}.json`), yearContent, 'utf8');
    }
  });

  // 6. Automatically regenerate cast.json whenever movie collection changes
  syncScheduledUpcomingMovies(scheduled);
  const castData = regenerateCastJson();
  generateRadarrFeeds(sorted, castData, getUpcomingMovies());

  return {
    count: sorted.length,
    years: activeYears,
    movies: sorted
  };
}

/**
 * Add a movie to collection with duplicate check
 */
export function addMovie(newMovie, castArray = null) {
  const current = getMovies();
  
  // Prevent duplicates by TMDB ID or IMDb ID
  const isDuplicate = current.some(m => {
    if (newMovie.tmdbId && m.tmdbId && Number(m.tmdbId) === Number(newMovie.tmdbId)) return true;
    if (newMovie.tmdb_id && m.tmdb_id && Number(m.tmdb_id) === Number(newMovie.tmdb_id)) return true;
    if (newMovie.imdbId && m.imdbId && m.imdbId.trim().toLowerCase() === newMovie.imdbId.trim().toLowerCase()) return true;
    return false;
  });

  if (isDuplicate) {
    const err = new Error(`Movie "${newMovie.title}" (TMDB ID: ${newMovie.tmdbId}) is already in the collection.`);
    err.code = 'DUPLICATE';
    throw err;
  }

  // Standardize movie format
  const movieToAdd = normalizeCollectionMovie(newMovie, castArray);

  if (newMovie.originalTitle || newMovie.original_title) {
    const orig = (newMovie.originalTitle || newMovie.original_title).trim();
    if (orig && orig.toLowerCase() !== (newMovie.title || '').trim().toLowerCase()) {
      movieToAdd.originalTitle = orig;
    }
  }

  current.push(movieToAdd);
  const syncResult = saveMoviesAndSync(current);

  if (castArray && Array.isArray(castArray) && movieToAdd.tmdbId) {
    updateMovieCast(movieToAdd.tmdbId, castArray);
  }

  return syncResult;
}

export function normalizeCollectionMovie(newMovie, castArray = null) {
  return {
    title: newMovie.title,
    year: newMovie.year ? parseInt(newMovie.year, 10) : null,
    tmdbId: newMovie.tmdbId ? Number(newMovie.tmdbId) : (newMovie.tmdb_id ? Number(newMovie.tmdb_id) : null),
    imdbId: newMovie.imdbId || newMovie.imdb_id || null,
    tmdb_id: newMovie.tmdbId ? Number(newMovie.tmdbId) : (newMovie.tmdb_id ? Number(newMovie.tmdb_id) : null),
    imdb_id: newMovie.imdbId || newMovie.imdb_id || null,
    release_date: newMovie.release_date || newMovie.releaseDate || null,
    poster: newMovie.poster || null,
    overview: newMovie.overview || '',
    videos: Array.isArray(newMovie.videos) ? newMovie.videos : [],
    cast: Array.isArray(castArray) ? castArray : [],
    castSummary: Array.isArray(castArray) ? castArray.slice(0, 8).map(person => person.name).join(', ') : '',
    vote_average: Number.isFinite(Number(newMovie.vote_average)) ? Number(newMovie.vote_average) : null,
    vote_count: Number.isFinite(Number(newMovie.vote_count)) ? Number(newMovie.vote_count) : null
  };
}

export function syncScheduledUpcomingMovies(movies = getMovies()) {
  const today = new Date().toISOString().slice(0, 10);
  const current = getUpcomingMovies();
  const byTmdbId = new Map(current.filter(movie => movie.tmdbId).map(movie => [String(movie.tmdbId), movie]));
  let changed = false;

  for (const movie of movies) {
    const id = Number(movie.tmdbId || movie.tmdb_id);
    const releaseDate = String(movie.release_date || '').slice(0, 10);
    if (!Number.isSafeInteger(id) || !releaseDate || releaseDate <= today) continue;

    const existing = byTmdbId.get(String(id));
    if (existing) {
      if (existing.premiereDate !== releaseDate || existing.release_date !== releaseDate) {
        existing.premiereDate = releaseDate;
        existing.release_date = releaseDate;
        changed = true;
      }
      if (Array.isArray(movie.cast) && movie.cast.length > (Array.isArray(existing.cast) ? existing.cast.length : 0)) {
        existing.cast = movie.cast;
        existing.castSummary = movie.castSummary || movie.cast.slice(0, 8).map(person => person.name).join(', ');
        changed = true;
      }
      continue;
    }

    const upcoming = {
      id: `tmdb-${id}`,
      title: movie.title,
      hallmarkTitle: movie.title,
      year: Number(movie.year) || Number(releaseDate.slice(0, 4)),
      premiereDate: releaseDate,
      release_date: releaseDate,
      announcementDate: 'TMDB release date',
      tmdbId: id,
      imdbId: movie.imdbId || movie.imdb_id || null,
      imdb_id: movie.imdbId || movie.imdb_id || null,
      poster: movie.poster || null,
      overview: movie.overview || '',
      cast: Array.isArray(movie.cast) ? movie.cast : [],
      castSummary: movie.castSummary || '',
      backdrop: movie.backdrop || null,
      tagline: movie.tagline || null,
      runtime: movie.runtime || null,
      genres: Array.isArray(movie.genres) ? movie.genres : [],
      videos: Array.isArray(movie.videos) ? movie.videos : [],
      hallmarkUrl: null,
      dateAdded: new Date().toISOString(),
    };
    current.push(upcoming);
    byTmdbId.set(String(id), upcoming);
    changed = true;
  }

  return changed ? saveUpcomingMovies(current) : current;
}

/**
 * Remove a movie from collection by TMDB ID
 */
export function removeMovie(tmdbId) {
  const current = getMovies();
  const idNum = Number(tmdbId);
  const initialCount = current.length;

  const filtered = current.filter(m => Number(m.tmdbId) !== idNum && Number(m.tmdb_id) !== idNum);

  if (filtered.length === initialCount) {
    const err = new Error(`Movie with TMDB ID ${tmdbId} not found in collection.`);
    err.code = 'NOT_FOUND';
    throw err;
  }

  return saveMoviesAndSync(filtered);
}

// ============================================================================
// Upcoming Movies Management
// ============================================================================

export function getUpcomingMovies() {
  if (!fs.existsSync(UPCOMING_JSON_PATH)) {
    return [];
  }
  try {
    const raw = fs.readFileSync(UPCOMING_JSON_PATH, 'utf8');
    return JSON.parse(raw);
  } catch (err) {
    console.error('Error reading upcoming.json:', err);
    return [];
  }
}

export function saveUpcomingMovies(upcomingList) {
  // Sort upcoming movies: confirmed premiere date first (earliest first), then TBA
  const sorted = [...upcomingList].sort((a, b) => {
    const dateA = a.premiereDate || a.release_date || '';
    const dateB = b.premiereDate || b.release_date || '';
    if (dateA && !dateB) return -1;
    if (!dateA && dateB) return 1;
    if (dateA && dateB) {
      const parsedA = Date.parse(dateA);
      const parsedB = Date.parse(dateB);
      if (!isNaN(parsedA) && !isNaN(parsedB)) {
        return parsedA - parsedB;
      }
      return dateA.localeCompare(dateB);
    }
    return (a.title || a.hallmarkTitle || '').localeCompare(b.title || b.hallmarkTitle || '');
  });

  const content = JSON.stringify(sorted, null, 2);
  fs.writeFileSync(UPCOMING_JSON_PATH, content, 'utf8');

  const publicDir = path.join(ROOT_DIR, 'public');
  if (fs.existsSync(publicDir)) {
    fs.writeFileSync(PUBLIC_UPCOMING_JSON_PATH, content, 'utf8');
  }
  const distDir = path.join(ROOT_DIR, 'dist');
  if (fs.existsSync(distDir)) {
    fs.writeFileSync(DIST_UPCOMING_JSON_PATH, content, 'utf8');
  }

  generateRadarrFeeds(getMovies(), getCastData(), sorted);
  return sorted;
}

export function addUpcomingMovie(movie) {
  const current = getUpcomingMovies();
  const targetId = movie.tmdbId ? Number(movie.tmdbId) : null;
  const targetTitle = (movie.title || movie.hallmarkTitle || '').toLowerCase().trim();

  // Check duplicate in upcoming
  const isDuplicate = current.some(m => {
    if (targetId && m.tmdbId && Number(m.tmdbId) === targetId) return true;
    const mTitle = (m.title || m.hallmarkTitle || '').toLowerCase().trim();
    return mTitle === targetTitle;
  });

  if (isDuplicate) {
    const err = new Error(`Upcoming movie "${movie.title || movie.hallmarkTitle}" is already in the upcoming list.`);
    err.code = 'DUPLICATE';
    throw err;
  }

  const upcomingItem = {
    id: movie.id || (targetId ? `tmdb-${targetId}` : `up-${Date.now()}`),
    title: movie.title || movie.hallmarkTitle || 'Untitled Upcoming Movie',
    hallmarkTitle: movie.hallmarkTitle || movie.title || '',
    year: movie.year ? parseInt(movie.year, 10) : new Date().getFullYear(),
    premiereDate: movie.premiereDate || null,
    release_date: movie.release_date || null,
    announcementDate: movie.announcementDate || 'Recently Announced',
    tmdbId: targetId,
    imdbId: movie.imdbId || null,
    poster: movie.poster || null,
    overview: movie.overview || movie.description || '',
    cast: Array.isArray(movie.cast) ? movie.cast : [],
    castSummary: movie.castSummary || '',
    hallmarkUrl: movie.hallmarkUrl || movie.pageUrl || null,
    dateAdded: new Date().toISOString()
  };

  current.push(upcomingItem);
  return saveUpcomingMovies(current);
}

export function removeUpcomingMovie(id) {
  const current = getUpcomingMovies();
  const filtered = current.filter(m => String(m.id) !== String(id) && String(m.tmdbId) !== String(id));
  return saveUpcomingMovies(filtered);
}

export function updateUpcomingMovie(id, updates) {
  const current = getUpcomingMovies();
  const index = current.findIndex(m => String(m.id) === String(id) || String(m.tmdbId) === String(id));
  if (index === -1) {
    throw new Error(`Upcoming movie with ID ${id} not found.`);
  }
  current[index] = { ...current[index], ...updates };
  return saveUpcomingMovies(current);
}

export function promoteUpcomingToCollection(id, movieData = null, castArray = null) {
  const currentUpcoming = getUpcomingMovies();
  const index = currentUpcoming.findIndex(m => String(m.id) === String(id) || String(m.tmdbId) === String(id));
  
  let movieToPromote = movieData;
  if (index !== -1) {
    const upcomingItem = currentUpcoming[index];
    movieToPromote = {
      title: upcomingItem.title,
      year: upcomingItem.year,
      tmdbId: upcomingItem.tmdbId,
      imdbId: upcomingItem.imdbId,
      poster: upcomingItem.poster,
      overview: upcomingItem.overview,
      ...movieData
    };
    currentUpcoming.splice(index, 1);
    saveUpcomingMovies(currentUpcoming);
  }

  if (!movieToPromote || !movieToPromote.title) {
    throw new Error('Movie data is required to promote to collection.');
  }

  return addMovie(movieToPromote, castArray);
}

// ============================================================================
// Popular Actors / Cast Management
// ============================================================================

export function getCastData() {
  if (!fs.existsSync(CAST_JSON_PATH)) {
    return regenerateCastJson();
  }
  try {
    return JSON.parse(fs.readFileSync(CAST_JSON_PATH, 'utf8'));
  } catch {
    return regenerateCastJson();
  }
}

export function saveCastData(castData) {
  const content = JSON.stringify(castData, null, 2);
  fs.writeFileSync(CAST_JSON_PATH, content, 'utf8');

  const publicDir = path.join(ROOT_DIR, 'public');
  if (fs.existsSync(publicDir)) {
    fs.writeFileSync(PUBLIC_CAST_JSON_PATH, content, 'utf8');
  }
  const distDir = path.join(ROOT_DIR, 'dist');
  if (fs.existsSync(distDir)) {
    fs.writeFileSync(DIST_CAST_JSON_PATH, content, 'utf8');
  }
  generateRadarrFeeds(getMovies(), castData, getUpcomingMovies());
  return castData;
}

/**
 * Generates collection-only movie feeds keyed by TMDB person ID.
 */
export function generateActorJsonFeeds(movies = getMovies(), castData = getCastData()) {
  const movieById = new Map();
  for (const movie of movies) {
    const id = Number(movie.tmdbId || movie.tmdb_id);
    if (Number.isSafeInteger(id) && id > 0) movieById.set(String(id), movie);
  }
  const actors = new Map((castData.actors || []).filter(actor => actor?.id).map(actor => [String(Number(actor.id)), actor]));
  const moviesByActor = new Map();
  const errors = [];
  const associations = new Set();
  const castByMovie = castData.castByMovieId || castData.movieCast || {};

  for (const [movieId, cast] of Object.entries(castByMovie)) {
    if (!movieById.has(movieId) || !Array.isArray(cast)) continue;
    const seenPeople = new Set();
    for (const person of cast) {
      const personId = Number(person?.id);
      if (!Number.isSafeInteger(personId) || personId <= 0) continue;
      const personKey = String(personId);
      if (seenPeople.has(personKey)) continue;
      seenPeople.add(personKey);
      associations.add(`${personKey}:${movieId}`);
      if (!actors.has(personKey)) {
        errors.push(`Person ${personId} in movie ${movieId} has no actor record in cast.json`);
        continue;
      }
      if (!moviesByActor.has(personKey)) moviesByActor.set(personKey, new Set());
      moviesByActor.get(personKey).add(movieId);
    }
  }

  const feedDirs = [ACTOR_JSON_DIR, PUBLIC_ACTOR_JSON_DIR, DIST_ACTOR_JSON_DIR];
  for (const dir of feedDirs) if (fs.existsSync(path.dirname(dir))) fs.mkdirSync(dir, { recursive: true });
  const generated = new Set();
  let largest = { personId: null, count: 0 };
  let skipped = 0;
  for (const [personId, movieIds] of moviesByActor) {
    const feedMovies = movies.filter(movie => movieIds.has(String(Number(movie.tmdbId || movie.tmdb_id))));
    if (!feedMovies.length) { skipped++; continue; }
    if (feedMovies.length > largest.count) largest = { personId: Number(personId), count: feedMovies.length };
    const output = JSON.stringify(feedMovies, null, 2);
    for (const dir of feedDirs) {
      if (!fs.existsSync(path.dirname(dir))) continue;
      const file = path.join(dir, `${personId}.json`);
      fs.writeFileSync(`${file}.tmp`, output, 'utf8');
      fs.renameSync(`${file}.tmp`, file);
    }
    generated.add(`${personId}.json`);
  }

  const staleFiles = new Set();
  for (const dir of feedDirs) {
    if (!fs.existsSync(dir)) continue;
    for (const file of fs.readdirSync(dir)) {
      if (!/^\d+\.json$/.test(file) || generated.has(file)) continue;
      fs.unlinkSync(path.join(dir, file));
      staleFiles.add(file);
    }
  }
  if (errors.length) for (const error of errors) console.error(`[actor-feeds] ${error}`);
  console.log(`[actor-feeds] Unique collection actors: ${actors.size}`);
  console.log(`[actor-feeds] Actor JSON feeds generated: ${generated.size}`);
  console.log(`[actor-feeds] Actor/movie associations: ${associations.size}`);
  console.log(`[actor-feeds] Largest actor feed: ${largest.personId || 'none'} (${largest.count})`);
  console.log(`[actor-feeds] Empty feeds skipped: ${skipped}`);
  console.log(`[actor-feeds] Stale feeds removed: ${staleFiles.size}`);
  console.log(`[actor-feeds] Errors: ${errors.length}`);
  return { uniqueActors: actors.size, generated: generated.size, associations: associations.size, largest, skipped, staleRemoved: staleFiles.size, errors };
}

export function updateMovieCast(tmdbId, castNames) {
  let movieCast = {};
  if (fs.existsSync(CAST_JSON_PATH)) {
    try {
      const data = JSON.parse(fs.readFileSync(CAST_JSON_PATH, 'utf8'));
      movieCast = { ...(data.movieCast || {}), ...(data.castByMovieId || {}) };
    } catch {}
  }
  if (fs.existsSync(CAST_SEED_PATH)) {
    try {
      const seed = JSON.parse(fs.readFileSync(CAST_SEED_PATH, 'utf8'));
      movieCast = { ...seed, ...movieCast };
    } catch {}
  }

  movieCast[String(tmdbId)] = castNames;
  return regenerateCastJson(movieCast);
}

export function regenerateCastJson(providedMovieCast = null) {
  return enrichCastData(providedMovieCast);
}
