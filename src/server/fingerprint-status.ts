import fs from 'node:fs/promises';
import path from 'node:path';
import { MOVIES } from '../data/movies';
import { getMovieFingerprintIds } from '../data/movie-fingerprints';
import type { FingerprintCheckpoint, FingerprintCheckpointEntry } from './fingerprint-classification';
import { readFingerprintCheckpoint } from './fingerprint-classification';
import { writeFileAtomically } from '../utils/atomic-file';

export const FINGERPRINT_STATUS_PATH = path.join(process.cwd(), 'src', 'data', 'fingerprint-classification-status.json');
export const FINGERPRINT_APPLY_STATS_PATH = path.join(process.cwd(), 'data', 'fingerprint-classification-apply.json');
export const FINGERPRINT_STATUS_RECENT_LIMIT = 20;

export type FingerprintStatusRunStatus = 'SUCCESS' | 'PARTIAL' | 'FAILED';

export interface FingerprintRecentMovie {
  movieId: string;
  title: string;
  status: FingerprintCheckpointEntry['status'];
  fingerprints: string[];
  processedAt: string;
}

export interface FingerprintStatusReport {
  generatedAt: string;
  catalogue: {
    totalMovies: number;
    moviesWithIngredients: number;
    moviesWithoutIngredients: number;
  };
  lastRun: {
    startedAt: string;
    finishedAt: string;
    status: FingerprintStatusRunStatus;
    processed: number;
    classified: number;
    noMatch: number;
    insufficientData: number;
    failed: number;
    newAssignmentsApplied: number;
    skippedExistingAssignments: number;
    recentMovies: FingerprintRecentMovie[];
  } | null;
}

interface ApplyStats {
  applied?: unknown;
  skippedExisting?: unknown;
}

function validCount(value: unknown): number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 ? value : 0;
}

export function getFingerprintCatalogueStats(): FingerprintStatusReport['catalogue'] {
  const moviesWithIngredients = MOVIES.filter((movie) => getMovieFingerprintIds(movie).length > 0).length;
  return {
    totalMovies: MOVIES.length,
    moviesWithIngredients,
    moviesWithoutIngredients: MOVIES.length - moviesWithIngredients,
  };
}

function entriesForRun(checkpoint: FingerprintCheckpoint, startedAt: string): FingerprintCheckpointEntry[] {
  const started = Date.parse(startedAt);
  return Object.values(checkpoint.entries)
    .filter((entry) => Number.isFinite(started) && Date.parse(entry.updatedAt) >= started)
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
}

export function buildFingerprintStatusReport(input: {
  checkpoint: FingerprintCheckpoint;
  startedAt: string;
  finishedAt: string;
  requestedStatus: 'SUCCESS' | 'FAILED';
  applyStats?: ApplyStats;
}): FingerprintStatusReport {
  const entries = entriesForRun(input.checkpoint, input.startedAt);
  const failed = entries.filter((entry) => entry.status === 'failed').length;
  const status: FingerprintStatusRunStatus = input.requestedStatus === 'FAILED'
    ? 'FAILED'
    : failed > 0 ? 'PARTIAL' : 'SUCCESS';
  return {
    generatedAt: input.finishedAt,
    catalogue: getFingerprintCatalogueStats(),
    lastRun: {
      startedAt: input.startedAt,
      finishedAt: input.finishedAt,
      status,
      processed: entries.length,
      classified: entries.filter((entry) => entry.status === 'classified').length,
      noMatch: entries.filter((entry) => entry.status === 'no-match').length,
      insufficientData: entries.filter((entry) => entry.status === 'insufficient-data').length,
      failed,
      newAssignmentsApplied: validCount(input.applyStats?.applied),
      skippedExistingAssignments: validCount(input.applyStats?.skippedExisting),
      recentMovies: entries.slice(0, FINGERPRINT_STATUS_RECENT_LIMIT).map((entry) => ({
        movieId: entry.movieId,
        title: entry.title,
        status: entry.status,
        fingerprints: [...entry.fingerprints],
        processedAt: entry.updatedAt,
      })),
    },
  };
}

export async function readFingerprintStatus(filePath = FINGERPRINT_STATUS_PATH): Promise<FingerprintStatusReport | null> {
  try {
    const parsed = JSON.parse(await fs.readFile(filePath, 'utf8')) as FingerprintStatusReport;
    if (!parsed || typeof parsed !== 'object' || !('catalogue' in parsed)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function writeFingerprintStatus(report: FingerprintStatusReport, filePath = FINGERPRINT_STATUS_PATH): Promise<void> {
  await writeFileAtomically(filePath, `${JSON.stringify(report, null, 2)}\n`);
}

export async function readFingerprintApplyStats(filePath = FINGERPRINT_APPLY_STATS_PATH): Promise<ApplyStats> {
  try {
    return JSON.parse(await fs.readFile(filePath, 'utf8')) as ApplyStats;
  } catch {
    return {};
  }
}

export { readFingerprintCheckpoint };
