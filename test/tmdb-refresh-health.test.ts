import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {
  calculateRefreshHealthStatus,
  completeRefreshRun,
  createRefreshRun,
  getTmdbRefreshHistoryPath,
  readRefreshHistory,
  startRefreshRun,
  unresolvedFailures,
} from '../src/server/tmdb-refresh-health';

const dataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'xmasdb-tmdb-health-'));
try {
  const partial = createRefreshRun('full', new Date('2026-09-25T03:17:00.000Z'));
  await startRefreshRun(partial, dataDir);
  await completeRefreshRun(partial.id, {
    status: 'PARTIAL',
    counters: { ...partial.counters, moviesAttempted: 2, moviesSuccessful: 1, moviesFailed: 1 },
    failures: [{ key: 'movie:42', kind: 'movie', operation: 'fetch movie metadata', tmdbId: 42, message: 'bad api_key=secret-value', timestamp: '2026-09-25T03:18:00.000Z' }],
    successKeys: ['movie:41'],
  }, new Date('2026-09-25T03:19:00.000Z'), dataDir);

  const reloaded = await readRefreshHistory(dataDir);
  assert.equal(reloaded.runs.length, 1, 'history survives reload from persistent storage');
  assert.equal(reloaded.runs[0].status, 'PARTIAL');
  assert.equal(reloaded.runs[0].failures[0].message.includes('secret-value'), false, 'failure history does not store API key values');
  assert.equal(unresolvedFailures(reloaded).length, 1);

  const recovery = createRefreshRun('coming-soon', new Date('2026-09-25T09:23:00.000Z'));
  await startRefreshRun(recovery, dataDir);
  await completeRefreshRun(recovery.id, {
    status: 'SUCCESS',
    counters: { ...recovery.counters, moviesAttempted: 1, moviesSuccessful: 1 },
    failures: [],
    successKeys: ['movie:42'],
  }, new Date('2026-09-25T09:24:00.000Z'), dataDir);
  const recovered = await readRefreshHistory(dataDir);
  assert.equal(unresolvedFailures(recovered).length, 0, 'recovered failures are no longer unresolved');
  assert.ok(recovered.runs[0].failures[0].recoveredAt, 'recovery timestamp is retained');

  const failed = createRefreshRun('manual');
  await startRefreshRun(failed, dataDir);
  await completeRefreshRun(failed.id, {
    status: 'FAILED',
    counters: failed.counters,
    failures: [{ key: 'system:failed', kind: 'system', operation: 'refresh process', message: 'aborted', timestamp: new Date().toISOString() }],
    successKeys: [],
  }, new Date(), dataDir);
  assert.equal((await readRefreshHistory(dataDir)).runs.length, 3, 'failed runs are persisted');
  assert.ok((await fs.readFile(getTmdbRefreshHistoryPath(dataDir), 'utf8')).includes('FAILED'));

  assert.equal(calculateRefreshHealthStatus({ unresolvedFailures: 0, overdueRecords: 0, fullScheduleMissed: false, comingSoonScheduleMissed: false }).status, 'HEALTHY');
  assert.equal(calculateRefreshHealthStatus({ unresolvedFailures: 0, overdueRecords: 10, fullScheduleMissed: false, comingSoonScheduleMissed: false }).status, 'ATTENTION NEEDED', 'overdue data triggers attention');
  assert.equal(calculateRefreshHealthStatus({ unresolvedFailures: 0, overdueRecords: 0, fullScheduleMissed: false, comingSoonScheduleMissed: false }).reasons.length, 0, 'legacy backlog alone does not trigger attention');
} finally {
  await fs.rm(dataDir, { recursive: true, force: true });
}

console.log('TMDB refresh health persistence, recovery, status, and secret-redaction tests passed.');
