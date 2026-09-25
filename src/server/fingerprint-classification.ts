import fs from 'node:fs/promises';
import path from 'node:path';
import type { Movie } from '../types';
import type { FingerprintId } from '../data/fingerprints';
import { FINGERPRINTS, isFingerprintId } from '../data/fingerprints';
import { PROTOTYPE_MOVIE_FINGERPRINTS } from '../data/movie-fingerprints';
import { getBrandById } from '../data/brands';
import { writeFileAtomically } from '../utils/atomic-file';

export const FINGERPRINT_CHECKPOINT_PATH = path.join(process.env.XMASDB_DATA_DIR?.trim() || path.join(process.cwd(), 'data'), 'fingerprint-classification-checkpoint.json');
export const FINGERPRINT_OVERLAY_PATH = path.join(process.cwd(), 'src', 'data', 'movie-fingerprints.ts');

export interface FingerprintClassifierInput {
  movieId: string;
  tmdbId: number;
  title: string;
  year: number;
  releaseDate: string;
  network: string;
  synopsis: string;
  genres: string[];
}

export interface ValidatedClassifierResult {
  movieId: string;
  fingerprints: FingerprintId[];
}

export type ClassificationStatus = 'classified' | 'no-match' | 'insufficient-data' | 'failed';

export interface FingerprintCheckpointEntry {
  movieId: string;
  tmdbId: number;
  title: string;
  input: FingerprintClassifierInput;
  status: ClassificationStatus;
  fingerprints: FingerprintId[];
  error?: string;
  updatedAt: string;
}

export interface FingerprintCheckpoint {
  version: 1;
  updatedAt: string;
  entries: Record<string, FingerprintCheckpointEntry>;
}

export interface FingerprintClassifier {
  classifyMovie(input: FingerprintClassifierInput): Promise<unknown>;
}

export interface ClassificationObservation {
  input: FingerprintClassifierInput;
  raw: unknown;
  validation: ReturnType<typeof validateClassifierResult>;
}

export function buildFingerprintClassifierInput(movie: Movie): FingerprintClassifierInput {
  return {
    movieId: movie.id,
    tmdbId: movie.tmdbId,
    title: movie.title,
    year: movie.year,
    releaseDate: movie.releaseDate,
    network: getBrandById(movie.brandId)?.shortName || movie.brandId,
    synopsis: movie.synopsis.trim().slice(0, 1600),
    genres: (movie.genres || []).map((genre) => genre.name.trim()).filter(Boolean),
  };
}

export function getFingerprintInputQuality(input: FingerprintClassifierInput): { usable: true } | { usable: false; reason: string } {
  const synopsis = input.synopsis.trim();
  if (!synopsis) return { usable: false, reason: 'Synopsis is empty.' };
  if (synopsis.length < 120) return { usable: false, reason: `Synopsis is too short to classify reliably (${synopsis.length} characters).` };
  if (/^a sequel to\b/i.test(synopsis) || /^(?:a|an) (?:festive romance film|romantic holiday film)\.?$/i.test(synopsis)) {
    return { usable: false, reason: 'Synopsis is generic or sequel-only and contains insufficient plot information.' };
  }
  return { usable: true };
}

export function getFingerprintClassifierPrompt(): string {
  const catalogue = FINGERPRINTS.map((fingerprint) => JSON.stringify({
    id: fingerprint.id,
    name: fingerprint.label,
    category: fingerprint.category,
    rule: `Assign only when the movie information clearly supports ${fingerprint.label}; do not infer it from the title alone.`,
  })).join('\n');
  return [
    'You classify Christmas movie fingerprints for XmasDB.',
    'A fingerprint is a memorable characteristic someone might use to identify or discover a movie.',
    'Use only the supplied movie information and only the following canonical fingerprint catalogue. The id is the only value you may return:',
    catalogue,
    'Assign an ID only when the supplied information clearly supports it. Do not classify from the title alone, infer common Christmas tropes, pad results, or invent labels.',
    'Royal in a title does not automatically mean royalty; going home does not automatically mean small-town; a castle does not automatically mean royalty; a cooking influencer is not automatically a chef; Second Chance requires the actual story to support that concept.',
    'Zero fingerprints is valid when the information is insufficient. Prefer omission over guessing.',
    'Return JSON only in the form {"movieId":"...","fingerprintIds":["canonical-id"]}.',
  ].join('\n');
}

