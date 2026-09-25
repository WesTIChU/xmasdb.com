import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { writeFileAtomically } from '../utils/atomic-file';
import { isTmdbFresh } from '../utils/tmdb-freshness';
import { getContactDataDir } from './contact';
import { MOVIES } from '../data/movies';
import { ACTORS } from '../data/actors';
import { getImageCacheFreshnessStats } from '../utils/local-images';

export type RefreshRunType = 'full' | 'coming-soon' | 'manual' | 'import';
export type RefreshRunStatus = 'RUNNING' | 'SUCCESS' | 'PARTIAL' | 'FAILED';

export interface RefreshFailure {
  key: string;
  kind: 'movie' | 'actor' | 'image' | 'system';
  operation: string;
  tmdbId?: number;
  message: string;
  httpStatus?: number;
  timestamp: string;
  recoveredAt?: string;
}

export interface RefreshRunCounters {
  moviesAttempted: number;
  moviesSuccessful: number;
  moviesChanged: number;
  moviesUnchanged: number;
  moviesFailed: number;
  actorsAttempted: number;
  actorsSuccessful: number;
  actorsFailed: number;
  actorsSkippedFresh: number;
  imagesAttempted: number;
  imagesSuccessful: number;
  imagesFailed: number;
  posterImagesSuccessful: number;
  backdropImagesSuccessful: number;
  peopleImagesSuccessful: number;
  posterImagesFailed: number;
  backdropImagesFailed: number;
  peopleImagesFailed: number;
}

export interface RefreshRunFreshness {
  freshMovies: number;
  staleMovies: number;
  freshActors: number;
  staleActors: number;
  legacyActors: number;
  freshImages: number;
  staleImages: number;
  legacyImages: number;
  oldestSuccessfulFetchAt?: string;
}

export interface RefreshRun {
  id: string;
  type: RefreshRunType;
  startedAt: string;
  finishedAt?: string;
  durationMs?: number;
  status: RefreshRunStatus;
  counters: RefreshRunCounters;
  freshness?: RefreshRunFreshness;
  legacyActorsBefore?: number;
  legacyActorsProcessed?: number;
  legacyImagesBefore?: number;
  legacyImagesProcessed?: number;
  failures: RefreshFailure[];
  successKeys: string[];
}

export interface RefreshHistory {
  runs: RefreshRun[];
}

export const TMDB_REFRESH_HISTORY_FILENAME = 'tmdb-refresh-history.json';

export function getTmdbRefreshHistoryPath(dataDir = getContactDataDir()): string {
  return path.join(dataDir, TMDB_REFRESH_HISTORY_FILENAME);
}

const emptyCounters = (): RefreshRunCounters => ({
  moviesAttempted: 0,
  moviesSuccessful: 0,
  moviesChanged: 0,
  moviesUnchanged: 0,
  moviesFailed: 0,
  actorsAttempted: 0,
  actorsSuccessful: 0,
  actorsFailed: 0,
  actorsSkippedFresh: 0,
  imagesAttempted: 0,
  imagesSuccessful: 0,
  imagesFailed: 0,
  posterImagesSuccessful: 0,
  backdropImagesSuccessful: 0,
  peopleImagesSuccessful: 0,
  posterImagesFailed: 0,
  backdropImagesFailed: 0,
  peopleImagesFailed: 0,
});

export function createRefreshRun(type: RefreshRunType, startedAt = new Date()): RefreshRun {
  return {
    id: randomUUID(),
    type,
    startedAt: startedAt.toISOString(),
    status: 'RUNNING',
    counters: emptyCounters(),
    failures: [],
    successKeys: [],
  };
}

async function readHistoryFile(dataDir = getContactDataDir()): Promise<RefreshHistory> {
  try {
    const parsed = JSON.parse(await fs.readFile(getTmdbRefreshHistoryPath(dataDir), 'utf8')) as Partial<RefreshHistory>;
    return { runs: Array.isArray(parsed.runs) ? parsed.runs : [] };
  } catch {
    return { runs: [] };
  }
}

async function writeHistory(history: RefreshHistory, dataDir = getContactDataDir()): Promise<void> {
  await fs.mkdir(dataDir, { recursive: true });
  await writeFileAtomically(getTmdbRefreshHistoryPath(dataDir), `${JSON.stringify({ runs: history.runs.slice(-100) }, null, 2)}\n`);
}

export async function startRefreshRun(run: RefreshRun, dataDir = getContactDataDir()): Promise<void> {
  const history = await readHistoryFile(dataDir);
  history.runs.push(run);
  await writeHistory(history, dataDir);
}

