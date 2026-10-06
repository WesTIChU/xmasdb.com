import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import type { Movie } from '../types';
import {
  buildJevKeywordClassifierInput,
  validateJevKeywordResult,
  type JevKeywordClassifier,
} from './jev-keywords';
import { normalizeJevKeyword } from '../utils/keyword-identity';
import { writeFileAtomically } from '../utils/atomic-file';

export const JEV_KEYWORD_CLASSIFIER_VERSION = 'jev-keywords-v2';
export const JEV_KEYWORD_CHECKPOINT_PATH = path.join(
  process.env.XMASDB_DATA_DIR?.trim() || path.join(process.cwd(), 'data'),
  'jev-keyword-classification-checkpoint.json',
);

interface JevCheckpointEntry {
  movieId: string;
  tmdbId: number;
  classifierVersion: string;
  fingerprint: string;
  status: 'success' | 'failed';
  updatedAt: string;
  error?: string;
}

interface JevCheckpoint {
  version: 1;
  updatedAt: string;
  entries: Record<string, JevCheckpointEntry>;
}

export interface JevKeywordRefreshFailure {
  movieId: string;
  tmdbId: number;
  message: string;
}

export interface JevKeywordRefreshOptions {
  classifier: JevKeywordClassifier;
  checkpointPath?: string;
  onFailure?: (failure: JevKeywordRefreshFailure) => void;
}

export interface JevKeywordRefreshResult {
  movie: Movie;
  skipped: boolean;
  failure?: JevKeywordRefreshFailure;
}

function canonicalKeywordState(keywords: Movie['keywords']): string {
  return JSON.stringify((keywords || []).map((keyword) => 'id' in keyword
    ? { id: keyword.id, name: keyword.name }
    : { name: normalizeJevKeyword(keyword.name) })
    .sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))));
}

export function fingerprintJevKeywordInput(movie: Movie): string {
  const canonical = JSON.stringify({
    classifierVersion: JEV_KEYWORD_CLASSIFIER_VERSION,
    synopsis: movie.synopsis.trim(),
    keywords: JSON.parse(canonicalKeywordState(movie.keywords)),
  });
  return createHash('sha256').update(canonical).digest('hex');
}

async function readCheckpoint(filePath: string): Promise<JevCheckpoint> {
  try {
    const parsed = JSON.parse(await fs.readFile(filePath, 'utf8')) as Partial<JevCheckpoint>;
    if (parsed.version === 1 && parsed.entries && typeof parsed.entries === 'object') {
      return { version: 1, updatedAt: parsed.updatedAt || '', entries: parsed.entries as Record<string, JevCheckpointEntry> };
    }
  } catch {
    // A missing or malformed checkpoint is equivalent to no successful run.
  }
  return { version: 1, updatedAt: '', entries: {} };
}

async function writeCheckpoint(filePath: string, checkpoint: JevCheckpoint): Promise<void> {
  await writeFileAtomically(filePath, JSON.stringify(checkpoint, null, 2) + '\n');
}

export function mergeJevKeywordProposals(movie: Movie, proposals: Array<{ keyword: string; evidence: string }>): Movie {
  const keywords = [...(movie.keywords || [])];
  const identities = new Set(keywords.map((keyword) => normalizeJevKeyword(keyword.name)));
  for (const proposal of proposals) {
    const name = proposal.keyword.trim();
    const identity = normalizeJevKeyword(name);
    if (!name || !identity || identities.has(identity)) continue;
    keywords.push({ name, evidence: proposal.evidence.trim() });
    identities.add(identity);
  }
  return keywords.length === (movie.keywords || []).length ? movie : { ...movie, keywords };
}

export async function runJevKeywordRefresh(movie: Movie, options: JevKeywordRefreshOptions): Promise<JevKeywordRefreshResult> {
  const checkpointPath = options.checkpointPath || JEV_KEYWORD_CHECKPOINT_PATH;
  const fingerprint = fingerprintJevKeywordInput(movie);
  const checkpoint = await readCheckpoint(checkpointPath);
  const prior = checkpoint.entries[movie.id];
  if (prior?.status === 'success' && prior.classifierVersion === JEV_KEYWORD_CLASSIFIER_VERSION && prior.fingerprint === fingerprint) {
    return { movie, skipped: true };
  }

  try {
    const input = buildJevKeywordClassifierInput(movie);
    const raw = await options.classifier.classifyMovie(input);
    const validated = validateJevKeywordResult(raw, input);
    if (!validated.ok) throw new Error(validated.error);
    const resultMovie = mergeJevKeywordProposals(movie, validated.result.newKeywords);
    const resultFingerprint = fingerprintJevKeywordInput(resultMovie);
    checkpoint.entries[movie.id] = {
      movieId: movie.id,
      tmdbId: movie.tmdbId,
      classifierVersion: JEV_KEYWORD_CLASSIFIER_VERSION,
      fingerprint: resultFingerprint,
      status: 'success',
      updatedAt: new Date().toISOString(),
    };
    checkpoint.updatedAt = new Date().toISOString();
    await writeCheckpoint(checkpointPath, checkpoint);
    return { movie: resultMovie, skipped: false };
  } catch (error) {
    const failure: JevKeywordRefreshFailure = {
      movieId: movie.id,
      tmdbId: movie.tmdbId,
      message: error instanceof Error ? error.message : String(error),
    };
    checkpoint.entries[movie.id] = {
      movieId: movie.id,
      tmdbId: movie.tmdbId,
      classifierVersion: JEV_KEYWORD_CLASSIFIER_VERSION,
      fingerprint,
      status: 'failed',
      updatedAt: new Date().toISOString(),
      error: failure.message,
    };
    checkpoint.updatedAt = new Date().toISOString();
    await writeCheckpoint(checkpointPath, checkpoint).catch(() => undefined);
    return { movie, skipped: false, failure };
  }
}
