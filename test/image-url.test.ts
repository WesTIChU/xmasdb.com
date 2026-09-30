import assert from 'node:assert/strict';
import { resolveImageUrl } from '../src/utils/image-url';
import { getHomepageManifestIds } from '../src/utils/homepage-images';
import { MOVIES } from '../src/data/movies';
import { getAllActors } from '../src/data/actors';

const base = 'https://images.xmasdb.com';
const cases = [
  ['/images/posters/1773345.jpg', `${base}/posters/1773345.jpg`],
  ['/images/backdrops/1773345.jpg', `${base}/backdrops/1773345.jpg`],
  ['/images/people/92856.webp', `${base}/people/92856.webp`],
  ['/images/optimized/posters/974213-320.webp', `${base}/optimized/posters/974213-320.webp`],
  ['/images/optimized/people/92856-216.webp', `${base}/optimized/people/92856-216.webp`],
] as const;

for (const [input, expected] of cases) assert.equal(resolveImageUrl(input), expected);
assert.equal(resolveImageUrl('https://image.tmdb.org/t/p/w500/poster.jpg'), 'https://image.tmdb.org/t/p/w500/poster.jpg');
assert.equal(resolveImageUrl('data:image/png;base64,abc'), 'data:image/png;base64,abc');
assert.equal(resolveImageUrl('blob:https://xmasdb.com/image-id'), 'blob:https://xmasdb.com/image-id');
assert.equal(resolveImageUrl('/images/404.png'), '/images/404.png');
assert.equal(resolveImageUrl('/logo-1100.webp'), '/logo-1100.webp');
assert.equal(resolveImageUrl('/images/posters/1772765-69586fd1d4fa.jpg'), `${base}/posters/1772765-69586fd1d4fa.jpg`);
assert.ok(!resolveImageUrl('/images/posters/1773345.jpg')!.includes(`${base}/images/`));
assert.deepEqual(getHomepageManifestIds(['1773006', '1772765', 'new'], new Set(['1772765', '1773006']), false), ['1772765', '1773006']);
assert.deepEqual(getHomepageManifestIds(['1772765', '1773006'], new Set(['1772765', '1773006']), false), ['1772765', '1773006'], 'missing local sources preserve published homepage manifest IDs');
for (const tmdbPersonId of [1883215, 2129919, 3739138]) {
  const castReferences = MOVIES.flatMap((movie) => movie.cast.filter((cast) => cast.tmdbPersonId === tmdbPersonId));
  assert.ok(castReferences.length > 0);
  assert.ok(castReferences.every((cast) => cast.profileUrl === `/images/people/${tmdbPersonId}.webp`), `managed cast path published for ${tmdbPersonId}`);
  const actor = getAllActors().find((entry) => entry.tmdbPersonId === tmdbPersonId);
  assert.ok(actor);
  assert.equal(actor.photoUrl, `/images/people/${tmdbPersonId}.webp`);
  assert.equal(actor.profileUrl, `/images/people/${tmdbPersonId}.webp`);
}
console.log('Central image URL resolver tests passed.');
