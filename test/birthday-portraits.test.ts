import assert from 'node:assert/strict';
import { getUnpublishedBirthdayIds } from '../src/utils/birthday-portraits';

const published = new Set(['134848', '242212']);
assert.deepEqual(getUnpublishedBirthdayIds(['134848', '242212', '900001'], published), ['900001'], 'manifest IDs are skipped');
assert.deepEqual(getUnpublishedBirthdayIds(['900001'], published), ['900001'], 'new eligible IDs remain candidates');
assert.deepEqual(getUnpublishedBirthdayIds(['134848', '242212'], published), [], 'repeated maintenance has no upload candidates');

console.log('Birthday portrait candidate selection tests passed.');
