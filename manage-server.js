/**
 * XmasDB.com - Local Management Server
 * 
 * Standalone local utility server for managing your private movie catalogue.
 * This runs locally on your computer during catalog curation and is NEVER part
 * of your public static hosting (GitHub Pages, Cloudflare Pages, etc.).
 * 
 * Usage:
 *   node manage-server.js
 *   OR
 *   TMDB_API_KEY="your_key" node manage-server.js
 * 
 * Then open: http://localhost:3001/manage.html (or http://localhost:3000/manage.html in Vite)
 */

import 'dotenv/config';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { getMovies, addMovie, removeMovie, getCastData, saveMoviesAndSync } from './movie-storage.js';
import { fetchHallmarkHtml, extractHallmarkCandidates, matchCandidateWithTmdb } from './hallmark-service.js';
import {
  getUniquePersonIdsFromCast, 
  fetchTmdbPerson, 
  loadPersonCache, 
  savePersonCache, 
  rebuildAllCastFromTmdb,
  enrichCastData, 
  normalizeProfilePath 
} from './scripts/enrich-cast.js';
import { slugify } from './src/js/movie-url.js';
import { ensureCachedImage } from './scripts/local-assets.js';
import { selectTrailerVideos } from './scripts/trailer-utils.js';
import { ingestTmdbMovie, validateTmdbMovieImport } from './scripts/tmdb-movie.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.MANAGE_PORT || 3001;

const VERIFIED_HISTORICAL_MISSING = {
  2015: [
    "'Tis the Season for Love", 'Ice Sculpture Christmas', 'Charming Christmas',
    "I'm Not Ready for Christmas", 'Northpole: Open for Christmas', 'Merry Matrimony',
    'Christmas Incorporated', 'Angel of Christmas', 'Just in Time for Christmas',
    "Karen Kingsbury's The Bridge", 'A Christmas Melody', 'Christmas Land',
    'On the Twelfth Day of Christmas'
  ],
  2016: [
    'A Wish For Christmas', 'The Mistletoe Promise', 'Every Christmas Has a Story',
    'Christmas Cookies', 'My Christmas Dream', 'A December Bride', 'Christmas in Homestead',
    'Christmas List', 'Journey Back to Christmas', 'A Dream of Christmas',
    'Looks Like Christmas', 'A Nutcracker Christmas', 'Love You Like Christmas',
    'My Christmas Love', 'Sleigh Bells Ring', 'A Rose for Christmas'
  ],
  2017: [
    'Marry Me at Christmas', 'Christmas Festival of Ice', 'Miss Christmas',
    'The Sweetest Christmas', 'Enchanted Christmas', 'Coming Home for Christmas',
    'A Gift to Remember', 'With Love, Christmas', 'The Mistletoe Inn', 'Finding Santa',
    'The Christmas Train', 'Switched for Christmas', 'Christmas in Evergreen',
    'Christmas at Holly Lodge', 'The Christmas Cottage', 'Sharing Christmas',
    'Christmas Next Door', 'Christmas Connection', 'Christmas Getaway',
    "Royal New Year's Eve"
  ],
  2018: [
    'Christmas Joy', 'Road to Christmas', "It's Christmas, Eve", 'Christmas in Love',
    'Christmas at Graceland', 'Christmas in Evergreen: Letters to Santa',
    'Reunited at Christmas', 'Christmas at the Palace', 'Pride, Prejudice, and Mistletoe',
    'Christmas Everlasting', "A Shoe Addict's Christmas", 'Mingle All the Way',
    'A Majestic Christmas', 'Homegrown Christmas', 'Welcome to Christmas',
    'Entertaining Christmas', 'A Gingerbread Romance', 'Jingle Around the Clock',
    'Christmas Made to Order', 'A Midnight Kiss', 'Christmas at Grand Valley'
  ],
  2019: ['Christmas in Evergreen: Tidings of Joy', 'A Christmas Love Story']
};

app.use(express.json());

// 1. Old URL compatibility: /movie.html?id=1535221 -> redirect 301 to /movie/1535221/{slug}
app.get('/movie.html', (req, res, next) => {
  if (req.query.id) {
    const movies = getMovies();
    const found = movies.find(m => String(m.tmdbId || m.tmdb_id) === String(req.query.id));
    if (found) {
      const slug = slugify(found.title);
      return res.redirect(301, `/movie/${req.query.id}/${slug}`);
    }
  }
  next();
});

