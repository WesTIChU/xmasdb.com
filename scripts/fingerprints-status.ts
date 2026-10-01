import 'dotenv/config';
import { readFingerprintApplyStats, readFingerprintCheckpoint, writeFingerprintStatus } from '../src/server/fingerprint-status';
import { buildFingerprintStatusReport } from '../src/server/fingerprint-status';

function option(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

const startedAt = option('--started-at');
const requestedStatus = option('--status');
if (!startedAt || !Number.isFinite(Date.parse(startedAt))) throw new Error('--started-at must be a valid ISO timestamp.');
if (requestedStatus !== 'SUCCESS' && requestedStatus !== 'FAILED') throw new Error('--status must be SUCCESS or FAILED.');

const finishedAt = new Date().toISOString();
const checkpoint = await readFingerprintCheckpoint();
const applyStats = requestedStatus === 'SUCCESS' ? await readFingerprintApplyStats() : {};
await writeFingerprintStatus(buildFingerprintStatusReport({ checkpoint, startedAt, finishedAt, requestedStatus, applyStats }));
