import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { ensureCachedImage } from './local-assets.js';

const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export function normalizeProfilePath(value) {
  if (typeof value !== 'string') return null;
  const clean = value.trim();
  if (!clean || ['null', 'undefined', '[object Object]'].includes(clean)) return null;
  const match = clean.match(/^https?:\/\/image\.tmdb\.org\/t\/p\/[^/]+(\/.+)$/);
  if (match) return match[1];
  if (clean.startsWith('/')) return clean;
  if (/^(https?:|data:)/.test(clean)) return clean;
  return `/${clean}`;
}

function readJson(file, fallback) {
  return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : fallback;
}

function resolveToken(token) {
  return (token || process.env.TMDB_API_KEY || process.env.TMDB_TOKEN || process.env.TMDB_KEY || process.env.TMDB_BEARER_TOKEN || '').trim();
}

export function loadPersonCache(rootDir = ROOT_DIR) {
  return readJson(path.join(rootDir, 'person-cache.json'), {});
}

export function savePersonCache(cache, rootDir = ROOT_DIR) {
  fs.writeFileSync(path.join(rootDir, 'person-cache.json'), JSON.stringify(cache, null, 2), 'utf8');
}

export async function fetchTmdb(endpoint, params = {}, token = '') {
  const activeToken = resolveToken(token);
  if (!activeToken) {
    const err = new Error('No TMDB credential configured. Set TMDB_API_KEY or TMDB_TOKEN.');
    err.status = 401;
    throw err;
  }
  const url = new URL(`https://api.themoviedb.org/3/${endpoint}`);
  const headers = { Accept: 'application/json' };
  if (activeToken.length > 40 || activeToken.startsWith('ey')) {
    headers.Authorization = `Bearer ${activeToken}`;
  } else {
    url.searchParams.set('api_key', activeToken);
  }
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') url.searchParams.set(key, value);
  }
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      const res = await fetch(url, { headers, signal: AbortSignal.timeout(30000) });
      if (!res.ok) {
        const err = new Error(`TMDB ${endpoint}: HTTP ${res.status} ${res.statusText}`);
        err.status = res.status;
        err.statusText = res.statusText;
        err.endpoint = `https://api.themoviedb.org/3/${endpoint}`;
        const retryAfter = Number(res.headers.get('Retry-After'));
        err.retryDelay = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : attempt * 1000;
        throw err;
      }
      return { data: await res.json(), status: res.status, statusText: res.statusText, endpoint: `https://api.themoviedb.org/3/${endpoint}` };
    } catch (err) {
      if (attempt === 4 || (err.status && err.status !== 429 && err.status < 500)) throw err;
      await new Promise(resolve => setTimeout(resolve, err.retryDelay || attempt * 1000));
    }
  }
}

export async function fetchTmdbPerson(personId, token, personCache = {}, forceRefresh = false) {
  const id = Number(personId);
  if (!Number.isSafeInteger(id) || id <= 0) throw new Error(`Invalid TMDB person ID: ${personId}`);
  const cached = personCache[String(id)];
  if (!forceRefresh && cached?.fetchedFromTmdb && cached.enrichmentVersion === 2) return cached;
  const { data: person } = await fetchTmdb(`person/${id}`, {}, token);
  if (Number(person.id) !== id || typeof person.name !== 'string' || !person.name.trim()) {
    throw new Error(`Invalid TMDB person response for ${id}`);
  }
  let profilePath = normalizeProfilePath(person.profile_path);
  let photoRecoveredFromImages = false;
  let imagesChecked = false;
  if (!profilePath) {
    const { data: images } = await fetchTmdb(`person/${id}/images`, {}, token);
    if (!Array.isArray(images.profiles)) throw new Error(`Invalid TMDB images response for ${id}`);
    imagesChecked = true;
    const image = images.profiles.find(item => normalizeProfilePath(item?.file_path));
    profilePath = normalizeProfilePath(image?.file_path);
    photoRecoveredFromImages = Boolean(profilePath);
  }
  const record = {
    id,
    name: person.name.trim(),
    birthday: person.birthday || null,
    deathday: person.deathday || null,
    profile_path: profilePath,
    known_for_department: person.known_for_department || 'Acting',
    fetchedFromTmdb: true,
    enrichmentVersion: 2,
    imagesChecked,
    photoRecoveredFromImages,
    lastUpdated: new Date().toISOString()
  };
  personCache[String(id)] = record;
  return record;
}

