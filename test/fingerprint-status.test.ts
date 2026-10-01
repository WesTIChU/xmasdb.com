import assert from 'node:assert/strict';
import { buildFingerprintClassifierInput, emptyFingerprintCheckpoint } from '../src/server/fingerprint-classification';
import { buildFingerprintStatusReport } from '../src/server/fingerprint-status';
import { MOVIES } from '../src/data/movies';

const movie = MOVIES[0];
const startedAt = '2026-10-01T00:00:00.000Z';
const checkpoint = emptyFingerprintCheckpoint();
checkpoint.entries[movie.id] = {
  movieId: movie.id,
  tmdbId: movie.tmdbId,
  title: movie.title,
  input: buildFingerprintClassifierInput(movie),
  status: 'classified',
  fingerprints: ['football'],
  updatedAt: '2026-10-01T00:01:00.000Z',
};
checkpoint.entries['old-movie'] = {
  movieId: 'old-movie',
  tmdbId: 1,
  title: 'Old Movie',
  input: { movieId: 'old-movie', tmdbId: 1, title: 'Old Movie', year: 2020, releaseDate: '', network: '', synopsis: '', genres: [] },
  status: 'failed',
  fingerprints: [],
  updatedAt: '2026-09-30T00:01:00.000Z',
};

const report = buildFingerprintStatusReport({
  checkpoint,
  startedAt,
  finishedAt: '2026-10-01T00:02:00.000Z',
  requestedStatus: 'SUCCESS',
  applyStats: { applied: 1, skippedExisting: 2 },
});
assert.equal(report.lastRun?.status, 'SUCCESS');
assert.equal(report.lastRun?.processed, 1, 'only entries from the current run are reported');
assert.equal(report.lastRun?.classified, 1);
assert.equal(report.lastRun?.newAssignmentsApplied, 1);
assert.equal(report.lastRun?.skippedExistingAssignments, 2);
assert.equal(report.lastRun?.recentMovies[0].title, movie.title);
assert.equal(JSON.stringify(report).includes('OPENROUTER_API_KEY'), false, 'report contains no secrets');
assert.equal(JSON.stringify(report).includes('raw'), false, 'report contains no raw model response field');

checkpoint.entries[movie.id] = { ...checkpoint.entries[movie.id], status: 'failed', fingerprints: [], updatedAt: '2026-10-01T00:03:00.000Z' };
const partial = buildFingerprintStatusReport({ checkpoint, startedAt, finishedAt: '2026-10-01T00:04:00.000Z', requestedStatus: 'SUCCESS' });
assert.equal(partial.lastRun?.status, 'PARTIAL');
assert.equal(partial.lastRun?.failed, 1);

console.log('Fingerprint status report aggregation and sanitisation tests passed.');
