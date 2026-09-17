import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ensureCachedImage, localImagePath, sourceImagePath } from './local-assets.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = file => JSON.parse(fs.readFileSync(path.join(ROOT, file), 'utf8'));
const writeAtomic = async (file, value) => {
  const target = path.join(ROOT, file);
  const temp = `${target}.${process.pid}.tmp`;
  await fs.promises.writeFile(temp, JSON.stringify(value, null, 2), 'utf8');
  await fs.promises.rename(temp, target);
};

const movies = read('movies.json');
const cast = read('cast.json');
const personCache = fs.existsSync(path.join(ROOT, 'person-cache.json')) ? read('person-cache.json') : {};
const report = { movies: 0, postersDownloaded: 0, postersCached: 0, people: 0, profilesDownloaded: 0, profilesCached: 0, missing: 0, failures: 0 };
const failures = [];

function movieId(movie) { return Number(movie.tmdbId || movie.tmdb_id); }
function collectPeople() {
  const people = new Map();
  for (const actor of cast.actors || []) if (actor?.id) people.set(Number(actor.id), actor);
  for (const list of Object.values({ ...(cast.castByMovieId || {}), ...(cast.movieCast || {}) })) {
    for (const person of list || []) if (person?.id && !people.has(Number(person.id))) people.set(Number(person.id), person);
  }
  for (const [id, person] of Object.entries(personCache)) if (Number(id) > 0 && !people.has(Number(id))) people.set(Number(id), person);
  return people;
}

async function cache(kind, id, filePath) {
  const result = await ensureCachedImage({ kind, id, filePath, rootDir: ROOT });
  if (result.status === 'downloaded') kind === 'poster' ? report.postersDownloaded++ : report.profilesDownloaded++;
  if (result.status === 'cached') kind === 'poster' ? report.postersCached++ : report.profilesCached++;
  if (result.status === 'missing') report.missing++;
  if (result.status === 'failed') { report.failures++; failures.push(`${kind} ${id}: ${result.error.message}`); }
  return result;
}

for (const movie of movies) {
  const id = movieId(movie);
  if (!Number.isSafeInteger(id) || id <= 0) continue;
  report.movies++;
  const result = await cache('poster', id, movie.poster);
  movie.poster = result.path || null;
}

const people = collectPeople();
for (const [id, person] of people) {
  report.people++;
  const cached = personCache[String(id)] || {};
  const result = await cache('person', id, person.profile || person.profile_path || cached.profile || cached.profile_path);
  if (result.path) {
    if (person.profile_path !== undefined) person.profile_path = result.path;
    person.profile = result.path;
    if (personCache[String(id)]) { personCache[String(id)].profile_path = result.path; personCache[String(id)].profile = result.path; }
    for (const list of Object.values({ ...(cast.castByMovieId || {}), ...(cast.movieCast || {}) })) for (const entry of list || []) if (Number(entry?.id) === id) { entry.profile_path = result.path; entry.profile = result.path; }
  } else {
    person.profile = null;
    if (person.profile_path !== undefined) person.profile_path = null;
    if (personCache[String(id)]) { personCache[String(id)].profile_path = null; personCache[String(id)].profile = null; }
    for (const list of Object.values({ ...(cast.castByMovieId || {}), ...(cast.movieCast || {}) })) for (const entry of list || []) if (Number(entry?.id) === id) { entry.profile_path = null; entry.profile = null; }
  }
}

await writeAtomic('movies.json', movies);
await writeAtomic('cast.json', cast);
await writeAtomic('person-cache.json', personCache);
for (const target of ['public', 'dist']) {
  if (!fs.existsSync(path.join(ROOT, target))) continue;
  await fs.promises.copyFile(path.join(ROOT, 'movies.json'), path.join(ROOT, target, 'movies.json'));
  await fs.promises.copyFile(path.join(ROOT, 'cast.json'), path.join(ROOT, target, 'cast.json'));
  for (const year of new Set(movies.map(movie => movie.year).filter(Boolean))) {
    const yearMovies = movies.filter(movie => movie.year === year);
    const dir = path.join(ROOT, target, 'json');
    await fs.promises.mkdir(dir, { recursive: true });
    await fs.promises.writeFile(path.join(dir, `${year}.json`), JSON.stringify(yearMovies, null, 2), 'utf8');
  }
}
console.log(`Movies processed: ${report.movies}`);
console.log(`Posters downloaded: ${report.postersDownloaded}`);
console.log(`Posters already cached: ${report.postersCached}`);
console.log(`People processed: ${report.people}`);
console.log(`Profile images downloaded: ${report.profilesDownloaded}`);
console.log(`Profile images already cached: ${report.profilesCached}`);
console.log(`Missing TMDB images: ${report.missing}`);
console.log(`Download failures: ${report.failures}`);
for (const failure of failures) console.warn(failure);
