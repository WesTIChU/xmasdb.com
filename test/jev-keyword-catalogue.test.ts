import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import type { Movie } from '../src/types';
import { runJevKeywordCatalogue } from '../src/server/jev-keyword-catalogue';
import type { JevKeywordClassifier } from '../src/server/jev-keywords';
import { fingerprintJevKeywordInput } from '../src/server/jev-keyword-refresh';

console.log('Running standalone Jev keyword catalogue tests...');

const movie = {
  id: 'standalone-jev-test', slug: 'standalone-jev-test', title: 'Standalone Jev Test', year: 2026,
  brandId: 'hallmark', releaseDate: '2026-12-01', synopsis: 'A lawyer saves her family restaurant from demolition.', posterUrl: '', cast: [], tmdbId: 746045,
  keywords: [{ id: 123, name: 'restaurant' }],
} satisfies Movie;
const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'xmasdb-jev-catalogue-'));
const checkpointPath = path.join(tempDir, 'checkpoint.json');
let calls = 0;
let writes = 0;
const classifier: JevKeywordClassifier = {
  async classifyMovie() {
    calls += 1;
    return { newKeywords: [{ keyword: 'lawyer', evidence: 'lawyer', reason: 'Explicit occupation.' }] };
  },
};

const first = await runJevKeywordCatalogue({ movies: [movie], classifier, checkpointPath, writeMovies: async () => { writes += 1; } });
assert.equal(first.changed, true, 'standalone run writes when Jev adds a keyword');
assert.equal(writes, 1);
assert.deepStrictEqual(first.movies[0].keywords, [{ id: 123, name: 'restaurant' }, { name: 'lawyer', evidence: 'lawyer' }], 'TMDB keyword survives and Jev evidence is retained');
assert.equal('id' in first.movies[0].keywords![1], false, 'Jev keyword has no numeric ID');

const second = await runJevKeywordCatalogue({ movies: first.movies, classifier, checkpointPath, writeMovies: async () => { writes += 1; } });
assert.equal(second.skipped, 1, 'unchanged successful fingerprint skips the API');
assert.equal(calls, 1, 'unchanged successful fingerprint makes no second API call');
assert.equal(writes, 1, 'unchanged catalogue produces no write');

const oldVersionCheckpoint = path.join(tempDir, 'old-version.json');
await fs.writeFile(oldVersionCheckpoint, JSON.stringify({ version: 1, updatedAt: '', entries: { [movie.id]: {
  movieId: movie.id, tmdbId: movie.tmdbId, classifierVersion: 'jev-keywords-v1', fingerprint: fingerprintJevKeywordInput(movie), status: 'success', updatedAt: new Date().toISOString(),
} } }));
const reconsidered = await runJevKeywordCatalogue({ movies: [movie], classifier, checkpointPath: oldVersionCheckpoint });
assert.equal(reconsidered.classified, 1, 'classifier-version change forces reconsideration');
assert.equal(calls, 2);

const failureCheckpoint = path.join(tempDir, 'failure.json');
let failedCalls = 0;
const failing: JevKeywordClassifier = { async classifyMovie() { failedCalls += 1; throw new Error('simulated OpenRouter failure'); } };
const failed = await runJevKeywordCatalogue({ movies: [movie], classifier: failing, checkpointPath: failureCheckpoint, writeMovies: async () => { throw new Error('catalogue should not be written'); } });
assert.equal(failed.failures.length, 1, 'OpenRouter failure is reported');
assert.deepStrictEqual(failed.movies[0].keywords, movie.keywords, 'OpenRouter failure preserves the movie');
assert.equal(failedCalls, 1);
const retry = await runJevKeywordCatalogue({ movies: [movie], classifier, checkpointPath: failureCheckpoint });
assert.equal(retry.classified, 1, 'failed fingerprint remains retryable');

console.log('Standalone Jev keyword catalogue tests passed.');
