import assert from 'node:assert/strict';
import { buildMovieFromTmdb } from '../src/server/movie-import';
import { buildFlarumDiscussionPayload, notifyFlarumMovieAdded } from '../src/server/flarum';

const movie = buildMovieFromTmdb(123456, {
  title: 'A Test Christmas',
  releaseDate: '2026-12-01',
  cast: [
    { actorId: 'one', name: 'Actor One', character: 'Alex', slug: 'actor-one' },
    { actorId: 'two', name: 'Actor Two', character: 'Sam', slug: 'actor-two' },
  ],
}, 'hallmark', 'coming-soon');

const payload = buildFlarumDiscussionPayload(movie);
assert.deepEqual(payload.data.relationships.tags.data, [
  { type: 'tags', id: '13' },
  { type: 'tags', id: '6' },
]);
assert.equal(payload.data.attributes.title, '🎄 New on XmasDB: A Test Christmas (2026)');
assert.match(payload.data.attributes.content, /Network: Hallmark/);
assert.match(payload.data.attributes.content, /Year: 2026/);
assert.match(payload.data.attributes.content, /Starring: Actor One, Actor Two/);
assert.match(payload.data.attributes.content, /https:\/\/xmasdb\.com\/movie\/123456\/a-test-christmas\//);
assert.doesNotMatch(payload.data.attributes.content, /undefined|null/);

const unknownBrandMovie = { ...movie, brandId: 'other-network' };
const unknownBrandPayload = buildFlarumDiscussionPayload(unknownBrandMovie);
assert.deepEqual(unknownBrandPayload.data.relationships.tags.data, [{ type: 'tags', id: '13' }]);
assert.doesNotMatch(unknownBrandPayload.data.attributes.content, /Network:/);

let requestCount = 0;
let requestHeaders: HeadersInit | undefined;
let requestBody = '';
await notifyFlarumMovieAdded(movie, {
  token: 'test-token',
  fetcher: async (_input, init) => {
    requestCount += 1;
    requestHeaders = init?.headers;
    requestBody = String(init?.body || '');
    return new Response('{}', { status: 201 });
  },
});
assert.equal(requestCount, 1);
assert.equal(new Headers(requestHeaders).get('authorization'), 'Token test-token');
assert.deepEqual(JSON.parse(requestBody), payload);

await notifyFlarumMovieAdded(movie, {
  token: 'test-token',
  fetcher: async () => new Response('{}', { status: 503 }),
});
await notifyFlarumMovieAdded(movie, {
  token: 'test-token',
  fetcher: async () => { throw new Error('community unavailable'); },
});
await notifyFlarumMovieAdded(movie, {
  fetcher: async () => { throw new Error('should not be called without a token'); },
});

console.log('Flarum movie announcement payload and failure handling tests passed.');