export async function completeRefreshRun(
  runId: string,
  patch: Pick<RefreshRun, 'status' | 'counters' | 'failures' | 'successKeys'> & Partial<Pick<RefreshRun, 'freshness' | 'legacyActorsBefore' | 'legacyActorsProcessed' | 'legacyImagesBefore' | 'legacyImagesProcessed'>>,
  finishedAt = new Date(),
  dataDir = getContactDataDir(),
): Promise<RefreshRun | undefined> {
  const history = await readHistoryFile(dataDir);
  const run = history.runs.find((candidate) => candidate.id === runId);
  if (!run) return undefined;
  run.finishedAt = finishedAt.toISOString();
  run.durationMs = Math.max(0, Date.parse(run.finishedAt) - Date.parse(run.startedAt));
  Object.assign(run, {
    ...patch,
    failures: patch.failures.map((failure) => ({
      ...failure,
      message: failure.message.replace(/api_key=[^&\s]+/gi, 'api_key=[redacted]').replace(/authorization:\s*[^,\s]+/gi, 'authorization: [redacted]'),
    })),
  });
  const recoveredKeys = new Set(patch.successKeys);
  if (recoveredKeys.size > 0) {
    for (const previous of history.runs) {
      if (previous.id === run.id) continue;
      for (const failure of previous.failures) {
        if (!failure.recoveredAt && recoveredKeys.has(failure.key)) failure.recoveredAt = run.finishedAt;
      }
    }
  }
  await writeHistory(history, dataDir);
  return run;
}

export async function readRefreshHistory(dataDir = getContactDataDir()): Promise<RefreshHistory> {
  return readHistoryFile(dataDir);
}

export function unresolvedFailures(history: RefreshHistory): RefreshFailure[] {
  const failures = new Map<string, RefreshFailure>();
  for (const run of history.runs) {
    for (const failure of run.failures) {
      if (!failure.recoveredAt) failures.set(failure.key, failure);
      else failures.delete(failure.key);
    }
    for (const key of run.successKeys) failures.delete(key);
  }
  return [...failures.values()];
}

export function calculateRefreshHealthStatus(input: { unresolvedFailures: number; overdueRecords: number; fullScheduleMissed: boolean; comingSoonScheduleMissed: boolean }): { status: 'HEALTHY' | 'ATTENTION NEEDED'; reasons: string[] } {
  const reasons = [
    input.unresolvedFailures > 0 ? `${input.unresolvedFailures} unresolved fetch failure(s)` : '',
    input.overdueRecords > 0 ? `${input.overdueRecords} genuinely overdue record(s)` : '',
    input.fullScheduleMissed ? 'Full refresh schedule is overdue' : '',
    input.comingSoonScheduleMissed ? 'Coming Soon refresh schedule is overdue' : '',
  ].filter(Boolean);
  return { status: reasons.length === 0 ? 'HEALTHY' : 'ATTENTION NEEDED', reasons };
}

export function nextFullRefreshAt(now = new Date()): Date {
  const candidate = new Date(now);
  candidate.setUTCMinutes(17, 0, 0);
  if (now.getUTCDate() !== 1 && now.getUTCDate() !== 15) {
    candidate.setUTCDate(now.getUTCDate() < 15 ? 15 : 1);
    if (now.getUTCDate() > 15) candidate.setUTCMonth(candidate.getUTCMonth() + 1);
  } else if (now.getTime() >= candidate.getTime()) {
    if (now.getUTCDate() === 1) candidate.setUTCDate(15);
    else { candidate.setUTCDate(1); candidate.setUTCMonth(candidate.getUTCMonth() + 1); }
  }
  return candidate;
}

export function nextComingSoonRefreshAt(now = new Date()): Date {
  const candidate = new Date(now);
  const nextHour = Math.floor(now.getUTCHours() / 6) * 6;
  candidate.setUTCHours(nextHour, 23, 0, 0);
  if (candidate.getTime() <= now.getTime()) candidate.setUTCHours(candidate.getUTCHours() + 6);
  return candidate;
}

export function isTimestampFresh(timestamp: string | undefined, now = new Date()): boolean {
  return isTmdbFresh(timestamp, now);
}

function previousFullScheduleAt(now: Date): Date {
  const candidate = new Date(now);
  candidate.setUTCHours(3, 17, 0, 0);
  for (let index = 0; index < 40; index += 1) {
    if ((candidate.getUTCDate() === 1 || candidate.getUTCDate() === 15) && candidate.getTime() <= now.getTime()) return candidate;
    candidate.setUTCDate(candidate.getUTCDate() - 1);
  }
  return candidate;
}

function previousComingSoonScheduleAt(now: Date): Date {
  const candidate = new Date(now);
  candidate.setUTCMinutes(23, 0, 0);
  candidate.setUTCHours(Math.floor(now.getUTCHours() / 6) * 6);
  if (candidate.getTime() > now.getTime()) candidate.setUTCHours(candidate.getUTCHours() - 6);
  return candidate;
}

export interface TmdbRefreshHealthPayload {
  current: { status: 'HEALTHY' | 'ATTENTION NEEDED'; reasons: string[]; unresolvedFailures: number; overdueRecords: number };
  schedule: { nextFull: string; nextComingSoon: string };
  lastFull?: RefreshRun;
  lastComingSoon?: RefreshRun;
  latestRun?: RefreshRun;
  movies: { total: number; checked: number; changed: number; unchanged: number; failed: number; fresh: number; stale: number; neverFetched: number; oldestSuccessfulFetch?: string };
  actors: { total: number; fresh: number; stale: number; legacy: number; attempted: number; successful: number; failed: number; skippedFresh: number; oldestSuccessfulFetch?: string; legacyInitially?: number; processedThisRun?: number; remaining: number };
  images: Record<'posters' | 'backdrops' | 'people', { total: number; fresh: number; stale: number; legacy: number; refreshedThisRun: number; failedThisRun: number; oldestSuccessfulFetch?: string }>;
  history: RefreshRun[];
  unresolvedFailureDetails: RefreshFailure[];
}

