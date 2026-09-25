import { readFingerprintCheckpoint, writeFingerprintCheckpoint } from '../src/server/fingerprint-classification';

const auditedInsufficientTitles = new Set([
  '12 Days of Giving',
  '12 Games of Christmas',
  'A Baby for Christmas',
  'Believe in Christmas',
  'Chocolate for Christmas',
  'Christmas at Moose Lake',
  'Christmas in Canterbury',
  'Christmas on Cherry Lane',
  'Destined 2: Christmas Once More',
  'Happy Howlidays',
  'The Spirit of Christmas',
  'This Is Our Christmas',
]);

const checkpoint = await readFingerprintCheckpoint();
let migrated = 0;
for (const entry of Object.values(checkpoint.entries)) {
  if (entry.status === 'no-match' && auditedInsufficientTitles.has(entry.title)) {
    entry.status = 'insufficient-data';
    entry.fingerprints = [];
    entry.error = 'Source-data audit: synopsis is empty, generic, sequel-only, or insufficient for reliable classification.';
    migrated += 1;
  }
}
if (migrated !== auditedInsufficientTitles.size) throw new Error(`Expected to migrate ${auditedInsufficientTitles.size} audited entries, found ${migrated}.`);
await writeFingerprintCheckpoint(checkpoint);
console.log(`Migrated ${migrated} audited no-match entries to insufficient-data.`);
