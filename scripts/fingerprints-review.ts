import { MOVIES } from '../src/data/movies';
import { getFingerprintById } from '../src/data/fingerprints';
import { readFingerprintCheckpoint } from '../src/server/fingerprint-classification';

const checkpoint = await readFingerprintCheckpoint();
const movies = new Map(MOVIES.map((movie) => [movie.id, movie]));
for (const entry of Object.values(checkpoint.entries).sort((left, right) => left.title.localeCompare(right.title))) {
  console.log(`\n${entry.title} (${entry.movieId})`);
  console.log(`Synopsis: ${entry.input.synopsis}`);
  console.log(`Status: ${entry.status}`);
  console.log(`Fingerprints: ${entry.fingerprints.map((id) => getFingerprintById(id)?.label || id).join(', ') || '(none)'}`);
  if (entry.error) console.log(`Validation failure: ${entry.error}`);
  if (!movies.has(entry.movieId)) console.log('Warning: movie is no longer in the local catalogue.');
}
console.log(`\nREVIEW ENTRIES: ${Object.keys(checkpoint.entries).length}`);