export function validateClassifierResult(raw: unknown, expectedMovieId: string): { ok: true; result: ValidatedClassifierResult } | { ok: false; error: string } {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { ok: false, error: 'Classifier response must be an object.' };
  const value = raw as Record<string, unknown>;
  if (typeof value.movieId !== 'string' || value.movieId !== expectedMovieId) return { ok: false, error: 'Classifier response has the wrong movie ID.' };
  const hasFingerprintIds = Object.prototype.hasOwnProperty.call(value, 'fingerprintIds');
  const hasLegacyFingerprints = Object.prototype.hasOwnProperty.call(value, 'fingerprints');
  if (hasFingerprintIds && hasLegacyFingerprints) return { ok: false, error: 'Classifier response must not contain both fingerprintIds and fingerprints.' };
  const rawFingerprints = hasFingerprintIds ? value.fingerprintIds : value.fingerprints;
  if (!Array.isArray(rawFingerprints)) return { ok: false, error: 'Classifier fingerprintIds must be an array.' };
  const fingerprints: FingerprintId[] = [];
  const seen = new Set<string>();
  for (const fingerprint of rawFingerprints) {
    if (typeof fingerprint !== 'string' || !fingerprint.trim()) return { ok: false, error: 'Classifier fingerprints must contain non-empty strings.' };
    if (!isFingerprintId(fingerprint)) return { ok: false, error: `Unknown fingerprint ID: ${fingerprint}` };
    if (seen.has(fingerprint)) return { ok: false, error: `Duplicate fingerprint ID: ${fingerprint}` };
    seen.add(fingerprint);
    fingerprints.push(fingerprint);
  }
  return { ok: true, result: { movieId: expectedMovieId, fingerprints } };
}

export class MockFingerprintClassifier implements FingerprintClassifier {
  async classifyMovie(input: FingerprintClassifierInput): Promise<unknown> {
    return { movieId: input.movieId, fingerprints: [] };
  }
}

export interface OpenRouterFingerprintClassifierOptions {
  apiKey?: string;
  model?: string;
  baseUrl?: string;
}

/** OpenRouter JSON classifier. It performs one request and no catalogue/network lookup. */
export class OpenRouterFingerprintClassifier implements FingerprintClassifier {
  private readonly apiKey: string;
  private readonly model: string;
  private readonly baseUrl: string;
  lastUsage: unknown;

