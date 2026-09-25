import 'dotenv/config';
import { execFile } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import { MOVIES } from '../src/data/movies';
import { enrichCataloguePeople } from '../src/utils/person-enrichment';
import { requireTmdbApiKey } from '../src/utils/tmdb';
import { writeFileAtomically } from '../src/utils/atomic-file';
import { createImageRefreshBudget, getImageCacheFreshnessStats } from '../src/utils/local-images';
import { completeRefreshRun, createRefreshRun, startRefreshRun } from '../src/server/tmdb-refresh-health';

const execFileAsync = promisify(execFile);
const refreshReportPath = path.join(process.cwd(), 'src/data/refresh-report.json');
let activeRun: Awaited<ReturnType<typeof createRefreshRun>> | undefined;

function personIdOption(): number | undefined {
  const index = process.argv.indexOf('--person');
  if (index < 0) return undefined;
  const value = Number(process.argv[index + 1]);
  return Number.isInteger(value) && value > 0 ? value : undefined;
}

async function main() {
  const run = createRefreshRun('manual');
  activeRun = run;
  await startRefreshRun(run);
  const imageBudget = createImageRefreshBudget();
  const imageStatsBefore = await getImageCacheFreshnessStats();
  const apiKey = requireTmdbApiKey();
  const personId = personIdOption();
  const skipBuild = process.argv.includes('--skip-build');
  const result = await enrichCataloguePeople(MOVIES, apiKey, personId, (current, total, person) => {
    console.log(`[TMDB Person] ${current}/${total} ${person.name} (${person.tmdbPersonId})`);
  }, { imageBudget });

  if (personId && result.actor) {
    console.log(`TMDB person ID: ${result.actor.tmdbPersonId}`);
    console.log(`Name: ${result.actor.name}`);
    console.log(`Birthday: ${result.actor.birthday || 'missing'}`);
    console.log(`Deathday: ${result.actor.deathday || 'missing'}`);
    console.log(`Place of birth: ${result.actor.placeOfBirth || 'missing'}`);
    console.log(`Biography: ${result.actor.biography ? 'present' : 'missing'}`);
    console.log(`IMDb person ID: ${result.actor.imdbPersonId || 'missing'}`);
    console.log(`Gender: ${result.actor.gender || 'missing'}`);
    console.log(`Known for: ${result.actor.knownForDepartment || 'missing'}`);
    console.log(`Known credits: ${result.actor.knownCredits ?? 'missing'}`);
    console.log(`Also known as: ${result.actor.alsoKnownAs?.join(', ') || 'missing'}`);
    console.log(`Social IDs: ${[result.actor.instagramId, result.actor.twitterId, result.actor.facebookId].filter(Boolean).join(', ') || 'missing'}`);
    console.log(`TMDB updated at: ${result.actor.tmdbUpdatedAt || 'pending'}`);
    console.log(`Profile path: ${result.actor.profileUrl || 'missing'}`);
    console.log(`Local XmasDB movies: ${MOVIES.filter((movie) => movie.cast.some((cast) => cast.tmdbPersonId === personId)).length}`);
  }

  console.log(`Catalogue people examined: ${result.total}`);
  console.log(`Incomplete people targeted: ${result.incomplete}`);
  console.log(`Already enriched and skipped: ${result.skipped}`);
  console.log(`Updated people: ${result.updated}`);
  if (result.failures.length > 0) {
    console.error('TMDB person failures:');
    result.failures.forEach((failure) => console.error(`- ${failure.tmdbPersonId} ${failure.name}: ${failure.message}`));
    process.exitCode = 1;
  }
  let report: Record<string, unknown> = {};
  try { report = JSON.parse(await fs.readFile(refreshReportPath, 'utf8')) as Record<string, unknown>; } catch { /* First person-only refresh. */ }
  await writeFileAtomically(refreshReportPath, JSON.stringify({
    ...report,
    refreshedAt: new Date().toISOString(),
    uniqueCatalogueActors: result.total,
    incompleteCatalogueActors: result.incomplete,
    enrichedActorsSkipped: result.skipped,
    actorsSuccessfullyRefreshed: result.updated,
    actorFailures: result.failures,
  }, null, 2));
  if (!skipBuild) {
    console.log('Regenerating the local production bundle...');
    await execFileAsync('npm', ['run', 'build'], { cwd: process.cwd() });
  }
  const imageStats = await getImageCacheFreshnessStats();
  await completeRefreshRun(run.id, {
    status: result.failures.length || imageBudget.failed ? 'PARTIAL' : 'SUCCESS',
    counters: { ...run.counters, actorsAttempted: result.incomplete, actorsSuccessful: result.updated, actorsFailed: result.failures.length, actorsSkippedFresh: result.total - result.incomplete, imagesAttempted: imageBudget.attempted, imagesSuccessful: imageBudget.succeeded, imagesFailed: imageBudget.failed, posterImagesSuccessful: imageBudget.byType.posters.succeeded, backdropImagesSuccessful: imageBudget.byType.backdrops.succeeded, peopleImagesSuccessful: imageBudget.byType.people.succeeded, posterImagesFailed: imageBudget.byType.posters.failed, backdropImagesFailed: imageBudget.byType.backdrops.failed, peopleImagesFailed: imageBudget.byType.people.failed },
    failures: [
      ...result.failures.map((failure) => ({ key: `actor:${failure.tmdbPersonId}`, kind: 'actor' as const, operation: 'fetch person metadata', tmdbId: failure.tmdbPersonId, message: failure.message, timestamp: new Date().toISOString() })),
      ...imageBudget.failureDetails.map((failure) => ({ key: `image:${failure.localPath}`, kind: 'image' as const, operation: 'download/revalidate image', message: failure.message, timestamp: new Date().toISOString() })),
    ],
    successKeys: result.attemptedIds.filter((id) => !result.failures.some((failure) => failure.tmdbPersonId === id)).map((id) => `actor:${id}`),
    freshness: { freshMovies: 0, staleMovies: 0, freshActors: result.actors.filter((actor) => actor.tmdbFetchedAt).length, staleActors: 0, legacyActors: result.actors.filter((actor) => !actor.tmdbFetchedAt).length, freshImages: imageStats.freshImages, staleImages: imageStats.staleImages, legacyImages: imageStats.legacyImages, oldestSuccessfulFetchAt: imageStats.oldestSuccessfulFetchAt },
    legacyActorsBefore: result.actors.length - result.updated,
    legacyActorsProcessed: result.updated,
    legacyImagesBefore: imageStatsBefore.legacyImages,
    legacyImagesProcessed: Math.max(0, imageStatsBefore.legacyImages - imageStats.legacyImages),
  });
  activeRun = undefined;
}

main().catch(async (error) => {
  console.error(`[TMDB Person] ${error instanceof Error ? error.message : String(error)}`);
  if (activeRun) {
    await completeRefreshRun(activeRun.id, { status: 'FAILED', counters: activeRun.counters, failures: [{ key: `system:${activeRun.id}`, kind: 'system', operation: 'refresh process', message: error instanceof Error ? error.message : String(error), timestamp: new Date().toISOString() }], successKeys: [] }).catch(() => undefined);
    activeRun = undefined;
  }
  process.exitCode = 1;
});