// 2. Canonical pretty movie URLs: /movie/:id/:slug
app.get('/movie/:id/:slug?', (req, res) => {
  const { id, slug } = req.params;
  const movies = getMovies();
  const found = movies.find(m => String(m.tmdbId || m.tmdb_id) === String(id));
  if (found) {
    const correctSlug = slugify(found.title);
    if (slug !== correctSlug) {
      return res.redirect(301, `/movie/${id}/${correctSlug}`);
    }
  }
  res.sendFile(path.join(__dirname, 'movie.html'));
});

app.get('/actor.html', (req, res, next) => {
  if (req.query.id) {
    const actor = getCastData().actors?.find(person => String(person.id) === String(req.query.id));
    if (actor) return res.redirect(301, `/actor/${actor.id}/${slugify(actor.name)}`);
  }
  next();
});

app.get('/actor/:id/:slug?', (req, res) => {
  const actor = getCastData().actors?.find(person => String(person.id) === String(req.params.id));
  if (actor) {
    const correctUrl = `/actor/${actor.id}/${slugify(actor.name)}`;
    if (req.path !== correctUrl) return res.redirect(301, correctUrl);
  }
  res.sendFile(path.join(__dirname, 'actor.html'));
});

app.use(express.static(__dirname));

/**
 * Helper to fetch from TMDB with either Bearer token or v3 API Key,
 * supporting redacted endpoints for safe debugging.
 */
async function fetchFromTmdb(endpoint, params = {}, token = '') {
  const activeToken = (token || process.env.TMDB_API_KEY || process.env.TMDB_TOKEN || process.env.TMDB_KEY || '').trim();
  if (!activeToken) {
    const err = new Error('No TMDB API Token provided. Please enter your TMDB API Key / Read Access Token in Section 1.');
    err.status = 401;
    err.statusText = 'Unauthorized';
    err.endpoint = `https://api.themoviedb.org/3/${endpoint}`;
    throw err;
  }

  const url = new URL(`https://api.themoviedb.org/3/${endpoint}`);
  const headers = { Accept: 'application/json' };

  // Support v4 Read Access Token (Bearer) and v3 API Key (?api_key=)
  if (activeToken.length > 40 || activeToken.startsWith('ey')) {
    headers.Authorization = `Bearer ${activeToken}`;
  } else {
    url.searchParams.set('api_key', activeToken);
  }

  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '') {
      url.searchParams.set(k, v);
    }
  }

  // Redacted URL for debugging (never print real token/key)
  const redactedUrl = new URL(url.toString());
  if (redactedUrl.searchParams.has('api_key')) {
    redactedUrl.searchParams.set('api_key', '[REDACTED]');
  }

  const res = await fetch(url.toString(), { headers });
  const status = res.status;
  const statusText = res.statusText;

  let data = null;
  const text = await res.text();
  try {
    data = JSON.parse(text);
  } catch {
    data = { rawText: text };
  }

  if (!res.ok) {
    const errorMsg = data?.status_message || data?.errors?.join(', ') || text || statusText;
    const err = new Error(`TMDB error (${status} ${statusText}): ${errorMsg}`);
    err.status = status;
    err.statusText = statusText;
    err.endpoint = redactedUrl.toString();
    err.rawData = data;
    throw err;
  }

  return {
    data,
    status,
    statusText,
    endpoint: redactedUrl.toString()
  };
}