  constructor(options: OpenRouterFingerprintClassifierOptions = {}) {
    this.apiKey = options.apiKey || process.env.OPENROUTER_API_KEY || '';
    this.model = options.model || process.env.OPENROUTER_MODEL || '';
    this.baseUrl = (options.baseUrl || process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api').replace(/\/$/, '');
    if (!this.apiKey) throw new Error('Missing OPENROUTER_API_KEY. No OpenRouter request was made.');
    if (!this.model) throw new Error('Missing OPENROUTER_MODEL. No OpenRouter request was made.');
  }

  get configuredModel(): string { return this.model; }

  async classifyMovie(input: FingerprintClassifierInput): Promise<unknown> {
    const questions = Object.fromEntries(FINGERPRINTS.map((fingerprint) => [`fingerprint_${fingerprint.id.replace(/-/g, '_')}`, {
      type: 'noul',
      instructions: `Does this movie clearly have the fingerprint “${fingerprint.label}” (${fingerprint.category}) based on the supplied synopsis and metadata? Apply it only when the story meaning clearly supports it; do not infer it from the title alone or from generic Christmas conventions.`,
      criteria: {
        true: `The movie information clearly supports ${fingerprint.label}.`,
        false: `The movie information does not clearly support ${fingerprint.label}, or the evidence is insufficient.`,
      },
    }]));
    const response = await fetch(`${this.baseUrl}/alpha/decisions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
        ...(process.env.OPENROUTER_SITE_URL ? { 'HTTP-Referer': process.env.OPENROUTER_SITE_URL } : {}),
        ...(process.env.OPENROUTER_APP_NAME ? { 'X-Title': process.env.OPENROUTER_APP_NAME } : {}),
      },
      body: JSON.stringify({ model: this.model, state: { movie: input, instructions: getFingerprintClassifierPrompt() }, questions }),
    });
    const body = await response.text();
    if (!response.ok) throw new Error(`AI classifier HTTP ${response.status}: ${body.slice(0, 500)}`);
    let envelope: unknown;
    try { envelope = JSON.parse(body); } catch { throw new Error('AI classifier returned invalid API JSON.'); }
    if (!envelope || typeof envelope !== 'object' || Array.isArray(envelope)) throw new Error('AI classifier returned an invalid API envelope.');
    this.lastUsage = (envelope as { usage?: unknown }).usage;
    const answers = (envelope as { answers?: Record<string, { noul?: unknown }> }).answers;
    if (!answers || typeof answers !== 'object' || Array.isArray(answers)) throw new Error('OpenRouter Decisions response did not contain typed answers.');
    const threshold = Number(process.env.OPENROUTER_FINGERPRINT_THRESHOLD || '0.75');
    if (!Number.isFinite(threshold) || threshold < 0 || threshold > 1) throw new Error('OPENROUTER_FINGERPRINT_THRESHOLD must be between 0 and 1.');
    const fingerprintIds = FINGERPRINTS.filter((fingerprint) => {
      const answer = answers[`fingerprint_${fingerprint.id.replace(/-/g, '_')}`];
      return answer && typeof answer.noul === 'number' && answer.noul >= threshold;
    }).map((fingerprint) => fingerprint.id);
    return { movieId: input.movieId, fingerprintIds };
  }
}

export interface ClassificationRunSummary {
  catalogueMovies: number;
  alreadyAssigned: number;
  checkpointClassified: number;
  checkpointNoMatch: number;
  checkpointInsufficientData: number;
  checkpointFailed: number;
  processed: number;
  classified: number;
  noMatch: number;
  insufficientData: number;
  failed: number;
  remaining: number;
}

function isSuccessfulEntry(entry: FingerprintCheckpointEntry | undefined): boolean {
  return entry?.status === 'classified' || entry?.status === 'no-match';
}

export async function classifyFingerprintBatch(
  movies: Movie[],
  classifier: FingerprintClassifier,
  options: { limit?: number; movieId?: string; dryRun?: boolean; checkpointPath?: string; onResult?: (observation: ClassificationObservation) => void } = {},
): Promise<ClassificationRunSummary> {
  const checkpoint = await readFingerprintCheckpoint(options.checkpointPath);
  const assignedIds = new Set(Object.keys(PROTOTYPE_MOVIE_FINGERPRINTS));
  const eligible = movies.filter((movie) => {
    if (assignedIds.has(movie.id)) return false;
    if (options.movieId && movie.id !== options.movieId) return false;
    return !isSuccessfulEntry(checkpoint.entries[movie.id]);
  });
  const selected = eligible.slice(0, options.limit === undefined ? eligible.length : Math.max(0, options.limit));
  const working = options.dryRun ? { ...checkpoint, entries: { ...checkpoint.entries } } : checkpoint;
  let processed = 0;
  let classified = 0;
  let noMatch = 0;
  let failed = 0;
  let insufficientData = 0;
  for (const movie of selected) {
    const input = buildFingerprintClassifierInput(movie);
    const quality = getFingerprintInputQuality(input);
    let status: ClassificationStatus;
    let fingerprints: FingerprintId[] = [];
    let error: string | undefined;
    let raw: unknown;
    if (!quality.usable) {
      status = 'insufficient-data';
      error = quality.reason;
      insufficientData += 1;
      processed += 1;
      if (!options.dryRun) {
        working.entries[movie.id] = {
          movieId: movie.id,
          tmdbId: movie.tmdbId,
          title: movie.title,
          input,
          status,
          fingerprints: [],
          error,
          updatedAt: new Date().toISOString(),
        };
        await writeFingerprintCheckpoint(working, options.checkpointPath);
      }
      continue;
    }
    try {
      raw = await classifier.classifyMovie(input);
      const validation = validateClassifierResult(raw, movie.id);
      options.onResult?.({ input, raw, validation });
      if (!validation.ok) throw new Error(validation.error);
      fingerprints = validation.result.fingerprints;
      status = fingerprints.length === 0 ? 'no-match' : 'classified';
    } catch (caught) {
      if (raw === undefined) options.onResult?.({ input, raw, validation: { ok: false, error: caught instanceof Error ? caught.message : String(caught) } });
      status = 'failed';
      error = caught instanceof Error ? caught.message : String(caught);
    }
    processed += 1;
    if (status === 'classified') classified += 1;
    if (status === 'no-match') noMatch += 1;
    if (status === 'failed') failed += 1;
    if (!options.dryRun) {
      working.entries[movie.id] = {
        movieId: movie.id,
        tmdbId: movie.tmdbId,
        title: movie.title,
        input,
        status,
        fingerprints,
        ...(error ? { error } : {}),
        updatedAt: new Date().toISOString(),
      };
      await writeFingerprintCheckpoint(working, options.checkpointPath);
    }
  }
  const entries = Object.values(checkpoint.entries);
  const checkpointClassified = entries.filter((entry) => entry.status === 'classified').length;
  const checkpointNoMatch = entries.filter((entry) => entry.status === 'no-match').length;
  const checkpointInsufficientData = entries.filter((entry) => entry.status === 'insufficient-data').length;
  const checkpointFailed = entries.filter((entry) => entry.status === 'failed').length;
  const completed = new Set(entries.filter((entry) => isSuccessfulEntry(entry)).map((entry) => entry.movieId));
  const remaining = movies.filter((movie) => !assignedIds.has(movie.id) && !completed.has(movie.id)).length;
  return {
    catalogueMovies: movies.length,
    alreadyAssigned: movies.filter((movie) => assignedIds.has(movie.id)).length,
    checkpointClassified,
    checkpointNoMatch,
    checkpointInsufficientData,
    checkpointFailed,
    processed,
    classified,
    noMatch,
    insufficientData,
    failed,
    remaining,
  };
}

export function emptyFingerprintCheckpoint(): FingerprintCheckpoint {
  return { version: 1, updatedAt: new Date().toISOString(), entries: {} };
}

export function validateCheckpoint(raw: unknown): { ok: true; checkpoint: FingerprintCheckpoint } | { ok: false; error: string } {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { ok: false, error: 'Checkpoint must be an object.' };
  const value = raw as Record<string, unknown>;
  if (value.version !== 1 || typeof value.updatedAt !== 'string' || !value.entries || typeof value.entries !== 'object' || Array.isArray(value.entries)) {
    return { ok: false, error: 'Checkpoint has an invalid shape.' };
  }
  const entries: Record<string, FingerprintCheckpointEntry> = {};
  for (const [key, rawEntry] of Object.entries(value.entries)) {
    if (!rawEntry || typeof rawEntry !== 'object' || Array.isArray(rawEntry)) return { ok: false, error: `Checkpoint entry ${key} is malformed.` };
    const entry = rawEntry as Record<string, unknown>;
    if (typeof entry.movieId !== 'string' || entry.movieId !== key || !Number.isInteger(entry.tmdbId) || typeof entry.title !== 'string' || typeof entry.updatedAt !== 'string') return { ok: false, error: `Checkpoint entry ${key} has invalid movie metadata.` };
    if (!entry.input || typeof entry.input !== 'object' || Array.isArray(entry.input)) return { ok: false, error: `Checkpoint entry ${key} has invalid classifier input.` };
    if (entry.status !== 'classified' && entry.status !== 'no-match' && entry.status !== 'insufficient-data' && entry.status !== 'failed') return { ok: false, error: `Checkpoint entry ${key} has an invalid status.` };
    const result = validateClassifierResult({ movieId: entry.movieId, fingerprints: entry.fingerprints }, key);
    if (!result.ok) return { ok: false, error: `Checkpoint entry ${key}: ${result.error}` };
    if (entry.status === 'classified' && result.result.fingerprints.length === 0) return { ok: false, error: `Checkpoint entry ${key} is classified without fingerprints.` };
    if (entry.status === 'insufficient-data' && result.result.fingerprints.length > 0) return { ok: false, error: `Checkpoint entry ${key} is insufficient-data but contains fingerprints.` };
    if (entry.status === 'insufficient-data' && typeof entry.error !== 'string') return { ok: false, error: `Checkpoint entry ${key} is insufficient-data without a reason.` };
    if (entry.status === 'failed' && result.result.fingerprints.length > 0) return { ok: false, error: `Checkpoint entry ${key} is failed but contains fingerprints.` };
    if (entry.status === 'failed' && typeof entry.error !== 'string') return { ok: false, error: `Checkpoint entry ${key} is failed without an error.` };
    entries[key] = { movieId: key, tmdbId: entry.tmdbId as number, title: entry.title as string, input: entry.input as FingerprintClassifierInput, status: entry.status, fingerprints: result.result.fingerprints, ...(typeof entry.error === 'string' ? { error: entry.error } : {}), updatedAt: entry.updatedAt as string };
  }
  return { ok: true, checkpoint: { version: 1, updatedAt: value.updatedAt, entries } };
}

export async function readFingerprintCheckpoint(filePath = FINGERPRINT_CHECKPOINT_PATH): Promise<FingerprintCheckpoint> {
  try {
    const raw = JSON.parse(await fs.readFile(filePath, 'utf8')) as unknown;
    const result = validateCheckpoint(raw);
    if (!result.ok) throw new Error(result.error);
    return result.checkpoint;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return emptyFingerprintCheckpoint();
    throw error;
  }
}

export async function writeFingerprintCheckpoint(checkpoint: FingerprintCheckpoint, filePath = FINGERPRINT_CHECKPOINT_PATH): Promise<void> {
  await writeFileAtomically(filePath, JSON.stringify({ ...checkpoint, updatedAt: new Date().toISOString() }, null, 2) + '\n');
}

export function mergeFingerprintAssignments(checkpoint: FingerprintCheckpoint): Record<string, readonly FingerprintId[]> {
  const assignments: Record<string, readonly FingerprintId[]> = { ...PROTOTYPE_MOVIE_FINGERPRINTS };
  for (const entry of Object.values(checkpoint.entries)) {
    if (entry.status === 'classified') {
      if (assignments[entry.movieId]) throw new Error(`Refusing to overwrite existing fingerprint assignment for ${entry.movieId}.`);
      assignments[entry.movieId] = [...entry.fingerprints].sort();
    }
  }
  return Object.fromEntries(Object.entries(assignments).sort(([left], [right]) => left.localeCompare(right)));
}

export function buildFingerprintOverlaySource(assignments: Record<string, readonly FingerprintId[]>): string {
  return `import type { Movie } from '../types';
import { getFingerprintById, isFingerprintId, type FingerprintDefinition, type FingerprintId } from './fingerprints';

/**
 * Phase-one editorial sample and explicitly applied classifier results.
 */
export const PROTOTYPE_MOVIE_FINGERPRINTS: Readonly<Record<string, readonly FingerprintId[]>> = ${JSON.stringify(assignments, null, 2)};

export function getMovieFingerprintIds(movie: Pick<Movie, 'id' | 'fingerprints'>): FingerprintId[] {
  const values = movie.fingerprints ?? PROTOTYPE_MOVIE_FINGERPRINTS[movie.id] ?? [];
  return [...new Set(values)].filter(isFingerprintId);
}

export function getMovieFingerprints(movie: Pick<Movie, 'id' | 'fingerprints'>): FingerprintDefinition[] {
  return getMovieFingerprintIds(movie).map((id) => getFingerprintById(id)!).filter(Boolean);
}

export function movieHasFingerprint(movie: Pick<Movie, 'id' | 'fingerprints'>, fingerprintId: string): boolean {
  return getMovieFingerprintIds(movie).includes(fingerprintId as FingerprintId);
}

export function getRelatedMovieFingerprints(movies: Array<Pick<Movie, 'id' | 'fingerprints'>>, currentFingerprintId: string): FingerprintDefinition[] {
  const counts = new Map<FingerprintId, number>();
  for (const movie of movies) {
    for (const fingerprintId of getMovieFingerprintIds(movie)) {
      if (fingerprintId !== currentFingerprintId) counts.set(fingerprintId, (counts.get(fingerprintId) || 0) + 1);
    }
  }
  return [...counts.entries()]
    .sort((left, right) => right[1] - left[1] || getFingerprintById(left[0])!.label.localeCompare(getFingerprintById(right[0])!.label))
    .map(([id]) => getFingerprintById(id)!)
    .filter(Boolean);
}
`;
}
