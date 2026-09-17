/**
 * XmasDB.com - Movie Generator Utility
 * 
 * This optional utility script is designed to be run locally or during build/development.
 * It uses The Movie Database (TMDB) API to fetch metadata, IMDb IDs, and poster URLs,
 * then outputs a clean, machine-readable `movies.json` file.
 * 
 * IMPORTANT:
 * - Your TMDB API key/token is NEVER exposed in index.html, style.css, or app.js.
 * - Visitors' browsers only load the static `movies.json` file without any API calls.
 * 
 * Usage:
 *   node generate-movies.js <YOUR_TMDB_API_KEY_OR_BEARER_TOKEN>
 *   OR
 *   TMDB_API_KEY=your_api_key node generate-movies.js
 *   OR
 *   TMDB_TOKEN=your_bearer_token node generate-movies.js
 */

import fs from 'fs';
import path from 'path';
import { generateRadarrFeeds } from './scripts/generate-radarr-feeds.js';
import { fileURLToPath } from 'url';
import { ensureCachedImage } from './scripts/local-assets.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Read API key or Token from args or environment variable
const args = process.argv.slice(2);
const cliKey = args[0] && !args[0].startsWith('--') ? args[0] : null;
const tmdbKey = cliKey || process.env.TMDB_API_KEY || process.env.TMDB_KEY;
const tmdbToken = process.env.TMDB_TOKEN || process.env.TMDB_BEARER_TOKEN;

if (!tmdbKey && !tmdbToken) {
  console.log('------------------------------------------------------------');
  console.log('XmasDB.com - TMDB Generator Utility');
  console.log('------------------------------------------------------------');
  console.log('No TMDB API Key or Bearer Token provided.');
  console.log('');
  console.log('To run this script and fetch fresh data from TMDB:');
  console.log('  1. Get a free TMDB API key at https://www.themoviedb.org/settings/api');
  console.log('  2. Run:');
  console.log('     TMDB_API_KEY="your_api_key_here" node generate-movies.js');
  console.log('     OR');
  console.log('     node generate-movies.js your_api_key_here');
  console.log('');
  console.log('Note: The current movies.json is already populated and ready for static hosting.');
  console.log('------------------------------------------------------------');
  process.exit(0);
}

// Curated list of beloved XmasDB.com
const CURATED_TITLES = [
  'Once Upon a Holiday',
  '12 Gifts of Christmas',
  'Crown for Christmas',
  'The Nine Lives of Christmas',
  'Christmas Under Wraps',
  'The Christmas House',
  'An Unexpected Christmas',
  'Three Wise Men and a Baby',
  'A Christmas Detour',
  'Write Before Christmas',
  'One Royal Holiday',
  'A Biltmore Christmas',
  'Haul Out the Holly',
  'The Most Wonderful Time of the Year',
  'My Christmas Family Tree',
  'Next Stop, Christmas',
  'Christmas at Pemberley Manor',
  'A Timeless Christmas',
  'Round and Round',
  'A Kiss Before Christmas',
  'Ghosts of Christmas Always',
  'A Merry Scottish Christmas',
  'A Royal Christmas',
  'Christmas in Tahoe'
];

/**
 * Fetch helper with support for both v3 API Key and v4 Bearer token
 */
async function tmdbFetch(endpoint, params = {}) {
  const url = new URL(`https://api.themoviedb.org/3/${endpoint}`);
  const headers = { 'Accept': 'application/json' };

  if (tmdbToken) {
    headers['Authorization'] = `Bearer ${tmdbToken}`;
  } else if (tmdbKey) {
    url.searchParams.set('api_key', tmdbKey);
  }

  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }

  const res = await fetch(url.toString(), { headers });
  if (!res.ok) {
    throw new Error(`TMDB request failed: ${res.status} ${res.statusText} (${endpoint})`);
  }
  return res.json();
}

async function generate() {
  console.log(`Fetching metadata for ${CURATED_TITLES.length} Hallmark Christmas movies...`);
  const movies = [];

  for (const title of CURATED_TITLES) {
    try {
      process.stdout.write(`Fetching "${title}"... `);
      const searchData = await tmdbFetch('search/movie', {
        query: title,
        include_adult: 'false'
      });

      if (!searchData.results || searchData.results.length === 0) {
        console.log('not found on TMDB');
        continue;
      }

      // Pick result with a poster image, preferring the first result
      const match = searchData.results.find(m => m.poster_path) || searchData.results[0];
      
      // Fetch full details including external IDs for IMDb ID
      const details = await tmdbFetch(`movie/${match.id}`, {
        append_to_response: 'external_ids'
      });

      const releaseYear = details.release_date ? parseInt(details.release_date.split('-')[0], 10) : null;
      const poster = await ensureCachedImage({ kind: 'poster', id: details.id, filePath: details.poster_path, rootDir: __dirname });
      const imdbId = details.external_ids?.imdb_id || null;

      movies.push({
        title: details.title || title,
      year: releaseYear,
      release_date: details.release_date || null,
        tmdbId: details.id,
        imdbId: imdbId,
        tmdb_id: details.id,
        imdb_id: imdbId,
        poster: poster.path,
        overview: details.overview || '',
        vote_average: Number.isFinite(Number(details.vote_average)) ? Number(details.vote_average) : null,
        vote_count: Number.isFinite(Number(details.vote_count)) ? Number(details.vote_count) : null
      });

      console.log(`OK (ID: ${details.id}, Year: ${releaseYear})`);
      
      // Gentle pause to respect TMDB rate limits
      await new Promise(r => setTimeout(r, 200));
    } catch (err) {
      console.log(`FAILED: ${err.message}`);
    }
  }

  const outputJson = JSON.stringify(movies, null, 2);
  const rootPath = path.join(__dirname, 'movies.json');
  const publicPath = path.join(__dirname, 'public', 'movies.json');

  fs.writeFileSync(rootPath, outputJson, 'utf8');
  console.log(`\nSuccessfully wrote ${movies.length} movies to ${rootPath}`);

  if (fs.existsSync(path.join(__dirname, 'public'))) {
    fs.writeFileSync(publicPath, outputJson, 'utf8');
    console.log(`Also updated ${publicPath}`);
  }

  // Automatically generate per-year JSON files (e.g. /json/2025.json)
  const years = [...new Set(movies.map(m => m.year).filter(Boolean))].sort((a, b) => b - a);
  const jsonDir = path.join(__dirname, 'json');
  const publicJsonDir = path.join(__dirname, 'public', 'json');

  if (!fs.existsSync(jsonDir)) fs.mkdirSync(jsonDir, { recursive: true });
  if (!fs.existsSync(publicJsonDir)) fs.mkdirSync(publicJsonDir, { recursive: true });

  years.forEach(year => {
    const filtered = movies.filter(m => m.year === year);
    const yearJson = JSON.stringify(filtered, null, 2);
    fs.writeFileSync(path.join(jsonDir, `${year}.json`), yearJson, 'utf8');
    fs.writeFileSync(path.join(publicJsonDir, `${year}.json`), yearJson, 'utf8');
  });

  const castPath = path.join(__dirname, 'cast.json');
  if (fs.existsSync(castPath)) {
    generateRadarrFeeds(movies, JSON.parse(fs.readFileSync(castPath, 'utf8')));
  }

  console.log(`Successfully generated ${years.length} year JSON files in /json and /public/json: ${years.join(', ')}`);

  console.log('\nDone! Your movies.json and per-year JSON files are clean, public, and contain zero API keys.');
}

generate().catch(err => {
  console.error('Fatal error generating movies.json:', err);
  process.exit(1);
});
