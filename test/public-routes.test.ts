import assert from 'node:assert/strict';
import { mkdtemp } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { once } from 'node:events';
import { spawn } from 'node:child_process';
import { MOVIES } from '../src/data/movies';
import { getAllActors, getActorByTmdbId } from '../src/data/actors';
import { FINGERPRINTS } from '../src/data/fingerprints';

const port = 3200 + (process.pid % 500);
const dataDir = await mkdtemp(path.join(os.tmpdir(), 'xmasdb-public-routes-'));
const server = spawn(process.execPath, ['node_modules/tsx/dist/cli.mjs', 'server.ts'], {
  env: {
    ...process.env,
    NODE_ENV: 'production',
    PORT: String(port),
    XMASDB_DATA_DIR: dataDir,
    XMASDB_PUBLIC_API: 'false',
  },
  stdio: 'ignore',
});

const baseUrl = `http://127.0.0.1:${port}`;

async function waitForServer(): Promise<void> {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    try {
      const response = await fetch(`${baseUrl}/api/health`);
      if (response.ok) return;
    } catch {
      // The local server is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error('Local public-route test server did not start.');
}

async function request(route: string): Promise<Response> {
  return fetch(`${baseUrl}${route}`);
}

try {
  await waitForServer();

  const removedActorId = getAllActors()[0]?.tmdbPersonId;
  assert.ok(removedActorId, 'actor fixture should exist');
  const ambiguousActor = getAllActors().find((actor, index, actors) => actors.some((other, otherIndex) => otherIndex > index && other.slug.toLowerCase() === actor.slug.toLowerCase()));
  assert.ok(ambiguousActor, 'duplicate actor slug fixture should exist');

  const removedRoutes = [
    '/api/metadata/all.json',
    '/json/metadata/all.json',
    '/api/metadata/hallmark.json',
    '/api/metadata/lifetime.json',
    '/api/metadata/uptv.json',
    '/json/actors.json',
    '/api/metadata/actors.json',
    '/api/feeds/actors.json',
    `/json/actors/${removedActorId}/metadata.json`,
    `/api/metadata/actors/${removedActorId}.json`,
  ];
  for (const route of removedRoutes) assert.equal((await request(route)).status, 404, `${route} should be removed`);

  const allFeedResponse = await request('/json/all.json');
  assert.equal(allFeedResponse.status, 200);
  const allFeed = await allFeedResponse.json() as Array<Record<string, unknown>>;
  assert.ok(allFeed.length > 0);
  assert.ok(allFeed.every((item) => Object.keys(item).sort().join(',') === 'imdb_id,title'), 'Radarr schema must remain minimal');

  for (const route of ['/api/feeds/all.json', '/api/feeds/radarr.json', '/json/hallmark.json', '/api/feeds/hallmark.json', '/json/lifetime.json', '/api/feeds/lifetime.json', '/json/gaf.json', '/api/feeds/gaf.json', '/json/uptv.json', '/api/feeds/uptv.json']) {
    assert.equal((await request(route)).status, 200, `${route} should remain public`);
  }

  const referenceMovie = MOVIES.find((movie) => movie.imdbId);
  assert.ok(referenceMovie, 'movie fixture should exist');
  assert.equal((await request(`/json/year/${referenceMovie.year}.json`)).status, 200);
  assert.equal((await request(`/api/feeds/year/${referenceMovie.year}.json`)).status, 200);

  const actorId = referenceMovie.cast.find((cast) => cast.tmdbPersonId)?.tmdbPersonId;
  assert.ok(actorId, 'movie actor fixture should exist');
  const actor = getActorByTmdbId(actorId);
  assert.ok(actor, 'actor fixture should resolve');
  assert.equal((await request(`/json/actors/${actorId}.json`)).status, 200);
  assert.equal((await request(`/api/feeds/actors/${actorId}.json`)).status, 200);

  assert.equal((await request('/api/search-index')).status, 200);
  assert.equal((await request('/api/catalogue')).status, 200);
  assert.equal((await request(`/api/movie/${referenceMovie.tmdbId}/${referenceMovie.slug}`)).status, 200);
  assert.equal((await request(`/api/actor/${actor.tmdbPersonId}/${actor.slug}`)).status, 200);
  assert.equal((await request(`/api/fingerprint/${FINGERPRINTS[0].id}`)).status, 200);
  assert.equal((await request('/rss.xml')).status, 200);
  assert.equal((await request('/sitemap.xml')).status, 200);
  const sitemapIndex = await request('/sitemap.xml');
  assert.match(await sitemapIndex.text(), /<sitemapindex/);
  for (const name of ['movies', 'actors', 'archives', 'pages']) {
    const child = await request(`/sitemaps/${name}.xml`);
    assert.equal(child.status, 200, `${name} sitemap should remain public`);
    assert.match(await child.text(), /<urlset/);
  }
  assert.equal((await request(`/actor/${ambiguousActor.slug}/`)).status, 404, 'ambiguous actor slugs must not resolve to the first person');

  for (const route of ['/api/v1/movies', '/api/v1/actors', '/api/v1/ingredients']) {
    assert.equal((await request(route)).status, 404, `${route} should remain disabled in this configuration`);
  }
} finally {
  server.kill('SIGTERM');
  await once(server, 'exit').catch(() => undefined);
}

console.log('Public rich-route removal and public API/Radarr regression tests passed.');