export async function getTmdbRefreshHealth(now = new Date(), dataDir = getContactDataDir()): Promise<TmdbRefreshHealthPayload> {
  const history = await readHistoryFile(dataDir);
  const runs = history.runs;
  const latestRun = [...runs].reverse().find((run) => run.finishedAt) || runs[runs.length - 1];
  const lastFull = [...runs].reverse().find((run) => run.type === 'full' && run.finishedAt);
  const lastComingSoon = [...runs].reverse().find((run) => run.type === 'coming-soon' && run.finishedAt);
  const freshMovies = MOVIES.filter((movie) => isTmdbFresh(movie.tmdbFetchedAt, now)).length;
  const neverFetchedMovies = MOVIES.filter((movie) => !movie.tmdbFetchedAt).length;
  const staleMovies = MOVIES.length - freshMovies;
  const freshActors = ACTORS.filter((actor) => isTmdbFresh(actor.tmdbFetchedAt, now)).length;
  const legacyActors = ACTORS.filter((actor) => !actor.tmdbFetchedAt).length;
  const staleActors = ACTORS.length - freshActors - legacyActors;
  const imageStats = await getImageCacheFreshnessStats(undefined, now);
  const oldestOf = (values: Array<string | undefined>): string | undefined => values.filter((value): value is string => typeof value === 'string' && Number.isFinite(Date.parse(value))).sort((left, right) => Date.parse(left) - Date.parse(right))[0];
  const unresolved = unresolvedFailures(history);
  const overdueRecords = (staleMovies - neverFetchedMovies) + staleActors + imageStats.staleImages;
  const fullScheduleMissed = !lastFull?.finishedAt || Date.parse(lastFull.finishedAt) < previousFullScheduleAt(now).getTime();
  const comingSoonScheduleMissed = !lastComingSoon?.finishedAt || Date.parse(lastComingSoon.finishedAt) < previousComingSoonScheduleAt(now).getTime();
  const healthStatus = calculateRefreshHealthStatus({ unresolvedFailures: unresolved.length, overdueRecords, fullScheduleMissed, comingSoonScheduleMissed });
  const oldest = oldestOf([...MOVIES.map((movie) => movie.tmdbFetchedAt), ...ACTORS.map((actor) => actor.tmdbFetchedAt), imageStats.oldestSuccessfulFetchAt]);
  const latestCounters = latestRun?.counters;
  const imagePayload = (kind: 'posters' | 'backdrops' | 'people') => ({
    ...imageStats.byType[kind],
    refreshedThisRun: latestCounters?.[kind === 'posters' ? 'posterImagesSuccessful' : kind === 'backdrops' ? 'backdropImagesSuccessful' : 'peopleImagesSuccessful'] || 0,
    failedThisRun: latestCounters?.[kind === 'posters' ? 'posterImagesFailed' : kind === 'backdrops' ? 'backdropImagesFailed' : 'peopleImagesFailed'] || 0,
    oldestSuccessfulFetch: imageStats.byType[kind].oldestSuccessfulFetchAt,
  });
  return {
    current: { status: healthStatus.status, reasons: healthStatus.reasons, unresolvedFailures: unresolved.length, overdueRecords },
    schedule: { nextFull: nextFullRefreshAt(now).toISOString(), nextComingSoon: nextComingSoonRefreshAt(now).toISOString() },
    lastFull,
    lastComingSoon,
    latestRun,
    movies: { total: MOVIES.length, checked: latestCounters?.moviesSuccessful || 0, changed: latestCounters?.moviesChanged || 0, unchanged: latestCounters?.moviesUnchanged || 0, failed: latestCounters?.moviesFailed || 0, fresh: freshMovies, stale: staleMovies, neverFetched: neverFetchedMovies, oldestSuccessfulFetch: oldestOf(MOVIES.map((movie) => movie.tmdbFetchedAt)) },
    actors: { total: ACTORS.length, fresh: freshActors, stale: staleActors, legacy: legacyActors, attempted: latestCounters?.actorsAttempted || 0, successful: latestCounters?.actorsSuccessful || 0, failed: latestCounters?.actorsFailed || 0, skippedFresh: latestCounters?.actorsSkippedFresh || 0, oldestSuccessfulFetch: oldestOf(ACTORS.map((actor) => actor.tmdbFetchedAt)), legacyInitially: latestRun?.legacyActorsBefore, processedThisRun: latestRun?.legacyActorsProcessed, remaining: legacyActors },
    images: { posters: imagePayload('posters'), backdrops: imagePayload('backdrops'), people: imagePayload('people') },
    history: runs.slice(-10).reverse(),
    unresolvedFailureDetails: unresolved,
  };
}
