import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import type { Movie } from '../src/types';
import { mergeTmdbKeywords } from '../src/utils/tmdb-refresh';
import { mergeJevKeywordProposals, runJevKeywordRefresh } from '../src/server/jev-keyword-refresh';
import type { JevKeywordClassifier } from '../src/server/jev-keywords';

console.log('Running Jev keyword refresh tests...');

const baseMovie = (keywords: Movie['keywords'] = [], synopsis = 'A lawyer opens a family restaurant.') => ({
  id: 'jev-refresh-test', slug: 'jev-refresh-test', title: 'Test', year: 2026, brandId: 'hallmark', releaseDate: '2026-12-01', synopsis,
  posterUrl: '', cast: [], tmdbId: 123, keywords,
} satisfies Movie);

const jev = { name: 'family business', evidence: 'family restaurant' };
assert.deepStrictEqual(mergeJevKeywordProposals(baseMovie([{ id: 1, name: 'Café' }]), [{ keyword: 'cafe', evidence: 'cafe' }]).keywords, [{ id: 1, name: 'Café' }], 'TMDB Café prevents Jev cafe');
assert.deepStrictEqual(mergeJevKeywordProposals(baseMovie([{ name: 'café', evidence: 'café' }]), [{ keyword: 'cafe', evidence: 'cafe' }]).keywords, [{ name: 'café', evidence: 'café' }], 'existing Jev café prevents Jev cafe');
assert.equal(mergeJevKeywordProposals(baseMovie(), [{ keyword: 'restaurant', evidence: 'restaurant' }, { keyword: 'cafe', evidence: 'cafe' }]).keywords?.length, 2, 'restaurant and cafe remain distinct concepts');
assert.deepStrictEqual(mergeTmdbKeywords([{ name: 'fake relationship', evidence: 'pose as girlfriend' }], [{ id: 99999, name: 'fake relationship' }]), [{ id: 99999, name: 'fake relationship' }], 'a real TMDB concept replaces an equivalent Jev concept');
assert.deepStrictEqual(mergeTmdbKeywords([{ id: 1, name: 'Café' }, { id: 2, name: 'cafe', }], [{ id: 3, name: 'CAFE' }]), [{ id: 1, name: 'Café' }, { id: 2, name: 'cafe' }, { id: 3, name: 'CAFE' }], 'different TMDB IDs are never merged by name');

const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'xmasdb-jev-'));
const checkpointPath = path.join(tempDir, 'checkpoint.json');
let calls = 0;
const classifier: JevKeywordClassifier = {
  async classifyMovie() {
    calls += 1;
    return { newKeywords: [{ keyword: 'family business', evidence: 'family restaurant', reason: 'The synopsis states family restaurant.' }] };
  },
};
const first = await runJevKeywordRefresh(baseMovie(), { classifier, checkpointPath });
assert.equal(first.failure, undefined, 'valid Jev classification succeeds');
assert.deepStrictEqual(first.movie.keywords, [jev], 'Jev evidence persists without an id');
const second = await runJevKeywordRefresh(first.movie, { classifier, checkpointPath });
assert.equal(second.skipped, true, 'successful resulting fingerprint skips unchanged Jev input');
assert.equal(calls, 1, 'unchanged state makes one classifier call');
await runJevKeywordRefresh({ ...first.movie, synopsis: 'A journalist opens a family restaurant.' }, { classifier, checkpointPath });
assert.equal(calls, 2, 'synopsis change triggers reconsideration');
await runJevKeywordRefresh({ ...first.movie, keywords: [...(first.movie.keywords || []), { id: 22, name: 'restaurant' }] }, { classifier, checkpointPath });
assert.equal(calls, 3, 'new TMDB keyword triggers reconsideration');

const failing: JevKeywordClassifier = { async classifyMovie() { throw new Error('OpenRouter unavailable'); } };
const failed = await runJevKeywordRefresh(baseMovie(), { classifier: failing, checkpointPath: path.join(tempDir, 'failed.json') });
assert.equal(failed.failure?.message, 'OpenRouter unavailable', 'Jev failure is reported');
assert.deepStrictEqual(failed.movie.keywords, [], 'Jev failure preserves the successfully refreshed movie state');
const retry = await runJevKeywordRefresh(baseMovie(), { classifier, checkpointPath: path.join(tempDir, 'failed.json') });
assert.equal(retry.skipped, false, 'failed Jev state remains retryable');

console.log('Jev keyword refresh tests passed.');