// 1. Get current movie collection
app.get('/api/manage/movies', (req, res) => {
  try {
    const movies = getMovies();
    res.json({ success: true, count: movies.length, movies });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 2. Search TMDB by title or direct TMDB ID
app.get('/api/manage/search', async (req, res) => {
  try {
    const query = (req.query.query || '').trim();
    const token = (req.query.token || req.headers.authorization?.replace(/^Bearer\s+/i, '') || '').trim();

    if (!query) {
      return res.status(400).json({ success: false, status: 400, error: 'Query parameter is required.' });
    }

    const currentCollection = getMovies();
    const currentTmdbIds = new Set(currentCollection.map(m => Number(m.tmdbId)));

    // Requirement 7: DIRECT TMDB ID LOOKUP
    // If query is numeric, call GET /3/movie/{movie_id} directly. Do not fall through to search/movie.
    if (/^\d+$/.test(query)) {
      try {
        const fetchResult = await fetchFromTmdb(`movie/${query}`, { append_to_response: 'external_ids' }, token);
        const movie = fetchResult.data;
        const result = {
          title: movie.title || 'Untitled',
          original_title: movie.original_title || movie.title || '',
          release_date: movie.release_date || '',
          year: movie.release_date ? parseInt(movie.release_date.split('-')[0], 10) : null,
          tmdbId: movie.id,
          imdbId: movie.external_ids?.imdb_id || null,
          poster: movie.poster_path ? `https://image.tmdb.org/t/p/w500${movie.poster_path}` : null,
          overview: movie.overview || '',
          inCollection: currentTmdbIds.has(movie.id)
        };

        return res.json({
          success: true,
          status: fetchResult.status,
          statusText: fetchResult.statusText,
          total_results: 1,
          results_count: 1,
          endpoint: fetchResult.endpoint,
          results: [result],
          raw: movie
        });
      } catch (err) {
        const status = err.status || 500;
        return res.status(status).json({
          success: false,
          status: status,
          statusText: err.statusText || 'Error',
          endpoint: err.endpoint || `https://api.themoviedb.org/3/movie/${query}`,
          error: err.message,
          raw: err.rawData || null
        });
      }
    }

    // Requirement 1, 2, 3: TITLE SEARCH
    // Call GET https://api.themoviedb.org/3/search/movie with query
    // Do not automatically restrict to a year. Return ALL results from TMDB.
    try {
      let fetchResult = await fetchFromTmdb('search/movie', {
        query,
        include_adult: 'false'
      }, token);

      let searchData = fetchResult.data;
      let rawResults = searchData.results || [];

      // If 0 results and query ends with year e.g. "(2025)" or " 2025",
      // check stripped title so movies like "A Royal Montana Christmas (2025)" succeed
      const strippedYear = query.replace(/\s*[\(\[]?\b(19\d\d|20\d\d)\b[\)\]]?\s*$/, '').trim();
      if (rawResults.length === 0 && strippedYear && strippedYear !== query) {
        try {
          const fallbackResult = await fetchFromTmdb('search/movie', {
            query: strippedYear,
            include_adult: 'false'
          }, token);
          if (fallbackResult.data.results && fallbackResult.data.results.length > 0) {
            fetchResult = fallbackResult;
            searchData = fallbackResult.data;
            rawResults = searchData.results;
          }
        } catch {
          // Keep original result if fallback fails
        }
      }

      // Map all results without discarding
      const results = rawResults.map(m => ({
        title: m.title || 'Untitled',
        original_title: m.original_title || m.title || '',
        release_date: m.release_date || '',
        year: m.release_date ? parseInt(m.release_date.split('-')[0], 10) : null,
        tmdbId: m.id,
        poster: m.poster_path ? `https://image.tmdb.org/t/p/w500${m.poster_path}` : null,
        overview: m.overview || '',
        inCollection: currentTmdbIds.has(m.id)
      }));

      return res.json({
        success: true,
        status: fetchResult.status,
        statusText: fetchResult.statusText,
        total_results: searchData.total_results !== undefined ? searchData.total_results : results.length,
        results_count: results.length,
        endpoint: fetchResult.endpoint,
        results: results,
        raw: searchData
      });
    } catch (err) {
      const status = err.status || 500;
      return res.status(status).json({
        success: false,
        status: status,
        statusText: err.statusText || 'Error',
        endpoint: err.endpoint || 'https://api.themoviedb.org/3/search/movie',
        error: err.message,
        raw: err.rawData || null
      });
    }
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 3. Add movie to collection & automatically regenerate movies.json and yearly feeds
app.post('/api/manage/add', async (req, res) => {
  try {
    const { tmdbId, token } = req.body;
    if (!tmdbId) {
      return res.status(400).json({ success: false, error: 'tmdbId is required.' });
    }

    const syncResult = await addMovieFromTmdb(tmdbId, token);
    res.json({
      success: true,
      message: `Added "${syncResult.movie.title}" (${syncResult.movie.year}) to collection with enriched cast.`,
      movie: syncResult.movie,
      totalMovies: syncResult.count,
      years: syncResult.years
    });
  } catch (err) {
    const statusCode = err.code === 'DUPLICATE' ? 409 : 500;
    res.status(statusCode).json({ success: false, error: err.message });
  }
});

app.post('/api/manage/refresh-movie', async (req, res) => {
  try {
    const { tmdbId, token } = req.body || {};
    if (!tmdbId) return res.status(400).json({ success: false, error: 'tmdbId is required.' });
    const current = getMovies();
    const index = current.findIndex(movie => Number(movie.tmdbId || movie.tmdb_id) === Number(tmdbId));
    if (index < 0) return res.status(404).json({ success: false, error: 'Movie is not in the local catalog.' });
    const existing = current[index];
    const personCache = loadPersonCache();
    const imported = await ingestTmdbMovie(tmdbId, {
      token,
      existing,
      personCache,
      rootDir: __dirname,
      status: existing.status || 'collection',
      refreshPeople: true
    });
    validateTmdbMovieImport(imported.data, imported.movie, tmdbId);
    current[index] = imported.movie;
    savePersonCache(personCache);
    saveMoviesAndSync(current);
    const savedMovie = getMovies().find(movie => Number(movie.tmdbId || movie.tmdb_id) === Number(tmdbId)) || current[index];
    res.json({ success: true, movie: savedMovie, castCount: savedMovie.cast?.length || 0 });
  } catch (err) {
    res.status(err.status === 401 || err.status === 403 ? 401 : 500).json({ success: false, error: err.message });
  }
});

async function addMovieFromTmdb(tmdbId, token) {
  const personCache = loadPersonCache();
  const imported = await ingestTmdbMovie(tmdbId, {
    token,
    existing: {},
    personCache,
    rootDir: __dirname,
    status: 'collection'
  });
  validateTmdbMovieImport(imported.data, imported.movie, tmdbId);
  const syncResult = addMovie(imported.movie, imported.movie.cast);
  savePersonCache(personCache);
  return { ...syncResult, movie: imported.movie, report: imported.report };
}

app.post('/api/manage/hallmark-import-all', async (req, res) => {
  const token = (req.body?.token || '').trim();
  const years = Array.from({ length: 18 }, (_, index) => 2008 + index);
  const imported = [];
  const skipped = [];

  try {
    for (const year of years) {
      let html;
      try {
        html = await fetchHallmarkHtml(year);
      } catch (err) {
        if (/HTTP 404/.test(err.message || '')) {
          skipped.push({ year, title: '(year page)', reason: 'Hallmark has not published this preview page yet' });
          continue;
        }
        throw err;
      }
      const candidates = extractHallmarkCandidates(html, year);
      for (const candidate of candidates) {
        if (candidate.possibleSeries) {
          skipped.push({ year, title: candidate.hallmarkTitle, reason: 'Hallmark source identifies a series or competition' });
          continue;
        }

        let match = null;
        try { match = await matchCandidateWithTmdb(candidate, year, fetchFromTmdb, token); } catch {}
        if (!match) {
          skipped.push({ year, title: candidate.hallmarkTitle, reason: 'No unique exact TMDB title and year match' });
          continue;
        }

        try {
          const result = await addMovieFromTmdb(match.tmdbId, token);
          imported.push({ year, title: result.movie.title, tmdbId: result.movie.tmdbId });
        } catch (err) {
          if (err.code === 'DUPLICATE') {
            skipped.push({ year, title: candidate.hallmarkTitle, reason: 'Already in collection' });
          } else {
            skipped.push({ year, title: candidate.hallmarkTitle, reason: `TMDB add failed: ${err.message}` });
          }
        }
      }
    }

    for (const [yearString, titles] of Object.entries(VERIFIED_HISTORICAL_MISSING)) {
      const year = Number(yearString);
      for (const title of titles) {
        if (getMovies().some(movie => Number(movie.year) === year && movie.title?.toLowerCase() === title.toLowerCase())) {
          skipped.push({ year, title, reason: 'Already in collection' });
          continue;
        }

        let match = null;
        try {
          match = await matchCandidateWithTmdb({ hallmarkTitle: title, year, possibleSeries: false }, year, fetchFromTmdb, token);
        } catch {}
        if (!match) {
          skipped.push({ year, title, reason: 'No unique exact TMDB title and year match' });
          continue;
        }

        try {
          const result = await addMovieFromTmdb(match.tmdbId, token);
          imported.push({ year, title: result.movie.title, tmdbId: result.movie.tmdbId });
        } catch (err) {
          if (err.code === 'DUPLICATE') {
            skipped.push({ year, title, reason: 'Already in collection' });
          } else {
            skipped.push({ year, title, reason: `TMDB add failed: ${err.message}` });
          }
        }
      }
    }

    return res.json({ success: true, years, imported, skipped, totalMovies: getMovies().length });
  } catch (err) {
    return res.status(err.status || 500).json({ success: false, error: err.message, imported, skipped });
  }
});

// 4. Remove movie from collection & automatically regenerate movies.json and yearly feeds
app.post('/api/manage/remove', (req, res) => {
  try {
    const { tmdbId } = req.body;
    if (!tmdbId) {
      return res.status(400).json({ success: false, error: 'tmdbId is required.' });
    }

    const syncResult = removeMovie(tmdbId);
    res.json({
      success: true,
      message: `Removed movie (ID: ${tmdbId}) from collection.`,
      totalMovies: syncResult.count,
      years: syncResult.years
    });
  } catch (err) {
    const statusCode = err.code === 'NOT_FOUND' ? 404 : 500;
    res.status(statusCode).json({ success: false, error: err.message });
  }
});

// 5. Fetch candidates from official Hallmark Countdown to Christmas preview page
app.get('/api/manage/hallmark-fetch', async (req, res) => {
  try {
    const year = parseInt(req.query.year || '2025', 10);
    const token = (req.query.token || req.headers.authorization?.replace(/^Bearer\s+/i, '') || '').trim();

    if (!year || isNaN(year)) {
      return res.status(400).json({ success: false, error: 'Valid year is required.' });
    }

    const html = await fetchHallmarkHtml(year);
    const candidates = extractHallmarkCandidates(html, year);

    if (candidates.length === 0) {
      return res.json({
        success: true,
        year,
        totalCandidates: 0,
        candidates: []
      });
    }

    // Match candidates against TMDB in parallel batches (3 at a time)
    const matchedCandidates = [];
    const batchSize = 3;
    for (let i = 0; i < candidates.length; i += batchSize) {
      const batch = candidates.slice(i, i + batchSize);
      const batchResults = await Promise.all(
        batch.map(c => matchCandidateWithTmdb(c, year, fetchFromTmdb, token))
      );
      matchedCandidates.push(...batchResults);
    }

    res.json({
      success: true,
      year,
      totalCandidates: matchedCandidates.length,
      candidates: matchedCandidates
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 5b. Cast endpoints (TMDB Person API workflow)
app.get('/api/manage/cast', (req, res) => {
  try {
    const castData = getCastData();
    res.json({ success: true, castData });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/manage/cast/actor-ids', (req, res) => {
  try {
    const personIds = getUniquePersonIdsFromCast();
    res.json({ success: true, total: personIds.length, personIds });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/manage/cast/enrich-batch', async (req, res) => {
  try {
    const { token, personIds } = req.body;
    if (!token) {
      return res.status(401).json({ success: false, error: 'No TMDB API Token provided.' });
    }
    if (!personIds || !Array.isArray(personIds)) {
      return res.status(400).json({ success: false, error: 'personIds array is required.' });
    }

    const personCache = loadPersonCache();
    let updatedCount = 0;
    let noPhotoCount = 0;
    let failedCount = 0;
    const errors = [];

    for (const pId of personIds) {
      try {
        const record = await fetchTmdbPerson(pId, token, personCache, true);
        if (record) {
          const image = await ensureCachedImage({ kind: 'person', id: pId, filePath: record.profile_path, rootDir: __dirname, force: true });
          if (image.path) {
            record.profile_path = image.path;
            record.profile = image.path;
          }
          updatedCount++;
          if (!record.profile_path) {
            noPhotoCount++;
          }
        } else {
          failedCount++;
        }
      } catch (err) {
        if (err.status === 401 || err.status === 403) {
          return res.status(401).json({
            success: false,
            error: 'TMDB Authentication Failed (401/403). Please verify your TMDB Token in Section 1.'
          });
        }
        failedCount++;
        errors.push(`Person ${pId}: ${err.message}`);
      }
    }

    savePersonCache(personCache);

    res.json({
      success: true,
      updatedCount,
      noPhotoCount,
      failedCount,
      errors
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/manage/cast/save-enriched', (req, res) => {
  try {
    const personCache = loadPersonCache();
    const castData = enrichCastData(null, personCache);
    res.json({
      success: true,
      totalActors: castData.totalActors,
      totalMovies: castData.totalMovies,
      castData
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/manage/cast/refresh', async (req, res) => {
  try {
    const { token } = req.body;
    if (!token) {
      return res.status(401).json({ success: false, error: 'No TMDB API Token provided.' });
    }
    const result = await rebuildAllCastFromTmdb({
      token,
      log: message => console.log(`[cast-rebuild] ${message}`)
    });
    res.json(result);
  } catch (err) {
    const statusCode = err.status === 401 || err.status === 403 ? 401 : 500;
    res.status(statusCode).json({
      success: false,
      error: err.message || 'Failed to refresh actor data from TMDB.'
    });
  }
});

// 6. Public / App Movie Details endpoint
app.get('/api/movie-details', async (req, res) => {
  try {
    const id = req.query.id;
    const token = (req.query.token || req.headers.authorization?.replace(/^Bearer\s+/i, '') || '').trim();

    if (!id) {
      return res.status(400).json({ success: false, error: 'Movie ID or title is required.' });
    }

    const currentCollection = getMovies();
    const localMovie = currentCollection.find(m => 
      String(m.tmdbId) === String(id) || 
      String(m.tmdb_id) === String(id) ||
      (m.title && m.title.toLowerCase() === decodeURIComponent(id).toLowerCase())
    );

    if (!localMovie) return res.status(404).json({ success: false, error: 'Movie is not present in the local catalog.' });
    const castData = getCastData();
    const localId = String(localMovie.tmdbId || localMovie.tmdb_id);
    const localCast = castData.castByMovieId?.[localId] || castData.movieCast?.[localId] || [];
    return res.json({ success: true, source: 'local', data: {
      id: localMovie.tmdbId || localMovie.tmdb_id,
      tmdbId: localMovie.tmdbId || localMovie.tmdb_id,
      title: localMovie.title,
      original_title: localMovie.originalTitle || localMovie.original_title || '',
      overview: localMovie.overview || '',
      year: localMovie.year || null,
      poster: localMovie.poster || null,
      cast: localCast,
      crew: [],
      genres: [{ name: 'Holiday' }, { name: 'Romance' }]
    }});

    const tmdbIdToQuery = /^\d+$/.test(id) ? id : (localMovie?.tmdbId || localMovie?.tmdb_id);

    if (tmdbIdToQuery) {
      try {
        const fetchRes = await fetchFromTmdb(`movie/${tmdbIdToQuery}`, {
          append_to_response: 'credits,external_ids,videos'
        }, token);
        const data = fetchRes.data;

        return res.json({
          success: true,
          source: 'tmdb',
          data: {
            id: data.id,
            tmdbId: data.id,
            title: data.title || localMovie?.title || 'Untitled',
            original_title: data.original_title || '',
            tagline: data.tagline || '',
            overview: data.overview || localMovie?.overview || '',
            release_date: data.release_date || (localMovie?.year ? String(localMovie.year) : ''),
            year: data.release_date ? parseInt(data.release_date.split('-')[0], 10) : (localMovie?.year || null),
            runtime: data.runtime || null,
            genres: data.genres || [{ name: 'Holiday' }, { name: 'Romance' }],
            vote_average: data.vote_average || null,
            vote_count: data.vote_count || 0,
            poster: data.poster_path ? `https://image.tmdb.org/t/p/w780${data.poster_path}` : (localMovie?.poster || null),
            backdrop: data.backdrop_path ? `https://image.tmdb.org/t/p/w1280${data.backdrop_path}` : null,
            imdb_id: data.external_ids?.imdb_id || localMovie?.imdbId || null,
            cast: (data.credits?.cast || []).map(c => ({
              id: c.id,
              name: c.name,
              character: c.character,
              order: c.order,
              profile_path: c.profile_path ? `https://image.tmdb.org/t/p/w185${c.profile_path}` : null
            })),
            crew: (data.credits?.crew || []).filter(c => ['Director', 'Writer', 'Screenplay'].includes(c.job)).slice(0, 8),
            videos: selectTrailerVideos(data.videos?.results)
          }
        });
      } catch (tmdbErr) {
        // Fall back to local if TMDB lookup fails
        if (localMovie) {
          return res.json({
            success: true,
            source: 'local',
            data: {
              id: localMovie.tmdbId || localMovie.tmdb_id,
              tmdbId: localMovie.tmdbId || localMovie.tmdb_id,
              title: localMovie.title,
              year: localMovie.year,
              overview: localMovie.overview,
              poster: localMovie.poster,
              imdb_id: localMovie.imdbId || localMovie.imdb_id,
              cast: [],
              crew: [],
              genres: [{ name: 'Romance' }, { name: 'Comedy' }, { name: 'Holiday' }]
            }
          });
        }
        throw tmdbErr;
      }
    }

    if (localMovie) {
      return res.json({
        success: true,
        source: 'local',
        data: {
          id: localMovie.tmdbId || localMovie.tmdb_id,
          tmdbId: localMovie.tmdbId || localMovie.tmdb_id,
          title: localMovie.title,
          year: localMovie.year,
          overview: localMovie.overview,
          poster: localMovie.poster,
          imdb_id: localMovie.imdbId || localMovie.imdb_id,
          cast: [],
          crew: [],
          genres: [{ name: 'Romance' }, { name: 'Holiday' }]
        }
      });
    }

    return res.status(404).json({ success: false, error: 'Movie not found.' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 7. Public / App Actor Details endpoint
app.get('/api/actor-details', async (req, res) => {
  try {
    const id = req.query.id;
    const token = (req.query.token || '').trim();

    if (!id) {
      return res.status(400).json({ success: false, error: 'Actor ID is required.' });
    }

    const personCache = loadPersonCache();
    const cached = personCache[String(id)];

    // If we have token and it's a numeric ID, try TMDB person API to get biography, external IDs, etc.
    if (/^\d+$/.test(id)) {
      try {
        const fetchRes = await fetchFromTmdb(`person/${id}`, {
          append_to_response: 'external_ids'
        }, token);
        const data = fetchRes.data;
        try {
          const creditsRes = await fetchFromTmdb(`person/${id}/combined_credits`, {}, token);
          data.combined_credits = creditsRes.data;
        } catch {
          data.combined_credits = { cast: [], crew: [] };
        }

        const enriched = {
          id: data.id,
          name: data.name,
          biography: data.biography || '',
          birthday: data.birthday || null,
          deathday: data.deathday || null,
          place_of_birth: data.place_of_birth || null,
          profile_path: data.profile_path || cached?.profile_path || null,
          imdb_id: data.imdb_id || data.external_ids?.imdb_id || null,
          known_for_department: data.known_for_department || 'Acting',
          tmdbActingCredits: (data.combined_credits?.cast || [])
            .filter(credit => credit && credit.media_type === 'movie' && credit.release_date)
            .map(credit => ({
              id: credit.id,
              title: credit.title || credit.original_title || '',
              year: Number(credit.release_date.slice(0, 4)),
              character: credit.character || ''
            }))
            .filter(credit => Number.isInteger(credit.year) && credit.year > 1800),
          tmdbCredits: [
            ...(data.combined_credits?.cast || []).map(credit => ({
              id: credit.id,
              department: 'Acting',
              year: Number((credit.release_date || credit.first_air_date || '').slice(0, 4)),
              title: credit.title || credit.name || credit.original_title || credit.original_name || '',
              role: credit.character || '',
              episodes: credit.episode_count || null,
              mediaType: credit.media_type || 'movie'
            })),
            ...(data.combined_credits?.crew || [])
              .filter(credit => credit.department === 'Writing' || credit.job === 'Writer' || credit.job === 'Story')
              .map(credit => ({
                id: credit.id,
                department: 'Writing',
                year: Number((credit.release_date || credit.first_air_date || '').slice(0, 4)),
                title: credit.title || credit.name || credit.original_title || credit.original_name || '',
                role: credit.job || '',
                episodes: credit.episode_count || null,
                mediaType: credit.media_type || 'movie'
              }))
          ].filter(credit => Number.isInteger(credit.year) && credit.year > 1800 && credit.title)
        };

        // Update cache
        personCache[String(id)] = { ...(cached || {}), ...enriched, updatedAt: new Date().toISOString() };
        savePersonCache(personCache);

        return res.json({
          success: true,
          source: 'tmdb',
          actor: enriched
        });
      } catch (tmdbErr) {
        // Fallback to cache if TMDB fails
      }
    }

    if (cached) {
      return res.json({
        success: true,
        source: 'cache',
        actor: cached
      });
    }

    return res.status(404).json({ success: false, error: 'Actor not found.' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`-----------------------------------------------------`);
  console.log(`XmasDB.com - Local Management Server`);
  console.log(`Running on: http://localhost:${PORT}/manage.html`);
  console.log(`-----------------------------------------------------`);
});
