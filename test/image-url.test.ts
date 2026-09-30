import assert from 'node:assert/strict';
import { resolveImageUrl } from '../src/utils/image-url';

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
assert.ok(!resolveImageUrl('/images/posters/1773345.jpg')!.includes(`${base}/images/`));
console.log('Central image URL resolver tests passed.');
