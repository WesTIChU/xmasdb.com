import 'dotenv/config';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { MOVIES } from '../src/data/movies';
import { Movie } from '../src/types';
import { fetchTmdbMovie, requireTmdbApiKey } from '../src/utils/tmdb';
import { enrichCataloguePeople } from '../src/utils/person-enrichment';
import { reconcileMovieLifecycle } from '../src/utils/catalogue-lifecycle';
import { writeFileAtomically } from '../src/utils/atomic-file';
import { cacheLocalImage } from '../src/utils/local-images';

const moviesPath = path.join(process.cwd(), 'src/data/movies.ts');
const refreshReportPath = path.join(process.cwd(), 'src/data/refresh-report.json');
const execFileAsync = promisify(execFile);

function parseOption(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function localAssetPath(kind: 'posters' | 'backdrops' | 'people', id: number): string {
  return `/images/${kind}/${id}.jpg`;
}

function mergeMovie(movie: Movie, refreshed: Partial<Movie>, posterUrl?: string, backdropUrl?: string): Movie {
  const safeMetadata = Object.fromEntries(
    Object.entries(refreshed).filter(([, value]) => (
      value !== undefined && value !== null &&
      !(typeof value === 'string' && value.trim() === '') &&
      !(Array.isArray(value) && value.length === 0)
    ))
  );
  return {
    ...movie,
    ...safeMetadata,
    id: movie.id,
    slug: movie.slug,
    brandId: movie.brandId,
    status: movie.status,
    isComingSoon: movie.isComingSoon,
    premiereDate: movie.premiereDate,
    releaseDate: movie.premiereDate || movie.releaseDate,
    posterUrl: posterUrl || movie.posterUrl,
    backdropUrl: backdropUrl || movie.backdropUrl,
    tmdbUpdatedAt: new Date().toISOString(),
  };
}

function generatedMoviesModule(movies: Movie[]): string {
  return `import { Movie } from '../types';\n\nexport const MOVIES: Movie[] = ${JSON.stringify(movies, null, 2)};\n\nexport function getMovieBySlug(slug: string): Movie | undefined { return MOVIES.find((m) => m.slug.toLowerCase() === slug.toLowerCase()); }\nexport function getMovieByTmdbId(tmdbId: number): Movie | undefined { return MOVIES.find((m) => m.tmdbId === tmdbId); }\nexport function getMovieByTmdbIdAndSlug(tmdbId: number, slug?: string): Movie | undefined { return getMovieByTmdbId(tmdbId) || (slug ? getMovieBySlug(slug) : undefined); }\nexport function getMovieByIdentifier(identifier: string | number): Movie | undefined { const value = String(identifier).trim(); return /^\\d+$/.test(value) ? getMovieByTmdbId(Number(value)) || getMovieBySlug(value) : getMovieBySlug(value); }\nexport function getMoviesByBrand(brandId: string): Movie[] { return MOVIES.filter((m) => m.brandId.toLowerCase() === brandId.toLowerCase()); }\nexport function getMoviesByActorSlug(actorSlug: string): Movie[] { return MOVIES.filter((m) => m.cast.some((c) => c.slug.toLowerCase() === actorSlug.toLowerCase())); }\nexport function getAllYearsForBrand(brandId?: string): number[] { const filtered = brandId ? getMoviesByBrand(brandId) : MOVIES; return Array.from(new Set(filtered.map((m) => m.year))).sort((a, b) => b - a); }\n`;
}

async function refreshMovie(movie: Movie, apiKey: string): Promise<Movie> {
  const refreshed = await fetchTmdbMovie(movie.tmdbId, apiKey);
  if (!refreshed) throw new Error(`TMDB returned no movie data for ${movie.tmdbId}`);
  const posterUrl = await cacheLocalImage(refreshed.posterUrl, localAssetPath('posters', movie.tmdbId));
  const backdropUrl = await cacheLocalImage(refreshed.backdropUrl, localAssetPath('backdrops', movie.tmdbId));
  return mergeMovie(movie, refreshed, posterUrl, backdropUrl);
}

async function main() {
  const apiKey = requireTmdbApiKey();
  const requestedId = parseOption('--movie') || parseOption('--tmdb-id');
  const checkOnly = process.argv.includes('--check');
  const skipBuild = process.argv.includes('--skip-build');
  const targets = requestedId
    ? MOVIES.filter((movie) => movie.tmdbId === Number(requestedId))
    : MOVIES;

  if (requestedId && targets.length === 0) throw new Error(`No local movie found with TMDB ID ${requestedId}.`);
  if (checkOnly) {
    const target = targets[0] || MOVIES[0];
    if (!target) throw new Error('No local movies are available for an authentication check.');
    const result = await fetchTmdbMovie(target.tmdbId, apiKey);
    if (!result) throw new Error(`TMDB authentication check failed for movie ${target.tmdbId}.`);
    console.log(`TMDB authentication succeeded using local movie ${target.tmdbId}.`);
    return;
  }

  const refreshedMovies: Movie[] = [];
  const failures: Array<{ tmdbId: number; title: string; message: string }> = [];
  for (const movie of targets) {
    try {
      const refreshed = await refreshMovie(movie, apiKey);
      refreshedMovies.push(refreshed);
      console.log(`Refreshed movie ${movie.tmdbId}: ${movie.title}`);
    } catch (error) {
      console.error(`Failed movie ${movie.tmdbId} (${movie.title}): ${error instanceof Error ? error.message : String(error)}`);
      failures.push({ tmdbId: movie.tmdbId, title: movie.title, message: error instanceof Error ? error.message : String(error) });
      refreshedMovies.push(movie);
    }
    await new Promise((resolve) => setTimeout(resolve, 150));
  }

  const refreshedById = new Map(refreshedMovies.map((movie) => [movie.tmdbId, movie]));
  const mergedMovies = MOVIES.map((movie) => reconcileMovieLifecycle(refreshedById.get(movie.tmdbId) || movie));
  const peopleMovies = requestedId ? mergedMovies.filter((movie) => movie.tmdbId === Number(requestedId)) : mergedMovies;
  const peopleResult = await enrichCataloguePeople(peopleMovies, apiKey, undefined, (current, total, person) => {
    console.log(`[TMDB Person] ${current}/${total} ${person.name} (${person.tmdbPersonId})`);
  });
  const actorsById = new Map(peopleResult.actors.map((actor) => [actor.tmdbPersonId, actor]));
  const localMovies = mergedMovies.map((movie) => ({
    ...movie,
    cast: movie.cast.map((cast) => {
      const actor = cast.tmdbPersonId ? actorsById.get(cast.tmdbPersonId) : undefined;
      return actor ? {
        ...cast,
        profileUrl: actor.profileUrl || actor.photoUrl || cast.profileUrl,
        birthday: actor.birthday || cast.birthday,
        deathday: actor.deathday || cast.deathday,
      } : cast;
    }),
  }));
  await writeFileAtomically(moviesPath, generatedMoviesModule(localMovies));
  console.log(`Catalogue movies: ${MOVIES.length}`);
  console.log(`Movies with TMDB IDs: ${MOVIES.filter((movie) => movie.tmdbId > 0).length}`);
  console.log(`Movies successfully refreshed: ${targets.length - failures.length}`);
  console.log(`Movies that failed: ${failures.length}`);
  console.log(`Movies with TMDB rating: ${localMovies.filter((movie) => typeof movie.voteAverage === 'number' && movie.voteAverage > 0).length}`);
  console.log(`Movies without TMDB rating: ${localMovies.filter((movie) => typeof movie.voteAverage !== 'number' || movie.voteAverage <= 0).length}`);
  console.log(`Unique XmasDB actors: ${peopleResult.total}`);
  console.log(`Actors refreshed: ${peopleResult.updated}`);
  console.log(`Actors that failed: ${peopleResult.failures.length}`);
  if (failures.length > 0) failures.forEach((failure) => console.error(`- Movie ${failure.tmdbId} ${failure.title}: ${failure.message}`));
  if (peopleResult.failures.length > 0) peopleResult.failures.forEach((failure) => console.error(`- Person ${failure.tmdbPersonId} ${failure.name}: ${failure.message}`));
  await writeFileAtomically(refreshReportPath, JSON.stringify({
    refreshedAt: new Date().toISOString(),
    catalogueMovies: MOVIES.length,
    moviesWithTmdbIds: MOVIES.filter((movie) => movie.tmdbId > 0).length,
    moviesSuccessfullyRefreshed: targets.length - failures.length,
    movieFailures: failures,
    moviesWithTmdbRating: localMovies.filter((movie) => typeof movie.voteAverage === 'number' && movie.voteAverage > 0).length,
    moviesWithoutTmdbRating: localMovies.filter((movie) => typeof movie.voteAverage !== 'number' || movie.voteAverage <= 0).length,
    uniqueCatalogueActors: peopleResult.total,
    actorsSuccessfullyRefreshed: peopleResult.updated,
    actorFailures: peopleResult.failures,
  }, null, 2));
  if (!skipBuild) {
    console.log('Regenerating the local production bundle...');
    await execFileAsync('npm', ['run', 'build'], { cwd: process.cwd() });
  }
  if (failures.length > 0 || peopleResult.failures.length > 0) process.exitCode = 1;
}

main().catch((error) => {
  console.error(`[TMDB Refresh] ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