function movieId(movie) {
  const id = Number(movie.tmdbId || movie.tmdb_id);
  if (!Number.isSafeInteger(id) || id <= 0) throw new Error(`Movie has no valid TMDB ID: ${movie.title || ''}`);
  if (movie.tmdbId && movie.tmdb_id && Number(movie.tmdbId) !== Number(movie.tmdb_id)) {
    throw new Error(`Conflicting TMDB movie IDs: ${movie.title || id}`);
  }
  return id;
}

export function buildCastData(movies, rawMovieCast, personCache = {}) {
  const castByMovieId = {};
  const actorMap = new Map();
  for (const movie of movies) {
    const tmdbId = movieId(movie);
    if (Object.hasOwn(castByMovieId, tmdbId)) throw new Error(`Duplicate TMDB movie ID: ${tmdbId}`);
    const rawList = rawMovieCast[String(tmdbId)] || [];
    if (!Array.isArray(rawList)) throw new Error(`Invalid cast array for movie ${tmdbId}`);
    const list = rawList.map((entry, index) => {
      const credit = typeof entry === 'string' ? { name: entry } : entry;
      if (!credit || typeof credit !== 'object') throw new Error(`Invalid cast record for movie ${tmdbId}`);
      let id = credit.id ? Number(credit.id) : null;
      let person = id ? personCache[String(id)] : null;
      if (!id && credit.name) {
        const matches = Object.values(personCache).filter(p => p.name?.toLowerCase().trim() === credit.name.toLowerCase().trim());
        if (matches.length === 1) {
          person = matches[0];
          id = Number(person.id);
        }
      }
      return {
        id,
        name: person?.name || credit.name || '',
        character: credit.character ?? '',
        order: credit.order ?? index,
        birthday: (person ? person.birthday : credit.birthday) || null,
        deathday: (person ? person.deathday : credit.deathday) || null,
         profile_path: normalizeProfilePath(person ? person.profile_path : credit.profile_path),
         profile: normalizeProfilePath(person ? person.profile_path : credit.profile_path)
       };
    });
    castByMovieId[String(tmdbId)] = list;
    const seenInMovie = new Set();
    for (const person of list) {
      if (!person.id || seenInMovie.has(person.id)) continue;
      seenInMovie.add(person.id);
      if (!actorMap.has(person.id)) {
        actorMap.set(person.id, {
          id: person.id,
          name: person.name,
          count: 0,
          slug: person.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''),
         profile_path: person.profile_path,
           profile: person.profile_path,
          birthday: person.birthday,
          deathday: person.deathday,
          movieTmdbIds: []
        });
      }
      const actor = actorMap.get(person.id);
      actor.count++;
      actor.movieTmdbIds.push(tmdbId);
    }
  }
  const actors = Array.from(actorMap.values()).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  return {
    generatedAt: new Date().toISOString(),
    totalActors: actors.length,
    totalMovies: movies.length,
    actors,
    castByMovieId,
    movieCast: castByMovieId
  };
}

function writeCastData(castData, rootDir) {
  const output = JSON.stringify(castData, null, 2);
  const targets = [rootDir, path.join(rootDir, 'public'), path.join(rootDir, 'dist')];
  for (const target of targets) {
    if (!fs.existsSync(target)) continue;
    const file = path.join(target, 'cast.json');
    fs.writeFileSync(`${file}.tmp`, output, 'utf8');
    const saved = readJson(`${file}.tmp`, {});
    if (JSON.stringify(saved) !== JSON.stringify(castData)) throw new Error(`Cast verification failed: ${file}`);
    fs.renameSync(`${file}.tmp`, file);
  }
}

export function enrichCastData(providedMovieCast = null, existingPersonCache = null, rootDir = ROOT_DIR) {
  const movies = readJson(path.join(rootDir, 'movies.json'), []);
  const existing = readJson(path.join(rootDir, 'cast.json'), {});
  const seeds = readJson(path.join(rootDir, 'cast-seed.json'), {});
  const rawMovieCast = { ...seeds, ...existing.movieCast, ...existing.castByMovieId, ...providedMovieCast };
  const data = buildCastData(movies, rawMovieCast, existingPersonCache || loadPersonCache(rootDir));
  writeCastData(data, rootDir);
  return data;
}

