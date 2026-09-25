import 'dotenv/config';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { MOVIES } from '../src/data/movies';
import { ACTORS } from '../src/data/actors';
import { Movie } from '../src/types';
import { fetchTmdbMovie, requireTmdbApiKey } from '../src/utils/tmdb';
import { enrichCataloguePeople } from '../src/utils/person-enrichment';
import { reconcileMovieLifecycle } from '../src/utils/catalogue-lifecycle';
import { writeFileAtomically } from '../src/utils/atomic-file';
import { refreshTmdbMovie, selectPeopleRefreshMovies } from '../src/utils/tmdb-refresh';
import { createImageRefreshBudget, getImageCacheFreshnessStats } from '../src/utils/local-images';
import { isTmdbFresh, timestampAgeDays } from '../src/utils/tmdb-freshness';
import { completeRefreshRun, createRefreshRun, startRefreshRun, type RefreshFailure, type RefreshRun } from '../src/server/tmdb-refresh-health';

const moviesPath = path.join(process.cwd(), 'src/data/movies.ts');
const refreshReportPath = path.join(process.cwd(), 'src/data/refresh-report.json');
const execFileAsync = promisify(execFile);
let activeRun: RefreshRun | undefined;

function parseOption(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function generatedMoviesModule(movies: Movie[]): string {
  return `import { Movie } from '../types';\n\nexport const MOVIES: Movie[] = ${JSON.stringify(movies, null, 2)};\n\nexport function getMovieBySlug(slug: string): Movie | undefined { return MOVIES.find((m) => m.slug.toLowerCase() === slug.toLowerCase()); }\nexport function getMovieByTmdbId(tmdbId: number): Movie | undefined { return MOVIES.find((m) => m.tmdbId === tmdbId); }\nexport function getMovieByTmdbIdAndSlug(tmdbId: number, slug?: string): Movie | undefined { return getMovieByTmdbId(tmdbId) || (slug ? getMovieBySlug(slug) : undefined); }\nexport function getMovieByIdentifier(identifier: string | number): Movie | undefined { const value = String(identifier).trim(); return /^\\d+$/.test(value) ? getMovieByTmdbId(Number(value)) || getMovieBySlug(value) : getMovieBySlug(value); }\nexport function getMoviesByBrand(brandId: string): Movie[] { return MOVIES.filter((m) => m.brandId.toLowerCase() === brandId.toLowerCase()); }\nexport function getMoviesByActorSlug(actorSlug: string): Movie[] { return MOVIES.filter((m) => m.cast.some((c) => c.slug.toLowerCase() === actorSlug.toLowerCase())); }\nexport function getAllYearsForBrand(brandId?: string): number[] { const filtered = brandId ? getMoviesByBrand(brandId) : MOVIES; return Array.from(new Set(filtered.map((m) => m.year))).sort((a, b) => b - a); }\n`;
}

async function main() {
  const requestedId = parseOption('--movie') || parseOption('--tmdb-id');
  const checkOnly = process.argv.includes('--check');
  const skipBuild = process.argv.includes('--skip-build');
  const comingSoonOnly = process.argv.includes('--coming-soon-only');
  const scheduledRun = process.env.GITHUB_EVENT_NAME === 'schedule';
  const runType = scheduledRun ? (comingSoonOnly ? 'coming-soon' : 'full') : 'manual' as const;
  activeRun = createRefreshRun(runType);
  await startRefreshRun(activeRun);
  const imageBudget = createImageRefreshBudget();
  const imageStatsBefore = await getImageCacheFreshnessStats();
  const legacyActorsBefore = ACTORS.filter((actor) => !actor.tmdbFetchedAt).length;
  const apiKey = requireTmdbApiKey();
  const candidateMovies = comingSoonOnly ? MOVIES.filter((movie) => movie.isComingSoon) : MOVIES;
  const targets = requestedId
    ? candidateMovies.filter((movie) => movie.tmdbId === Number(requestedId))
    : candidateMovies;

  if (requestedId && targets.length === 0) throw new Error(`No local movie found with TMDB ID ${requestedId}.`);
  if (checkOnly) {
    const target = targets[0] || MOVIES[0];
    if (!target) throw new Error('No local movies are available for an authentication check.');
    const result = await fetchTmdbMovie(target.tmdbId, apiKey);
    if (!result) throw new Error(`TMDB authentication check failed for movie ${target.tmdbId}.`);
    await completeRefreshRun(activeRun.id, {
      status: 'SUCCESS',
      counters: { ...activeRun.counters, moviesAttempted: 1, moviesSuccessful: 1, moviesUnchanged: 1 },
      failures: [],
      successKeys: [`movie:${target.tmdbId}`],
    });
    activeRun = undefined;
    console.log(`TMDB authentication succeeded using local movie ${target.tmdbId}.`);
    return;
  }

  const refreshedMovies: Movie[] = [];
  const failures: Array<{ tmdbId: number; title: string; message: string }> = [];
  for (const movie of targets) {
    try {
      const refreshed = await refreshTmdbMovie(movie, apiKey, undefined, imageBudget);
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
  const peopleMovies = selectPeopleRefreshMovies(mergedMovies, refreshedMovies, {
    comingSoonOnly,
    requestedId: requestedId ? Number(requestedId) : undefined,
  });
  const peopleResult = await enrichCataloguePeople(peopleMovies, apiKey, undefined, (current, total, person) => {
    console.log(`[TMDB Person] ${current}/${total} ${person.name} (${person.tmdbPersonId})`);
  }, { imageBudget });
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
  const now = new Date();
  const imageStats = await getImageCacheFreshnessStats(undefined, now);
  const freshMovies = localMovies.filter((movie) => isTmdbFresh(movie.tmdbFetchedAt, now)).length;
  const staleMovies = localMovies.length - freshMovies;
  const freshActors = peopleResult.actors.filter((actor) => isTmdbFresh(actor.tmdbFetchedAt, now)).length;
  const legacyActors = peopleResult.actors.filter((actor) => !actor.tmdbFetchedAt).length;
  const staleActors = peopleResult.actors.length - freshActors - legacyActors;
  const successfulFetches = [
    ...localMovies.map((movie) => movie.tmdbFetchedAt),
    ...peopleResult.actors.map((actor) => actor.tmdbFetchedAt),
    imageStats.oldestSuccessfulFetchAt,
  ].filter((timestamp): timestamp is string => Boolean(timestamp));
  const oldestSuccessfulFetchAt = successfulFetches.sort((a, b) => Date.parse(a) - Date.parse(b))[0];
  const runFailures: RefreshFailure[] = [
    ...failures.map((failure) => ({ key: `movie:${failure.tmdbId}`, kind: 'movie' as const, operation: 'fetch movie metadata', tmdbId: failure.tmdbId, message: failure.message, timestamp: now.toISOString() })),
    ...peopleResult.failures.map((failure) => ({ key: `actor:${failure.tmdbPersonId}`, kind: 'actor' as const, operation: 'fetch person metadata', tmdbId: failure.tmdbPersonId, message: failure.message, timestamp: now.toISOString() })),
    ...imageBudget.failureDetails.map((failure) => ({ key: `image:${failure.localPath}`, kind: 'image' as const, operation: 'download/revalidate image', message: failure.message, timestamp: now.toISOString() })),
  ];
  const failedMovieIds = new Set(failures.map((failure) => failure.tmdbId));
  const successfulMovies = refreshedMovies.filter((movie) => !failedMovieIds.has(movie.tmdbId));
  const changedMovies = successfulMovies.filter((movie) => movie.tmdbUpdatedAt !== MOVIES.find((original) => original.tmdbId === movie.tmdbId)?.tmdbUpdatedAt);
  const successfulKeys = [
    ...successfulMovies.map((movie) => `movie:${movie.tmdbId}`),
    ...peopleResult.attemptedIds.filter((personId) => !peopleResult.failures.some((failure) => failure.tmdbPersonId === personId)).map((personId) => `actor:${personId}`),
  ];
  if (activeRun) {
    await completeRefreshRun(activeRun.id, {
      status: runFailures.length > 0 ? 'PARTIAL' : 'SUCCESS',
      counters: {
        moviesAttempted: targets.length,
        moviesSuccessful: targets.length - failures.length,
        moviesChanged: changedMovies.length,
        moviesUnchanged: successfulMovies.length - changedMovies.length,
        moviesFailed: failures.length,
        actorsAttempted: peopleResult.incomplete,
        actorsSuccessful: peopleResult.updated,
        actorsFailed: peopleResult.failures.length,
        actorsSkippedFresh: Math.max(0, peopleResult.total - peopleResult.incomplete),
        imagesAttempted: imageBudget.attempted,
        imagesSuccessful: imageBudget.succeeded,
        imagesFailed: imageBudget.failed,
        posterImagesSuccessful: imageBudget.byType.posters.succeeded,
        backdropImagesSuccessful: imageBudget.byType.backdrops.succeeded,
        peopleImagesSuccessful: imageBudget.byType.people.succeeded,
        posterImagesFailed: imageBudget.byType.posters.failed,
        backdropImagesFailed: imageBudget.byType.backdrops.failed,
        peopleImagesFailed: imageBudget.byType.people.failed,
      },
      failures: runFailures,
      successKeys: successfulKeys,
      freshness: { freshMovies, staleMovies, freshActors, staleActors, legacyActors, freshImages: imageStats.freshImages, staleImages: imageStats.staleImages, legacyImages: imageStats.legacyImages, oldestSuccessfulFetchAt },
      legacyActorsBefore,
      legacyActorsProcessed: Math.max(0, legacyActorsBefore - legacyActors),
      legacyImagesBefore: imageStatsBefore.legacyImages,
      legacyImagesProcessed: Math.max(0, imageStatsBefore.legacyImages - imageStats.legacyImages),
    });
  }
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
    freshMovieRecords: freshMovies,
    staleMovieRecords: staleMovies,
    freshActors,
    staleActors,
    legacyActorsAwaitingFreshnessTimestamp: legacyActors,
    freshImages: imageStats.freshImages,
    staleImages: imageStats.staleImages,
    legacyImagesAwaitingFreshnessTimestamp: imageStats.legacyImages,
    oldestSuccessfulFetchAt,
    oldestSuccessfulFetchAgeDays: timestampAgeDays(oldestSuccessfulFetchAt, now),
  }, null, 2));
  if (!skipBuild) {
    console.log('Regenerating the local production bundle...');
    await execFileAsync('npm', ['run', 'build'], { cwd: process.cwd() });
  }
  activeRun = undefined;
  if (failures.length > 0 || peopleResult.failures.length > 0) process.exitCode = 1;
}

main().catch(async (error) => {
  console.error(`[TMDB Refresh] ${error instanceof Error ? error.message : String(error)}`);
  if (activeRun) {
    await completeRefreshRun(activeRun.id, {
      status: 'FAILED',
      counters: activeRun.counters,
      failures: [{ key: `system:${activeRun.id}`, kind: 'system', operation: 'refresh process', message: error instanceof Error ? error.message : String(error), timestamp: new Date().toISOString() }],
      successKeys: [],
    }).catch(() => undefined);
    activeRun = undefined;
  }
  process.exitCode = 1;
});
