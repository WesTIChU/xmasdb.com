import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { getFeedStatistics, recordFeedPull, ensureFeedStatisticsStorage, type FeedDefinition } from '../src/server/feed-statistics';
import { trackSuccessfulFeedResponse } from '../src/server/feed-route';

const root = await fs.mkdtemp(path.join(os.tmpdir(), 'xmasdb-feed-statistics-'));
const collection: FeedDefinition = { id: 'collection:test', name: 'Test Collection', type: 'collection' };
const year: FeedDefinition = { id: 'year:2025', name: 'Year 2025', type: 'year' };
const actor: FeedDefinition = { id: 'actor:123', name: 'Test Actor', type: 'actor' };
const now = new Date('2026-09-21T12:00:00.000Z');

await ensureFeedStatisticsStorage(root);
await Promise.all([
  recordFeedPull(collection, now, root),
  recordFeedPull(collection, now, root),
  recordFeedPull(collection, new Date('2026-09-20T12:00:00.000Z'), root),
  recordFeedPull(year, new Date('2026-09-16T12:00:00.000Z'), root),
  recordFeedPull(actor, new Date('2026-08-01T12:00:00.000Z'), root),
]);

const first = await getFeedStatistics(now, root);
const collectionRow = first.feeds.find((feed) => feed.id === collection.id)!;
assert.equal(collectionRow.totalPulls, 3);
assert.equal(collectionRow.pullsToday, 2);
assert.equal(collectionRow.pullsLast7Days, 3);
assert.equal(collectionRow.pullsLast30Days, 3);
assert.equal(first.summary.totalPulls, 5);
assert.equal(first.feeds.find((feed) => feed.id === actor.id)?.pullsLast30Days, 0);

const reloaded = await getFeedStatistics(now, root);
assert.equal(reloaded.feeds.find((feed) => feed.id === collection.id)?.totalPulls, 3, 'statistics survive a fresh read');
await ensureFeedStatisticsStorage(root);
assert.equal((await getFeedStatistics(now, root)).feeds.find((feed) => feed.id === collection.id)?.totalPulls, 3, 'startup initialization preserves existing statistics');

const listeners = new Map<string, () => void>();
const response = {
  statusCode: 200,
  once(event: 'finish', listener: () => void) { listeners.set(event, listener); },
};
trackSuccessfulFeedResponse(response, collection, root);
listeners.get('finish')?.();
await new Promise((resolve) => setTimeout(resolve, 10));
assert.equal((await getFeedStatistics(now, root)).feeds.find((feed) => feed.id === collection.id)?.totalPulls, 4);

const failedListeners = new Map<string, () => void>();
const failedResponse = {
  statusCode: 404,
  once(event: 'finish', listener: () => void) { failedListeners.set(event, listener); },
};
trackSuccessfulFeedResponse(failedResponse, collection, root);
failedListeners.get('finish')?.();
await new Promise((resolve) => setTimeout(resolve, 10));
assert.equal((await getFeedStatistics(now, root)).feeds.find((feed) => feed.id === collection.id)?.totalPulls, 4, 'failed responses are not counted');

await fs.rm(root, { recursive: true, force: true });
console.log('Feed statistics persistence, aggregation, concurrency, and response-status tests passed.');