export function getUniquePersonIdsFromCast(rootDir = ROOT_DIR) {
  const cast = readJson(path.join(rootDir, 'cast.json'), {});
  const ids = new Set();
  for (const actor of cast.actors || []) if (actor.id) ids.add(Number(actor.id));
  for (const list of Object.values({ ...cast.movieCast, ...cast.castByMovieId })) {
    for (const person of list) if (person.id) ids.add(Number(person.id));
  }
  return [...ids].filter(id => Number.isSafeInteger(id) && id > 0);
}

export async function refreshActorsFromTmdb({ token, onProgress = null, personIds = null, rootDir = ROOT_DIR }) {
  const ids = [...new Set(personIds?.length ? personIds.map(Number) : getUniquePersonIdsFromCast(rootDir))];
  const cache = loadPersonCache(rootDir);
  let updated = 0;
  let noPhoto = 0;
  let failed = 0;
  for (const id of ids) {
    try {
      const record = await fetchTmdbPerson(id, token, cache, true);
      const image = await ensureCachedImage({ kind: 'person', id, filePath: record.profile_path, rootDir });
      if (image.path) {
        record.profile_path = image.path;
        record.profile = image.path;
      }
      updated++;
      if (!record.profile_path) noPhoto++;
    } catch (err) {
      if (err.status === 401 || err.status === 403) throw err;
      failed++;
      console.warn(`Actor refresh failed for ${id}: ${err.message}`);
    }
    onProgress?.({ current: updated + failed, total: ids.length, updated, noPhoto, failed, personId: id });
  }
  savePersonCache(cache, rootDir);
  const castData = enrichCastData(null, cache, rootDir);
  return { success: failed === 0, total: ids.length, updated, noPhoto, failed, castData };
}

async function fetchMovieCast(id, token) {
  const { data } = await fetchTmdb(`movie/${id}/credits`, {}, token);
  if (Number(data.id) !== id || !Array.isArray(data.cast)) throw new Error(`Invalid TMDB credits response for ${id}`);
  return data.cast;
}

export async function inspectMovieCast({ tmdbId = 1545999, token, rootDir = ROOT_DIR, log = console.log }) {
  const id = Number(tmdbId);
  const rawCast = await fetchMovieCast(id, token);
  log(`TMDB CAST COUNT: ${rawCast.length}`);
  for (const person of rawCast) {
    log(JSON.stringify({ 'person.id': person.id, 'person.name': person.name, character: person.character, order: person.order, profile_path: person.profile_path }));
  }
  const existing = readJson(path.join(rootDir, 'cast.json'), {});
  const saved = existing.castByMovieId?.[id] || existing.movieCast?.[id] || [];
  log(`TMDB returned: ${rawCast.length} cast members`);
  log(`cast.json contains: ${saved.length} cast members`);
  const savedIds = new Set(saved.map(person => Number(person.id)));
  const missing = rawCast.filter(person => !savedIds.has(Number(person.id)));
  log('MISSING FROM cast.json:');
  for (const person of missing) log(`${person.id} - ${person.name}`);
  if (!missing.length) log('(none)');
  return rawCast;
}

