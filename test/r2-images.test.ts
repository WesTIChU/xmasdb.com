import assert from 'node:assert/strict';
import { buildInventory } from '../scripts/r2-images';

const inventory = await buildInventory();
assert.equal(inventory.schemaVersion, 1);
assert.ok(inventory.files.length > 0);
assert.ok(inventory.files.every((file) => file.sourceLocalPath.startsWith('public/images/')));
assert.ok(inventory.files.every((file) => !file.objectKey.startsWith('images/')));
assert.equal(inventory.files.find((file) => file.sourceLocalPath === 'public/images/posters/1773345.jpg')?.objectKey, 'posters/1773345.jpg');
assert.equal(inventory.files.find((file) => file.sourceLocalPath === 'public/images/backdrops/1773345.jpg')?.objectKey, 'backdrops/1773345.jpg');
assert.equal(inventory.files.find((file) => file.sourceLocalPath === 'public/images/people/92856.webp')?.objectKey, 'people/92856.webp');
assert.equal(inventory.files.find((file) => file.sourceLocalPath === 'public/images/optimized/posters/974213-320.webp')?.objectKey, 'optimized/posters/974213-320.webp');
assert.equal(inventory.files.find((file) => file.sourceLocalPath === 'public/images/optimized/people/92856-216.webp')?.objectKey, 'optimized/people/92856-216.webp');
assert.ok(inventory.files.every((file) => /^[a-f0-9]{64}$/.test(file.sha256)));
assert.ok(inventory.files.every((file) => file.byteSize > 0));
assert.deepEqual(inventory.preExistingMissingPersonFiles, [
  '/images/people/1883215.webp',
  '/images/people/2129919.webp',
  '/images/people/3739138.webp',
]);
console.log('R2 image inventory tooling tests passed.');
