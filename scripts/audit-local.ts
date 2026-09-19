import fs from 'node:fs/promises';
import path from 'node:path';
import { MOVIES } from '../src/data/movies';
import { ACTORS, getActorByTmdbId } from '../src/data/actors';
import { getRadarrActorFeedJson } from '../src/utils/feeds';
import { isMoviePremierePast } from '../src/utils/catalogue-lifecycle';
import { isValidActorDate } from '../src/utils/actor-dates';

const publicPath = path.join(process.cwd(), 'public');
const refreshReportPath = path.join(process.cwd(), 'src/data/refresh-report.json');

async function countFiles(directory: string): Promise<number> {
  try {
    const names = await fs.readdir(path.join(publicPath, directory));
    return new Set(names.map((name) => name.replace(/\.[^.]+$/, ''))).size;
  } catch {
    return 0;
  }
}

async function main() {
  let refreshReport: { moviesSuccessfullyRefreshed?: number; movieFailures?: unknown[]; actorsSuccessfullyRefreshed?: number; actorFailures?: unknown[] } = {};
  try {
    refreshReport = JSON.parse(await fs.readFile(refreshReportPath, 'utf8'));
  } catch {
    // No refresh report exists until the first metadata refresh completes.
  }
  const localPeople = new Set(MOVIES.flatMap((movie) => movie.cast.map((cast) => cast.tmdbPersonId)).filter(Boolean));
  const refreshedMovies = MOVIES.filter((movie) => movie.tmdbUpdatedAt);
  const refreshedActors = ACTORS.filter((actor) => localPeople.has(actor.tmdbPersonId) && actor.tmdbUpdatedAt);
  const peopleWithBirthday = ACTORS.filter((actor) => isValidActorDate(actor.birthday)).length;
  const peopleWithDeathday = ACTORS.filter((actor) => isValidActorDate(actor.deathday)).length;
  const staleComingSoon = MOVIES.filter((movie) => movie.status === 'coming-soon' && isMoviePremierePast(movie)).length;
  const paul = getActorByTmdbId(62909);
  const paulMovies = paul
    ? MOVIES.filter((movie) => movie.cast.some((cast) => cast.tmdbPersonId === paul.tmdbPersonId))
    : [];
  const paulFeed = paul ? JSON.parse(getRadarrActorFeedJson(paul.tmdbPersonId) || '[]') : [];
  const paulFeedValid = Array.isArray(paulFeed) && paulFeed.every((item) => (
    typeof item?.title === 'string' && typeof item?.imdb_id === 'string' && /^tt\d+$/.test(item.imdb_id)
  ));
  const paulLocalFields = Boolean(
    paul?.biography && paul.placeOfBirth && paul.birthday && paul.imdbPersonId &&
    paul.profileUrl?.startsWith('/images/people/')
  );

  console.log(`Catalogue movies: ${MOVIES.length}`);
  console.log(`Movies with TMDB IDs: ${MOVIES.filter((movie) => movie.tmdbId > 0).length}`);
  console.log(`Movies successfully refreshed: ${refreshReport.moviesSuccessfullyRefreshed ?? refreshedMovies.length}`);
  console.log(`Movies that failed: ${refreshReport.movieFailures?.length ?? 'unknown (no refresh report)'}`);
  console.log(`Unique XmasDB actors: ${localPeople.size}`);
  console.log(`Actors in people.json: ${ACTORS.length}`);
  console.log(`Actors refreshed: ${refreshReport.actorsSuccessfullyRefreshed ?? refreshedActors.length}`);
  console.log(`Actors that failed: ${refreshReport.actorFailures?.length ?? 'unknown (no refresh report)'}`);
  console.log(`People with a birthday: ${peopleWithBirthday}`);
  console.log(`People with a deathday: ${peopleWithDeathday}`);
  console.log(`People with neither: ${ACTORS.filter((actor) => !isValidActorDate(actor.birthday) && !isValidActorDate(actor.deathday)).length}`);
  console.log(`Posters cached: ${await countFiles('images/posters')}`);
  console.log(`Backdrops cached: ${await countFiles('images/backdrops')}`);
  console.log(`Person images cached: ${await countFiles('images/people')}`);
  console.log(`Stale Coming Soon movies promoted: ${staleComingSoon}`);
  console.log('');
  console.log(`Paul Campbell local actor record: ${paul ? 'present' : 'missing'}`);
  console.log(`Paul Campbell local metadata complete: ${paulLocalFields ? 'yes' : 'no'}`);
  console.log(`Paul Campbell local Holiday Filmography: ${paulMovies.length} movie(s)`);
  console.log(`Paul Campbell local JSON feed: ${paulFeedValid ? 'valid Radarr array' : 'invalid'}`);
  console.log(`TMDB unavailable render check: ${paul && paulLocalFields && paulMovies.length > 0 && paulFeedValid ? 'passes' : 'incomplete'}`);
}

main().catch((error) => {
  console.error(`[Local Audit] ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