export async function rebuildAllCastFromTmdb({ token, rootDir = ROOT_DIR, log = console.log, onProgress = null } = {}) {
  const report = { moviesProcessed: 0, tmdbCastRecordsReturned: 0, castRecordsWritten: 0, uniquePeople: 0, peopleEnriched: 0, birthdaysFound: 0, photosFound: 0, photosRecoveredThroughImages: 0, peopleGenuinelyWithoutPhotos: 0, apiFailures: 0 };
  const movies = readJson(path.join(rootDir, 'movies.json'), []);
  if (!Array.isArray(movies) || !movies.length) throw new Error('movies.json must contain a nonempty movie collection.');
  const ids = movies.map(movieId);
  if (new Set(ids).size !== ids.length) throw new Error('Duplicate TMDB movie IDs in movies.json.');
  const rawMovieCast = {};
  const personIds = new Set();
  const cache = {};
  const labels = {
    moviesProcessed: 'Movies processed', tmdbCastRecordsReturned: 'TMDB cast records returned',
    castRecordsWritten: 'Cast records written', uniquePeople: 'Unique people', peopleEnriched: 'People enriched',
    birthdaysFound: 'Birthdays found', photosFound: 'Photos found', photosRecoveredThroughImages: 'Photos recovered through /images',
    peopleGenuinelyWithoutPhotos: 'People genuinely without photos', apiFailures: 'API failures'
  };
  try {
    const inspected = await inspectMovieCast({ token, rootDir, log });
    for (const id of ids) {
      const rawCast = id === 1545999 ? inspected : await fetchMovieCast(id, token);
      rawMovieCast[String(id)] = rawCast;
      report.moviesProcessed++;
      report.tmdbCastRecordsReturned += rawCast.length;
      for (const person of rawCast) {
        if (!Number.isSafeInteger(person.id) || person.id <= 0) throw new Error(`Invalid person ID in movie ${id}`);
        personIds.add(person.id);
      }
      report.uniquePeople = personIds.size;
      onProgress?.({ phase: 'credits', current: report.moviesProcessed, total: movies.length });
    }
    for (const id of personIds) {
      const person = await fetchTmdbPerson(id, token, cache, true);
      const image = await ensureCachedImage({ kind: 'person', id, filePath: person.profile_path, rootDir });
      if (image.path) {
        person.profile_path = image.path;
        person.profile = image.path;
      }
      report.peopleEnriched++;
      if (person.birthday) report.birthdaysFound++;
      if (person.profile_path) report.photosFound++;
      if (person.photoRecoveredFromImages) report.photosRecoveredThroughImages++;
      if (!person.profile_path && person.imagesChecked) report.peopleGenuinelyWithoutPhotos++;
      onProgress?.({ phase: 'people', current: report.peopleEnriched, total: personIds.size });
    }
  } catch (err) {
    report.apiFailures++;
    for (const [key, label] of Object.entries(labels)) log(`${label}: ${report[key]}`);
    log('Rebuild aborted; existing cast.json and person-cache.json were not replaced.');
    err.report = report;
    throw err;
  }
  const castData = buildCastData(movies, rawMovieCast, cache);
  writeCastData(castData, rootDir);
  const saved = readJson(path.join(rootDir, 'cast.json'), {});
  for (const id of ids) {
    const list = saved.castByMovieId?.[id];
    const raw = rawMovieCast[id];
    if (!Array.isArray(list) || list.length !== raw.length || list.some((person, index) => person.id !== raw[index].id || person.character !== (raw[index].character ?? '') || person.order !== (raw[index].order ?? index))) {
      throw new Error(`Saved cast verification failed for movie ${id}`);
    }
    report.castRecordsWritten += list.length;
    log(`Movie ${id}: TMDB cast count: ${raw.length}; saved cast count: ${list.length}`);
  }
  savePersonCache(cache, rootDir);
  for (const [key, label] of Object.entries(labels)) log(`${label}: ${report[key]}`);
  if (rawMovieCast['1545999']) {
    log('Christmas at the Catnip Café (1545999)');
    log(`TMDB cast count: ${rawMovieCast['1545999'].length}`);
    log(`Saved cast count: ${saved.castByMovieId['1545999'].length}`);
    log('Rendered cast count: not browser-verified; movie.js renders every saved cast record without a display limit.');
  }
  return { success: true, ...report, castData: saved };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const tokenArg = args.find(arg => arg.startsWith('--token='));
  const token = tokenArg ? tokenArg.substring('--token='.length) : resolveToken();
  const run = async () => {
    if (args.includes('--rebuild')) {
      console.log('REBUILD ALL CAST DATA FROM TMDB');
      await rebuildAllCastFromTmdb({ token });
    } else if (args.includes('--inspect')) {
      await inspectMovieCast({ token });
    } else if (args.includes('--refresh')) {
      console.log('REFRESH ACTOR DATA FROM TMDB');
      const result = await refreshActorsFromTmdb({ token });
      console.log(`People updated: ${result.updated}; no photo: ${result.noPhoto}; API failures: ${result.failed}`);
      if (!result.success) process.exitCode = 1;
    } else {
      enrichCastData();
      console.log('Cast data regenerated from saved membership and person cache; no TMDB credits fetched.');
    }
  };
  run().catch(err => {
    console.error(err.message);
    process.exitCode = 1;
  });
}
