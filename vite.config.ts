import { defineConfig, type Plugin } from 'vite';
import fs from 'node:fs/promises';
import path from 'node:path';
import { 
  getMovies, 
  addMovie, 
  removeMovie, 
  getUpcomingMovies, 
  addUpcomingMovie, 
  removeUpcomingMovie, 
  updateUpcomingMovie, 
  promoteUpcomingToCollection, 
  getCastData, 
} from './movie-storage.js';
import { 
  getUniquePersonIdsFromCast, 
  fetchTmdbPerson, 
  loadPersonCache, 
  savePersonCache, 
  rebuildAllCastFromTmdb,
  enrichCastData, 
  normalizeProfilePath 
} from './scripts/enrich-cast.js';
import { 
  fetchHallmarkHtml, 
  extractHallmarkCandidates, 
  fetchHallmarkNewsHtml, 
  extractHallmarkNewsCandidates 
} from './hallmark-service.js';
import { slugify } from './src/js/movie-url.js';
import { refreshSeoOutput } from './scripts/refresh-seo.js';
import { selectTrailerVideos } from './scripts/trailer-utils.js';
import { ingestTmdbMovie, validateTmdbMovieImport } from './scripts/tmdb-movie.js';

function localManagementPlugin(): Plugin {
  return {
    name: 'local-management-plugin',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const urlObj = new URL(req.url || '', 'http://localhost:3000');
        const pathname = urlObj.pathname;

        // 1. Old URL compatibility: /movie.html?id=1535221 -> redirect 301 to /movie/1535221/{slug}
          if (pathname === '/movie.html' && urlObj.searchParams.has('id')) {
            const id = urlObj.searchParams.get('id');
            const found = [...getMovies(), ...getUpcomingMovies()].find((m: any) => String(m.tmdbId || m.tmdb_id) === String(id));
          if (found) {
            const slug = slugify(found.title);
            res.statusCode = 301;
            res.setHeader('Location', `/movie/${id}/${slug}`);
            res.end();
            return;
          }
        }

        // 2. Canonical pretty URL routing: /movie/{tmdbId}/{slug}
        const movieMatch = pathname.match(/^\/movie\/([0-9]+)(?:\/([^/?#]+))?/);
        if (movieMatch) {
          const id = movieMatch[1];
          const givenSlug = movieMatch[2] || '';
          const found = [...getMovies(), ...getUpcomingMovies()].find((m: any) => String(m.tmdbId || m.tmdb_id) === String(id));
          if (found) {
            const correctSlug = slugify(found.title);
            // If wrong slug or missing slug, canonicalize with 301 redirect
            if (givenSlug !== correctSlug) {
              res.statusCode = 301;
              res.setHeader('Location', `/movie/${id}/${correctSlug}`);
              res.end();
              return;
            }
          }
          // Rewrite URL to /movie.html so Vite serves movie.html
          req.url = '/movie.html';
          return next();
        }

        // Actor compatibility and canonical pretty URL routing.
        if (pathname === '/actor.html' && urlObj.searchParams.has('id')) {
          const id = urlObj.searchParams.get('id');
          const cast = getCastData();
          const actor = cast.actors?.find((person: any) => String(person.id) === String(id));
          if (actor) {
            res.statusCode = 301;
            res.setHeader('Location', getActorCanonicalUrl(actor));
            res.end();
            return;
          }
        }

        const actorMatch = pathname.match(/^\/actor\/([0-9]+)(?:\/([^/?#]+))?/);
        if (actorMatch) {
          const cast = getCastData();
          const actor = cast.actors?.find((person: any) => String(person.id) === actorMatch[1]);
          if (actor) {
            const correctUrl = getActorCanonicalUrl(actor);
            if (pathname !== correctUrl) {
              res.statusCode = 301;
              res.setHeader('Location', correctUrl);
              res.end();
              return;
            }
          }
          const actorTemplate = await fs.readFile(path.resolve(process.cwd(), 'actor.html'), 'utf8');
          const transformedActorHtml = await server.transformIndexHtml(pathname, actorTemplate);
          res.statusCode = 200;
          res.setHeader('Content-Type', 'text/html');
          res.end(transformedActorHtml);
          return;
        }

        if (!pathname.startsWith('/api/manage') && !pathname.startsWith('/api/movie-details') && pathname !== '/api/actor-details') {
          return next();
        }

        res.setHeader('Content-Type', 'application/json');

        // Helper to parse JSON body
        const getBody = () => new Promise<any>((resolve) => {
          let data = '';
          req.on('data', chunk => { data += chunk; });
          req.on('end', () => {
            try {
              resolve(data ? JSON.parse(data) : {});
            } catch (e) {
              resolve({});
            }
          });
        });

        // Helper for TMDB fetch with authentication support and redacted endpoint for debugging
        const fetchTmdb = async (endpoint: string, params: Record<string, string> = {}, userToken: string = '') => {
          const activeToken = (userToken || process.env.TMDB_API_KEY || process.env.TMDB_TOKEN || process.env.TMDB_KEY || '').trim();
          if (!activeToken) {
            const err: any = new Error('No TMDB API Token provided. Please enter your TMDB API Key / Read Access Token in Section 1.');
            err.status = 401;
            err.statusText = 'Unauthorized';
            err.endpoint = `https://api.themoviedb.org/3/${endpoint}`;
            throw err;
          }

          const tmdbUrl = new URL(`https://api.themoviedb.org/3/${endpoint}`);
          const headers: Record<string, string> = { Accept: 'application/json' };

          // Support both v4 Read Access Token (Bearer) and v3 API Key (?api_key=)
          if (activeToken.length > 40 || activeToken.startsWith('ey')) {
            headers.Authorization = `Bearer ${activeToken}`;
          } else {
            tmdbUrl.searchParams.set('api_key', activeToken);
          }

          for (const [k, v] of Object.entries(params)) {
            if (v !== undefined && v !== null && v !== '') {
              tmdbUrl.searchParams.set(k, v);
            }
          }

          // Redacted URL for debugging (never print real token/key)
          const redactedUrl = new URL(tmdbUrl.toString());
          if (redactedUrl.searchParams.has('api_key')) {
            redactedUrl.searchParams.set('api_key', '[REDACTED]');
          }

          const response = await fetch(tmdbUrl.toString(), { headers });
          const status = response.status;
          const statusText = response.statusText;

          let data: any = null;
          const text = await response.text();
          try {
            data = JSON.parse(text);
          } catch {
            data = { rawText: text };
          }

          if (!response.ok) {
            const errorMsg = data?.status_message || data?.errors?.join(', ') || text || statusText;
            const err: any = new Error(`TMDB error (${status} ${statusText}): ${errorMsg}`);
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
        };

        try {
          if (pathname === '/api/manage/movies' && req.method === 'GET') {
            const movies = getMovies();
            res.statusCode = 200;
            res.end(JSON.stringify({ success: true, count: movies.length, movies }));
            return;
          }

          if (pathname === '/api/manage/search' && req.method === 'GET') {
            const query = (urlObj.searchParams.get('query') || '').trim();
            const token = (urlObj.searchParams.get('token') || (req.headers.authorization || '').replace(/^Bearer\s+/i, '')).trim();

            if (!query) {
              res.statusCode = 400;
              res.end(JSON.stringify({ success: false, status: 400, error: 'Query parameter is required' }));
              return;
            }

            const currentCollection = getMovies();
            const currentTmdbIds = new Set(currentCollection.map((m: any) => Number(m.tmdbId)));

            // Requirement 7: DIRECT TMDB ID LOOKUP
            // If the search box contains only numbers, treat it as a TMDB ID and call GET /3/movie/{movie_id}
            // Do not send numeric IDs through the title search endpoint.
            if (/^\d+$/.test(query)) {
              try {
                const fetchResult = await fetchTmdb(`movie/${query}`, { append_to_response: 'external_ids' }, token);
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

                res.statusCode = 200;
                res.end(JSON.stringify({
                  success: true,
                  status: fetchResult.status,
                  statusText: fetchResult.statusText,
                  total_results: 1,
                  results_count: 1,
                  endpoint: fetchResult.endpoint,
                  results: [result],
                  raw: movie
                }));
                return;
              } catch (err: any) {
                const status = err.status || 500;
                res.statusCode = status;
                res.end(JSON.stringify({
                  success: false,
                  status: status,
                  statusText: err.statusText || 'Error',
                  endpoint: err.endpoint || `https://api.themoviedb.org/3/movie/${query}`,
                  error: err.message,
                  raw: err.rawData || null
                }));
                return;
              }
            }

            // Requirement 1, 2, 3: TITLE SEARCH
            // Call GET https://api.themoviedb.org/3/search/movie with query
            // Do not automatically restrict to a year. Return ALL results from TMDB.
            try {
              let fetchResult = await fetchTmdb('search/movie', {
                query,
                include_adult: 'false'
              }, token);

              let searchData = fetchResult.data;
              let rawResults = searchData.results || [];

              // If 0 results, try intelligent fallback variations without altering stored titles
              if (rawResults.length === 0) {
                const fallbackQueries: string[] = [];

                // 1. Strip trailing year e.g. "(2025)" or " 2025"
                const strippedYear = query.replace(/\s*[\(\[]?\b(19\d\d|20\d\d)\b[\)\]]?\s*$/, '').trim();
                if (strippedYear && strippedYear !== query) {
                  fallbackQueries.push(strippedYear);
                }

                // 2. Replace '&' with 'and'
                if (query.includes('&')) {
                  fallbackQueries.push(query.replace(/&/g, 'and').replace(/\s+/g, ' ').trim());
                }

                // 3. Replace word 'and' with '&'
                if (/\band\b/i.test(query)) {
                  fallbackQueries.push(query.replace(/\band\b/gi, '&').replace(/\s+/g, ' ').trim());
                }

                // 4. Subtitle before colon or dash
                const beforeColon = query.replace(/[:–—-].*$/, '').trim();
                if (beforeColon && beforeColon !== query && beforeColon.length >= 4) {
                  fallbackQueries.push(beforeColon);
                }

                for (const fallbackQ of fallbackQueries) {
                  if (rawResults.length > 0) break;
                  try {
                    const fallbackResult = await fetchTmdb('search/movie', {
                      query: fallbackQ,
                      include_adult: 'false'
                    }, token);
                    if (fallbackResult.data.results && fallbackResult.data.results.length > 0) {
                      fetchResult = fallbackResult;
                      searchData = fallbackResult.data;
                      rawResults = searchData.results;
                      break;
                    }
                  } catch {
                    // continue to next fallback
                  }
                }
              }

              // Map all results without discarding
              const results = rawResults.map((m: any) => ({
                title: m.title || 'Untitled',
                original_title: m.original_title || m.title || '',
                release_date: m.release_date || '',
                year: m.release_date ? parseInt(m.release_date.split('-')[0], 10) : null,
                tmdbId: m.id,
                poster: m.poster_path ? `https://image.tmdb.org/t/p/w500${m.poster_path}` : null,
                overview: m.overview || '',
                inCollection: currentTmdbIds.has(m.id)
              }));

              res.statusCode = 200;
              res.end(JSON.stringify({
                success: true,
                status: fetchResult.status,
                statusText: fetchResult.statusText,
                total_results: searchData.total_results !== undefined ? searchData.total_results : results.length,
                results_count: results.length,
                endpoint: fetchResult.endpoint,
                results: results,
                raw: searchData
              }));
              return;
            } catch (err: any) {
              const status = err.status || 500;
              res.statusCode = status;
              res.end(JSON.stringify({
                success: false,
                status: status,
                statusText: err.statusText || 'Error',
                endpoint: err.endpoint || 'https://api.themoviedb.org/3/search/movie',
                error: err.message,
                raw: err.rawData || null
              }));
              return;
            }
          }

          if (pathname === '/api/manage/add' && req.method === 'POST') {
            const body = await getBody();
            const { tmdbId, token } = body;

            if (!tmdbId) {
              res.statusCode = 400;
              res.end(JSON.stringify({ success: false, error: 'tmdbId is required' }));
              return;
            }

            const personCache = loadPersonCache();
            const imported = await ingestTmdbMovie(tmdbId, {
              token,
              personCache,
              rootDir: process.cwd(),
              status: 'collection'
            });
            validateTmdbMovieImport(imported.data, imported.movie, tmdbId);
            const syncResult = addMovie(imported.movie, imported.movie.cast);
            savePersonCache(personCache);
            const savedMovie = getMovies().find(movie => Number(movie.tmdbId || movie.tmdb_id) === Number(tmdbId));
            if (imported.report.videosFromTmdb > 0 && !(savedMovie?.videos?.length > 0)) {
              throw new Error(`TMDB returned videos for ${tmdbId}, but the collection record saved none.`);
            }
            await refreshSeoOutput();
            res.statusCode = 200;
            res.end(JSON.stringify({
              success: true,
              message: `Added "${imported.movie.title}" (${imported.movie.year}) to collection through the shared TMDB pipeline.`,
              movie: imported.movie,
              report: imported.report,
              totalMovies: syncResult.count,
              years: syncResult.years
            }));
            return;
          }

          if (pathname === '/api/manage/remove' && req.method === 'POST') {
            const body = await getBody();
            const { tmdbId } = body;

            if (!tmdbId) {
              res.statusCode = 400;
              res.end(JSON.stringify({ success: false, error: 'tmdbId is required' }));
              return;
            }

            const syncResult = removeMovie(tmdbId);
            await refreshSeoOutput();
            res.statusCode = 200;
            res.end(JSON.stringify({
              success: true,
              message: `Removed movie (ID: ${tmdbId}) from collection.`,
              totalMovies: syncResult.count,
              years: syncResult.years
            }));
            return;
          }

          // 5b. Fetch Hallmark Countdown to Christmas Candidates
          if ((pathname === '/api/manage/hallmark-fetch' || pathname === '/api/manage/hallmark-raw-candidates') && req.method === 'GET') {
            const year = parseInt(urlObj.searchParams.get('year') || '2025', 10);

            if (!year || isNaN(year)) {
              res.statusCode = 400;
              res.end(JSON.stringify({ success: false, error: 'Valid year is required.' }));
              return;
            }

            const html = await fetchHallmarkHtml(year);
            const candidates = extractHallmarkCandidates(html, year);

            res.statusCode = 200;
            res.end(JSON.stringify({
              success: true,
              year,
              totalCandidates: candidates.length,
              candidates: candidates
            }));
            return;
          }

          // 5c. Fetch Hallmark Movie News Candidates (for Upcoming Movies)
          if (pathname === '/api/manage/hallmark-news' && req.method === 'GET') {
            try {
              const html = await fetchHallmarkNewsHtml();
              const candidates = extractHallmarkNewsCandidates(html);

              res.statusCode = 200;
              res.end(JSON.stringify({
                success: true,
                totalCandidates: candidates.length,
                candidates
              }));
              return;
            } catch (err: any) {
              res.statusCode = 500;
              res.end(JSON.stringify({
                success: false,
                error: `Failed to fetch Hallmark movie news: ${err.message}`
              }));
              return;
            }
          }

          // 5d. Upcoming Movies CRUD endpoints
          if (pathname === '/api/manage/upcoming' && req.method === 'GET') {
            const list = getUpcomingMovies();
            res.statusCode = 200;
            res.end(JSON.stringify({
              success: true,
              count: list.length,
              movies: list
            }));
            return;
          }

          if (pathname === '/api/manage/upcoming/add' && req.method === 'POST') {
            const body = await getBody();
            const input = body.movie || body;
            let movie = { ...input };
            const personCache = loadPersonCache();

            if (!/^\d+$/.test(String(movie.tmdbId || ''))) {
              res.statusCode = 400;
              res.end(JSON.stringify({ success: false, error: 'A numeric tmdbId is required for Coming Soon imports.' }));
              return;
            }

            const imported = await ingestTmdbMovie(movie.tmdbId, {
              token: body.token || '',
              personCache,
              existing: movie,
              rootDir: process.cwd(),
              status: 'upcoming'
            });
            validateTmdbMovieImport(imported.data, imported.movie, movie.tmdbId);
            movie = imported.movie;
            const added = addUpcomingMovie(movie);
            savePersonCache(personCache);
            const savedMovie = added.find(item => Number(item.tmdbId || item.tmdb_id) === Number(movie.tmdbId));
            if (movie.tmdbId && movie.videos?.length && !(savedMovie?.videos?.length > 0)) {
              throw new Error(`TMDB returned videos for ${movie.tmdbId}, but the Coming Soon record saved none.`);
            }
            await refreshSeoOutput();
            res.statusCode = 200;
            res.end(JSON.stringify({
              success: true,
              message: `Added "${movie.title || movie.hallmarkTitle}" to upcoming movies.`,
              movies: added
            }));
            return;
          }

          if (pathname === '/api/manage/upcoming/remove' && req.method === 'POST') {
            const body = await getBody();
            const { id } = body;
            if (!id) {
              res.statusCode = 400;
              res.end(JSON.stringify({ success: false, error: 'id is required' }));
              return;
            }
            const updated = removeUpcomingMovie(id);
            await refreshSeoOutput();
            res.statusCode = 200;
            res.end(JSON.stringify({
              success: true,
              message: 'Removed movie from upcoming list.',
              movies: updated
            }));
            return;
          }

          if (pathname === '/api/manage/upcoming/update' && req.method === 'POST') {
            const body = await getBody();
            const { id, updates } = body;
            if (!id) {
              res.statusCode = 400;
              res.end(JSON.stringify({ success: false, error: 'id is required' }));
              return;
            }
            const updated = updateUpcomingMovie(id, updates || {});
            await refreshSeoOutput();
            res.statusCode = 200;
            res.end(JSON.stringify({
              success: true,
              message: 'Updated upcoming movie.',
              movies: updated
            }));
            return;
          }

          if (pathname === '/api/manage/upcoming/promote' && req.method === 'POST') {
            const body = await getBody();
            const { id, token, movieData } = body;
            if (!id) {
              res.statusCode = 400;
              res.end(JSON.stringify({ success: false, error: 'id is required' }));
              return;
            }

            let enrichedMovie = movieData || {};
            let castList: any[] = [];
            const personCache = loadPersonCache();
            const targetTmdbId = enrichedMovie.tmdbId || id;
            if (targetTmdbId && /^\d+$/.test(String(targetTmdbId))) {
              const current = getUpcomingMovies().find(movie => String(movie.id) === String(id) || String(movie.tmdbId) === String(id));
              const imported = await ingestTmdbMovie(targetTmdbId, {
                token: token || '',
                personCache,
                existing: { ...(current || {}), ...enrichedMovie },
                rootDir: process.cwd(),
                status: 'collection'
              });
              validateTmdbMovieImport(imported.data, imported.movie, targetTmdbId);
              enrichedMovie = imported.movie;
              castList = imported.movie.cast || [];
            }

            const syncResult = promoteUpcomingToCollection(id, enrichedMovie, castList);
            savePersonCache(personCache);
            await refreshSeoOutput();
            res.statusCode = 200;
            res.end(JSON.stringify({
              success: true,
              message: `Successfully promoted "${enrichedMovie.title}" to released collection with enriched cast!`,
              movie: enrichedMovie,
              totalMovies: syncResult.count,
              years: syncResult.years
            }));
            return;
          }

          // 5e. Cast data and TMDB Person API endpoints
          if (pathname === '/api/manage/cast' && req.method === 'GET') {
            const castData = getCastData();
            res.statusCode = 200;
            res.end(JSON.stringify({
              success: true,
              castData
            }));
            return;
          }

          // Return all unique person IDs in cast.json for progress tracking
          if (pathname === '/api/manage/cast/actor-ids' && req.method === 'GET') {
            const personIds = getUniquePersonIdsFromCast();
            res.statusCode = 200;
            res.end(JSON.stringify({
              success: true,
              total: personIds.length,
              personIds
            }));
            return;
          }

          // Batch enrich actors using TMDB Person API (/3/person/{person_id})
          if (pathname === '/api/manage/cast/enrich-batch' && req.method === 'POST') {
            const body = await getBody();
            const { token, personIds } = body;

            if (!token) {
              res.statusCode = 401;
              res.end(JSON.stringify({ success: false, error: 'No TMDB API Token provided.' }));
              return;
            }

            if (!personIds || !Array.isArray(personIds)) {
              res.statusCode = 400;
              res.end(JSON.stringify({ success: false, error: 'personIds array is required.' }));
              return;
            }

            const personCache = loadPersonCache();
            let updatedCount = 0;
            let noPhotoCount = 0;
            let failedCount = 0;
            const errors: string[] = [];

            for (const pId of personIds) {
              try {
                const record = await fetchTmdbPerson(pId, token, personCache, true);
                if (record) {
                  updatedCount++;
                  if (!record.profile_path) {
                    noPhotoCount++;
                  }
                } else {
                  failedCount++;
                }
              } catch (err: any) {
                if (err.status === 401 || err.status === 403) {
                  res.statusCode = 401;
                  res.end(JSON.stringify({
                    success: false,
                    error: 'TMDB Authentication Failed (401/403). Please verify your TMDB Token in Section 1.'
                  }));
                  return;
                }
                failedCount++;
                errors.push(`Person ${pId}: ${err.message}`);
              }
            }

            savePersonCache(personCache);

            res.statusCode = 200;
            res.end(JSON.stringify({
              success: true,
              updatedCount,
              noPhotoCount,
              failedCount,
              errors
            }));
            return;
          }

          // Save enriched cast.json after all batches finish
          if (pathname === '/api/manage/cast/save-enriched' && req.method === 'POST') {
            const personCache = loadPersonCache();
            const castData = enrichCastData(null, personCache);
            await refreshSeoOutput();
            res.statusCode = 200;
            res.end(JSON.stringify({
              success: true,
              totalActors: castData.totalActors,
              totalMovies: castData.totalMovies,
              castData
            }));
            return;
          }

          // One-shot server refresh of all actors
          if (pathname === '/api/manage/cast/refresh' && req.method === 'POST') {
            const body = await getBody();
            const { token } = body;

            if (!token) {
              res.statusCode = 401;
              res.end(JSON.stringify({ success: false, error: 'No TMDB API Token provided.' }));
              return;
            }

            try {
              const result = await rebuildAllCastFromTmdb({
                token,
                log: message => console.log(`[cast-rebuild] ${message}`)
              } as any);
              await refreshSeoOutput();
              res.statusCode = 200;
              res.end(JSON.stringify(result));
            } catch (err: any) {
              const code = err.status === 401 || err.status === 403 ? 401 : 500;
              res.statusCode = code;
              res.end(JSON.stringify({
                success: false,
                error: err.message || 'Failed to refresh actor data from TMDB.'
              }));
            }
            return;
          }

          // 6. Public / App Movie Details endpoint
          if (pathname === '/api/movie-details' && req.method === 'GET') {
            const id = urlObj.searchParams.get('id');
            const token = (urlObj.searchParams.get('token') || '').trim();

            if (!id) {
              res.statusCode = 400;
              res.end(JSON.stringify({ success: false, error: 'Movie ID or title is required.' }));
              return;
            }

            const currentCollection = getMovies();
            const localMovie = currentCollection.find((m: any) => 
              String(m.tmdbId) === String(id) || 
              String(m.tmdb_id) === String(id) ||
              (m.title && m.title.toLowerCase() === decodeURIComponent(id).toLowerCase())
            );

            const tmdbIdToQuery = /^\d+$/.test(id) ? id : (localMovie?.tmdbId || localMovie?.tmdb_id);

            if (tmdbIdToQuery) {
              try {
                const fetchRes = await fetchTmdb(`movie/${tmdbIdToQuery}`, {
                  append_to_response: 'credits,external_ids,videos'
                }, token);
                const data = fetchRes.data;

                res.statusCode = 200;
                res.end(JSON.stringify({
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
                    cast: (data.credits?.cast || []).map((c: any) => ({
                      id: c.id,
                      name: c.name,
                      character: c.character,
                      order: c.order,
                      profile_path: c.profile_path ? `https://image.tmdb.org/t/p/w185${c.profile_path}` : null
                    })),
                    crew: (data.credits?.crew || []).filter((c: any) => ['Director', 'Writer', 'Screenplay'].includes(c.job)).slice(0, 8),
                    videos: (data.videos?.results || []).filter((v: any) => v.site === 'YouTube' && ['Trailer', 'Teaser'].includes(v.type))
                  }
                }));
                return;
              } catch (tmdbErr) {
                if (localMovie) {
                  res.statusCode = 200;
                  res.end(JSON.stringify({
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
                  }));
                  return;
                }
                throw tmdbErr;
              }
            }

            if (localMovie) {
              res.statusCode = 200;
              res.end(JSON.stringify({
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
              }));
              return;
            }

            res.statusCode = 404;
            res.end(JSON.stringify({ success: false, error: 'Movie not found.' }));
            return;
          }

          // 7. Public / App Actor Details endpoint
          if (pathname === '/api/actor-details' && req.method === 'GET') {
            const id = urlObj.searchParams.get('id');
            const token = (urlObj.searchParams.get('token') || '').trim();

            if (!id) {
              res.statusCode = 400;
              res.end(JSON.stringify({ success: false, error: 'Actor ID is required.' }));
              return;
            }

            const personCache = loadPersonCache();
            const cached = personCache[String(id)];

            // If we have token and it's a numeric ID, try TMDB person API to get biography, external IDs, etc.
            if (/^\d+$/.test(id)) {
              try {
                const fetchRes = await fetchTmdb(`person/${id}`, {
                  append_to_response: 'external_ids'
                }, token);
                const data = fetchRes.data;
                try {
                  const creditsRes = await fetchTmdb(`person/${id}/combined_credits`, {}, token);
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
                    .filter((credit: any) => credit && credit.media_type === 'movie' && credit.release_date)
                    .map((credit: any) => ({
                      id: credit.id,
                      title: credit.title || credit.original_title || '',
                      year: Number(credit.release_date.slice(0, 4)),
                      character: credit.character || ''
                    }))
                    .filter((credit: any) => Number.isInteger(credit.year) && credit.year > 1800),
                  tmdbCredits: [
                    ...(data.combined_credits?.cast || []).map((credit: any) => ({
                      id: credit.id,
                      department: 'Acting',
                      year: Number((credit.release_date || credit.first_air_date || '').slice(0, 4)),
                      title: credit.title || credit.name || credit.original_title || credit.original_name || '',
                      role: credit.character || '',
                      episodes: credit.episode_count || null,
                      mediaType: credit.media_type || 'movie'
                    })),
                    ...(data.combined_credits?.crew || [])
                      .filter((credit: any) => credit.department === 'Writing' || credit.job === 'Writer' || credit.job === 'Story')
                      .map((credit: any) => ({
                        id: credit.id,
                        department: 'Writing',
                        year: Number((credit.release_date || credit.first_air_date || '').slice(0, 4)),
                        title: credit.title || credit.name || credit.original_title || credit.original_name || '',
                        role: credit.job || '',
                        episodes: credit.episode_count || null,
                        mediaType: credit.media_type || 'movie'
                      }))
                  ].filter((credit: any) => Number.isInteger(credit.year) && credit.year > 1800 && credit.title)
                };

                // Update cache
                personCache[String(id)] = { ...(cached || {}), ...enriched, updatedAt: new Date().toISOString() };
                savePersonCache(personCache);

                res.statusCode = 200;
                res.end(JSON.stringify({
                  success: true,
                  source: 'tmdb',
                  actor: enriched
                }));
                return;
              } catch (tmdbErr) {
                // If TMDB fetch fails, fallback to cache
              }
            }

            if (cached) {
              res.statusCode = 200;
              res.end(JSON.stringify({
                success: true,
                source: 'cache',
                actor: cached
              }));
              return;
            }

            res.statusCode = 404;
            res.end(JSON.stringify({ success: false, error: 'Actor not found.' }));
            return;
          }

          res.statusCode = 404;
          res.end(JSON.stringify({ success: false, error: 'Endpoint not found' }));
        } catch (err: any) {
          res.statusCode = err.code === 'DUPLICATE' ? 409 : (err.code === 'NOT_FOUND' ? 404 : 500);
          res.end(JSON.stringify({ success: false, error: err.message }));
        }
      });
    }
  };
}

function getActorCanonicalUrl(actor: any): string {
  const slug = slugify(actor.name || '');
  return slug ? `/actor/${actor.id}/${slug}` : `/actor/${actor.id}`;
}

export default defineConfig({
  base: '/',
  plugins: [localManagementPlugin()],
  server: {
    port: 3000,
    host: '0.0.0.0',
    hmr: process.env.DISABLE_HMR !== 'true',
    watch: process.env.DISABLE_HMR === 'true' ? null : {},
  },
  build: {
    rollupOptions: {
      input: {
        main: './index.html',
        radarr: './radarr.html',
        movie: './movie.html',
        actor: './actor.html',
        notFound: './404.html',
      },
    },
  },
});
