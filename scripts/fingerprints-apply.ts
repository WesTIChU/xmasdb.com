import { writeFileAtomically } from '../src/utils/atomic-file';
import {
  FINGERPRINT_OVERLAY_PATH,
  buildFingerprintOverlaySource,
  mergeFingerprintAssignments,
  readFingerprintCheckpoint,
} from '../src/server/fingerprint-classification';

const write = process.argv.includes('--write');
const checkpoint = await readFingerprintCheckpoint();
const assignments = mergeFingerprintAssignments(checkpoint);
const source = buildFingerprintOverlaySource(assignments);
console.log(`VALIDATED CLASSIFIED ENTRIES: ${Object.values(checkpoint.entries).filter((entry) => entry.status === 'classified').length}`);
console.log(`TOTAL OVERLAY ASSIGNMENTS: ${Object.keys(assignments).length}`);
if (!write) {
  console.log('APPLY PREVIEW ONLY: no source files were changed. Use --write for the explicit apply step.');
} else {
  await writeFileAtomically(FINGERPRINT_OVERLAY_PATH, source);
  console.log(`Applied validated assignments to ${FINGERPRINT_OVERLAY_PATH}`);
}
