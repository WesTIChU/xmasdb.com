import { writeFileAtomically } from '../src/utils/atomic-file';
import { FINGERPRINT_APPLY_STATS_PATH } from '../src/server/fingerprint-status';
import { MOVIES } from '../src/data/movies';
import { getMovieFingerprintIds } from '../src/data/movie-fingerprints';
import {
  FINGERPRINT_OVERLAY_PATH,
  buildFingerprintOverlaySource,
  mergeFingerprintAssignmentsWithStats,
  readFingerprintCheckpoint,
} from '../src/server/fingerprint-classification';

const write = process.argv.includes('--write');
const sinceValue = process.argv.includes('--since') ? process.argv[process.argv.indexOf('--since') + 1] : undefined;
const checkpoint = await readFingerprintCheckpoint();
const existingAssignments = Object.fromEntries(
  MOVIES
    .map((movie) => [movie.id, getMovieFingerprintIds(movie)] as const)
    .filter(([, fingerprintIds]) => fingerprintIds.length > 0),
);
const merge = mergeFingerprintAssignmentsWithStats(checkpoint, existingAssignments);
const assignments = merge.assignments;
const source = buildFingerprintOverlaySource(assignments);
const since = sinceValue && Number.isFinite(Date.parse(sinceValue)) ? Date.parse(sinceValue) : undefined;
const currentRunEntries = Object.values(checkpoint.entries).filter((entry) => entry.status === 'classified' && (since === undefined || Date.parse(entry.updatedAt) >= since));
const currentRunSkippedExisting = currentRunEntries.filter((entry) => Object.hasOwn(existingAssignments, entry.movieId)).length;
const currentRunApplied = currentRunEntries.length - currentRunSkippedExisting;
await writeFileAtomically(FINGERPRINT_APPLY_STATS_PATH, `${JSON.stringify({ applied: since === undefined ? merge.applied : currentRunApplied, skippedExisting: since === undefined ? merge.skippedExisting : currentRunSkippedExisting })}\n`);
console.log(`VALIDATED CLASSIFIED ENTRIES: ${Object.values(checkpoint.entries).filter((entry) => entry.status === 'classified').length}`);
console.log(`NEW ASSIGNMENTS TO APPLY: ${merge.applied}`);
console.log(`SKIPPED EXISTING ASSIGNMENTS: ${merge.skippedExisting}`);
console.log(`TOTAL OVERLAY ASSIGNMENTS: ${Object.keys(assignments).length}`);
if (!write) {
  console.log('APPLY PREVIEW ONLY: no source files were changed. Use --write for the explicit apply step.');
} else if (merge.applied === 0) {
  console.log('No new assignments to apply; existing production assignments were preserved.');
} else {
  await writeFileAtomically(FINGERPRINT_OVERLAY_PATH, source);
  console.log(`Applied validated assignments to ${FINGERPRINT_OVERLAY_PATH}`);
}
