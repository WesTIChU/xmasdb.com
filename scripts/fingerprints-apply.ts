import { writeFileAtomically } from '../src/utils/atomic-file';
import { MOVIES } from '../src/data/movies';
import { getMovieFingerprintIds } from '../src/data/movie-fingerprints';
import {
  FINGERPRINT_OVERLAY_PATH,
  buildFingerprintOverlaySource,
  mergeFingerprintAssignmentsWithStats,
  readFingerprintCheckpoint,
} from '../src/server/fingerprint-classification';

const write = process.argv.includes('--write');
const checkpoint = await readFingerprintCheckpoint();
const existingAssignments = Object.fromEntries(
  MOVIES
    .map((movie) => [movie.id, getMovieFingerprintIds(movie)] as const)
    .filter(([, fingerprintIds]) => fingerprintIds.length > 0),
);
const merge = mergeFingerprintAssignmentsWithStats(checkpoint, existingAssignments);
const assignments = merge.assignments;
const source = buildFingerprintOverlaySource(assignments);
console.log(`VALIDATED CLASSIFIED ENTRIES: ${Object.values(checkpoint.entries).filter((entry) => entry.status === 'classified').length}`);
console.log(`NEW ASSIGNMENTS TO APPLY: ${merge.applied}`);
console.log(`SKIPPED EXISTING ASSIGNMENTS: ${merge.skippedExisting}`);
console.log(`TOTAL OVERLAY ASSIGNMENTS: ${Object.keys(assignments).length}`);
if (!write) {
  console.log('APPLY PREVIEW ONLY: no source files were changed. Use --write for the explicit apply step.');
} else {
  await writeFileAtomically(FINGERPRINT_OVERLAY_PATH, source);
  console.log(`Applied validated assignments to ${FINGERPRINT_OVERLAY_PATH}`);
}
