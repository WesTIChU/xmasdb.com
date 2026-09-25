import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { MOVIES } from '../src/data/movies';
import { PROTOTYPE_MOVIE_FINGERPRINTS } from '../src/data/movie-fingerprints';
import { buildFingerprintClassifierInput, classifyFingerprintBatch, emptyFingerprintCheckpoint, getFingerprintInputQuality, mergeFingerprintAssignments, readFingerprintCheckpoint, validateCheckpoint, validateClassifierResult } from '../src/server/fingerprint-classification';

const movie = MOVIES.find((candidate) => !Object.hasOwn(PROTOTYPE_MOVIE_FINGERPRINTS, candidate.id))!;
const input = buildFingerprintClassifierInput(movie);
assert.equal(getFingerprintInputQuality({ ...input, synopsis: '' }).usable, false, 'empty synopsis is insufficient-data');
assert.equal(getFingerprintInputQuality({ ...input, synopsis: 'A festive romance film' }).usable, false, 'generic synopsis is insufficient-data');
assert.equal(getFingerprintInputQuality({ ...input, synopsis: 'A woman returns to her hometown for Christmas, where she works with her former love to save her family business and discovers a new future.' }).usable, true, 'meaningful synopsis is usable');

assert.deepEqual(validateClassifierResult({ movieId: movie.id, fingerprints: ['football'] }, movie.id), { ok: true, result: { movieId: movie.id, fingerprints: ['football'] } });
assert.deepEqual(validateClassifierResult({ movieId: movie.id, fingerprints: [] }, movie.id), { ok: true, result: { movieId: movie.id, fingerprints: [] } });
for (const response of [
  { movieId: movie.id, fingerprints: ['christmas-romance-super-mega'] },
  { movieId: movie.id, fingerprints: ['football', 'football'] },
  { movieId: 'wrong-movie', fingerprints: [] },
  { movieId: movie.id, fingerprints: 'football' },
  null,
]) assert.equal(validateClassifierResult(response, movie.id).ok, false);

const tempDirectory = await fs.mkdtemp(path.join(os.tmpdir(), 'xmasdb-fingerprints-'));
const checkpointPath = path.join(tempDirectory, 'checkpoint.json');
let calls = 0;
await classifyFingerprintBatch([movie], { classifyMovie: async (value) => { calls++; return { movieId: value.movieId, fingerprints: ['football'] }; } }, { limit: 1, checkpointPath });
assert.equal(calls, 1);
assert.equal((await readFingerprintCheckpoint(checkpointPath)).entries[movie.id].status, 'classified');
await classifyFingerprintBatch([movie], { classifyMovie: async () => { throw new Error('should be skipped'); } }, { limit: 1, checkpointPath });
assert.equal(calls, 1, 'successful checkpoint entries are not repeated');

const failurePath = path.join(tempDirectory, 'failure.json');
const secondMovie = MOVIES.find((candidate) => candidate.id !== movie.id && !Object.hasOwn(PROTOTYPE_MOVIE_FINGERPRINTS, candidate.id) && getFingerprintInputQuality(buildFingerprintClassifierInput(candidate)).usable)!;
await classifyFingerprintBatch([movie, secondMovie], { classifyMovie: async (value) => {
  if (value.movieId === movie.id) return { movieId: value.movieId, fingerprints: ['invented-id'] };
  return { movieId: value.movieId, fingerprints: [] };
} }, { checkpointPath: failurePath });
const failureCheckpoint = await readFingerprintCheckpoint(failurePath);
assert.equal(failureCheckpoint.entries[movie.id].status, 'failed');
assert.equal(failureCheckpoint.entries[secondMovie.id].status, 'no-match');

const dryRunPath = path.join(tempDirectory, 'dry-run.json');
await classifyFingerprintBatch([movie], { classifyMovie: async (value) => ({ movieId: value.movieId, fingerprints: [] }) }, { dryRun: true, checkpointPath: dryRunPath });
await assert.rejects(fs.access(dryRunPath));

const insufficientPath = path.join(tempDirectory, 'insufficient.json');
let insufficientCalls = 0;
const insufficientMovie = { ...movie, synopsis: '' };
await classifyFingerprintBatch([insufficientMovie], { classifyMovie: async () => { insufficientCalls += 1; return { movieId: movie.id, fingerprints: [] }; } }, { checkpointPath: insufficientPath });
assert.equal(insufficientCalls, 0, 'insufficient metadata does not call the API');
assert.equal((await readFingerprintCheckpoint(insufficientPath)).entries[movie.id].status, 'insufficient-data');
const improvedMovie = { ...movie, synopsis: 'A woman returns to her hometown for Christmas, where she works with her former love to save her family business and discovers a new future while rebuilding important relationships with the people she left behind.' };
await classifyFingerprintBatch([improvedMovie], { classifyMovie: async (value) => { insufficientCalls += 1; return { movieId: value.movieId, fingerprints: [] }; } }, { checkpointPath: insufficientPath });
assert.equal(insufficientCalls, 1, 'improved metadata becomes eligible for classification');
assert.equal((await readFingerprintCheckpoint(insufficientPath)).entries[movie.id].status, 'no-match', 'usable metadata with zero selections remains no-match');

const checkpoint = emptyFingerprintCheckpoint();
checkpoint.entries[movie.id] = { movieId: movie.id, tmdbId: movie.tmdbId, title: movie.title, input, status: 'classified', fingerprints: ['football'], updatedAt: new Date().toISOString() };
const preview = mergeFingerprintAssignments(checkpoint);
assert.deepEqual(preview['hallmark-2026-holiday-touchdown-a-bears-love-story'], PROTOTYPE_MOVIE_FINGERPRINTS['hallmark-2026-holiday-touchdown-a-bears-love-story']);
assert.deepEqual(preview[movie.id], ['football']);
assert.equal(validateCheckpoint({ ...checkpoint, entries: { [movie.id]: { ...checkpoint.entries[movie.id], fingerprints: ['not-real'] } } }).ok, false, 'apply rejects unknown checkpoint IDs');
checkpoint.entries['insufficient-movie'] = { movieId: 'insufficient-movie', tmdbId: 999999, title: 'Insufficient', input: { ...input, movieId: 'insufficient-movie', tmdbId: 999999, title: 'Insufficient', synopsis: '' }, status: 'insufficient-data', fingerprints: [], error: 'Synopsis is empty.', updatedAt: new Date().toISOString() };
assert.equal(mergeFingerprintAssignments(checkpoint)['insufficient-movie'], undefined, 'apply ignores insufficient-data entries');

console.log('Fingerprint classifier contract, mock failures, resume, dry-run, and apply-preview tests passed.');
