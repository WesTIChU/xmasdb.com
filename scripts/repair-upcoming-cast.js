import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { fetchTmdb, loadPersonCache, savePersonCache, enrichCastData } from './enrich-cast.js';
import { enrichMovieCast } from './enrich-movie-cast.js';
import { getUpcomingMovies, saveUpcomingMovies } from '../movie-storage.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const token = (process.env.TMDB_API_KEY || process.env.TMDB_TOKEN || process.env.TMDB_KEY || process.env.TMDB_BEARER_TOKEN || '').trim();
if (!token) throw new Error('No TMDB credential configured. Set TMDB_API_KEY or TMDB_TOKEN.');

const upcoming = getUpcomingMovies();
const personCache = loadPersonCache(ROOT);
const providedMovieCast = {};
const report = [];

for (const movie of upcoming) {
  const id = Number(movie.tmdbId || movie.tmdb_id);
  if (!Number.isSafeInteger(id) || id <= 0) throw new Error(`Invalid TMDB ID for ${movie.title || 'untitled upcoming movie'}.`);
  const before = Array.isArray(movie.cast) ? movie.cast.length : 0;
  const { data } = await fetchTmdb(`movie/${id}/credits`, {}, token);
  const enriched = await enrichMovieCast(data.cast, { token, personCache, rootDir: ROOT });
  const existingById = new Map((movie.cast || []).filter(person => person?.id).map(person => [String(person.id), person]));
  const merged = enriched.map(person => {
    const existing = existingById.get(String(person.id));
    return existing ? { ...person, ...existing, character: existing.character || person.character, order: person.order } : person;
  });
  const rawIds = new Set(merged.map(person => String(person.id)));
  merged.push(...(movie.cast || []).filter(person => person?.id && !rawIds.has(String(person.id))));
  movie.cast = merged;
  movie.castSummary = merged.slice(0, 8).map(person => person.name).join(', ');
  providedMovieCast[String(id)] = merged;
  report.push({ title: movie.title, tmdbId: id, before, after: merged.length });
}

savePersonCache(personCache, ROOT);
saveUpcomingMovies(upcoming);
enrichCastData(providedMovieCast, personCache, ROOT);

for (const item of report) console.log(`${item.title} | ${item.tmdbId} | cast ${item.before} -> ${item.after}`);
console.log(`Repaired ${report.length} upcoming movies and ${report.reduce((total, item) => total + item.after, 0)} cast records.`);
