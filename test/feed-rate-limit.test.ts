import assert from 'assert';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { getFeedStatistics, ensureFeedStatisticsStorage } from '../src/server/feed-statistics';
import { trackSuccessfulFeedResponse } from '../src/server/feed-route';
import { isTrustedProxyAddress, PublicFeedRateLimiter } from '../src/server/feed-rate-limit';

console.log('Running public feed rate-limit tests...');

const limiter = new PublicFeedRateLimiter(60, 60 * 60 * 1000);
const start = Date.parse('2026-09-21T12:00:00.000Z');
for (let index = 0; index < 60; index += 1) {
  const decision = limiter.reserve('203.0.113.10', 'collection:hallmark', start + index);
  assert.ok(decision.reservation, `request ${index + 1} should succeed`);
  decision.reservation!.complete(200);
}

const blocked = limiter.reserve('203.0.113.10', 'collection:hallmark', start + 60);
assert.strictEqual(blocked.reservation, null, 'the 61st request to one feed should be rejected');
assert.ok(blocked.retryAfterSeconds > 0, 'rejected requests should provide a retry interval');
const separateFeed = limiter.reserve('203.0.113.10', 'collection:lifetime', start + 60);
assert.ok(separateFeed.reservation, 'each feed should have an independent allowance');
const separateClient = limiter.reserve('203.0.113.11', 'collection:hallmark', start + 60);
assert.ok(separateClient.reservation, 'each client should have an independent allowance');
const afterWindow = limiter.reserve('203.0.113.10', 'collection:hallmark', start + 60 * 60 * 1000 + 1);
assert.ok(afterWindow.reservation, 'requests should become available again after the rolling hour');

assert.ok(isTrustedProxyAddress('173.245.48.1'), 'Cloudflare edge IPs should be trusted for forwarded client identity');
assert.strictEqual(isTrustedProxyAddress('203.0.113.10'), false, 'arbitrary direct clients must not be trusted proxies');

class FakeResponse {
  statusCode = 200;
  private finishListener?: () => void;

  once(event: 'finish', listener: () => void): void {
    assert.strictEqual(event, 'finish');
    this.finishListener = listener;
  }

  finish(statusCode: number): void {
    this.statusCode = statusCode;
    this.finishListener?.();
  }
}

const dataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'xmasdb-feed-rate-limit-'));
try {
  await ensureFeedStatisticsStorage(dataDir);
  const successfulResponse = new FakeResponse();
  trackSuccessfulFeedResponse(successfulResponse, { id: 'collection:hallmark', name: 'Hallmark', type: 'collection' }, dataDir);
  successfulResponse.finish(200);
  await new Promise((resolve) => setTimeout(resolve, 25));

  const rejectedResponse = new FakeResponse();
  trackSuccessfulFeedResponse(rejectedResponse, { id: 'collection:hallmark', name: 'Hallmark', type: 'collection' }, dataDir);
  rejectedResponse.finish(429);
  await new Promise((resolve) => setTimeout(resolve, 25));

  const statistics = await getFeedStatistics(new Date(start), dataDir);
  const hallmark = statistics.feeds.find((feed) => feed.id === 'collection:hallmark');
  assert.strictEqual(hallmark?.totalPulls, 1, 'rejected responses must not increment successful feed statistics');
  assert.ok(!JSON.stringify(statistics).includes('203.0.113.10'), 'feed statistics must not persist client IP addresses');
} finally {
  await fs.rm(dataDir, { recursive: true, force: true });
}

console.log('Public feed rate-limit tests passed.');
