import assert from 'node:assert/strict';
import express from 'express';
import http from 'node:http';
import { registerLegacyImageRedirects } from '../src/server/legacy-image-redirect';

const app = express();
registerLegacyImageRedirects(app);
app.use((_req, res) => res.sendStatus(404));
const server = http.createServer(app);
await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
const address = server.address();
if (!address || typeof address === 'string') throw new Error('Could not determine test server address.');
const baseUrl = `http://127.0.0.1:${address.port}`;

async function location(pathname: string): Promise<{ status: number; location: string | null }> {
  const response = await fetch(`${baseUrl}${pathname}`, { redirect: 'manual' });
  return { status: response.status, location: response.headers.get('location') };
}

for (const [source, target] of [
  ['/images/posters/1773195-92c5b3c8b468.jpg', 'https://images.xmasdb.com/posters/1773195-92c5b3c8b468.jpg'],
  ['/images/backdrops/example.jpg', 'https://images.xmasdb.com/backdrops/example.jpg'],
  ['/images/people/123.webp', 'https://images.xmasdb.com/people/123.webp'],
  ['/images/optimized/posters/example.webp', 'https://images.xmasdb.com/optimized/posters/example.webp'],
  ['/images/optimized/people/example.webp', 'https://images.xmasdb.com/optimized/people/example.webp'],
]) {
  const result = await location(source);
  assert.equal(result.status, 301, `${source} should permanently redirect`);
  assert.equal(result.location, target);
}

const query = await location('/images/posters/example.jpg?source=google');
assert.equal(query.status, 301);
assert.equal(query.location, 'https://images.xmasdb.com/posters/example.jpg?source=google');

for (const pathname of ['/images/404.png', '/images/logo.png', '/images/not-managed/example.jpg']) {
  const result = await location(pathname);
  assert.equal(result.status, 404, `${pathname} must not be caught by the compatibility redirect`);
  assert.equal(result.location, null);
}

await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
console.log('Legacy managed image redirect tests passed.');
