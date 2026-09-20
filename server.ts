import 'dotenv/config';
import express from 'express';
import compression from 'compression';
import path from 'path';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';
import { MOVIES, getMovieByTmdbId, getMovieBySlug, getMovieByTmdbIdAndSlug } from './src/data/movies';
import { getActorByTmdbId, getActorBySlug } from './src/data/actors';
import { getBrandBySlug } from './src/data/brands';
import {
  getRadarrAllFeedJson,
  getRadarrNetworkFeedJson,
  getRadarrYearFeedJson,
  getRadarrActorFeedJson,
  getFullDatabaseJson,
  getBrandMoviesRichJson,
  getActorsRichJson,
  getActorSingleRichJson,
  getRssFeedXml,
  getSitemapXml,
} from './src/utils/feeds';
import { parseCatalogueQuery } from './src/utils/catalogue-pagination';
import {
  buildCatalogueMeta,
  buildCatalogueListing,
  buildHomePayload,
  buildAboutPayload,
  buildMovieDetail,
  buildActorDetail,
  buildSearchIndex,
  buildSearchResults,
  buildFeedsMeta,
} from './src/server/catalogue-api';
import { ContactRateLimiter, ensureContactStorage, getContactDataDir, readContactSubmissions, storeContactSubmission, updateContactSubmissions, validateContactSubmission } from './src/server/contact';
import { ADMIN_SESSION_COOKIE, AdminAuth, AdminLoginRateLimiter, AdminMutationRateLimiter, clearCookieOptions, cookieOptions, isSameOriginMutation } from './src/server/admin-auth';
import { commitMoviesToGitHub, dispatchComingSoonRefresh, isGitHubConfigured, readGitHubBranch, WorkflowDispatchCooldown } from './src/server/github-catalogue';
import { buildMovieFromTmdb, normalizeBrand, normalizeStatus, parseBulkMovieInput } from './src/server/movie-import';
import { fetchTmdbMovie, requireTmdbApiKey } from './src/utils/tmdb';
import { getCanonicalRedirect, getRobotsTxt, getServerSeo, injectSeoIntoHtml } from './src/server/seo';

function isKnownPagePath(rawPath: string): boolean {
  const clean = rawPath.replace(/^\/+|\/+$/g, '');
  if (!clean || clean === 'movies' || clean === 'all' || clean === 'feeds' || clean === 'about' || clean === 'privacy' || clean === 'contact') return true;
  if (clean === 'admin/login' || clean === 'admin/submissions' || clean === 'admin/movies/add') return true;
  if (/^year\/\d+$/i.test(clean)) return true;

  const movie = clean.match(/^movie\/(.+)$/i);
  if (movie) {
    const parts = movie[1].split('/').filter(Boolean);
    if (parts.length === 1) {
      const id = Number(parts[0]);
      return Number.isInteger(id) ? Boolean(getMovieByTmdbId(id)) : Boolean(getMovieBySlug(parts[0]));
    }
    const id = Number(parts[0]);
    return Number.isInteger(id) && Boolean(getMovieByTmdbIdAndSlug(id, parts[1]));
  }

  const actor = clean.match(/^actor\/(.+)$/i);
  if (actor) {
    const parts = actor[1].split('/').filter(Boolean);
    if (parts.length === 1) {
      const id = Number(parts[0]);
      return Number.isInteger(id) ? Boolean(getActorByTmdbId(id)) : Boolean(getActorBySlug(parts[0]));
    }
    const id = Number(parts[0]);
    return Number.isInteger(id) && Boolean(getActorByTmdbId(id));
  }

  const parts = clean.split('/').filter(Boolean);
  if (parts.length === 1) return Boolean(getBrandBySlug(parts[0]));
  if (parts.length === 2) return Boolean(getBrandBySlug(parts[0]) && /^\d+$/.test(parts[1]));
  return false;
}

function getCookieValue(req: express.Request, name: string): string | undefined {
  const cookies = req.headers.cookie?.split(';') || [];
  const prefix = `${name}=`;
  const value = cookies.find((cookie) => cookie.trim().startsWith(prefix));
  if (!value) return undefined;
  try {
    return decodeURIComponent(value.trim().slice(prefix.length));
  } catch {
    return undefined;
  }
}

async function mapWithConcurrency<T, R>(items: T[], limit: number, worker: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  const run = async () => {
    while (next < items.length) {
      const index = next++;
      results[index] = await worker(items[index]);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, run));
  return results;
}

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT || 3000);
  const contactRateLimiter = new ContactRateLimiter();
  const contactDataDir = getContactDataDir();
  await ensureContactStorage(contactDataDir);
  console.log(`Contact submissions directory: ${contactDataDir}`);
  const adminAuth = new AdminAuth({
    password: process.env.XMASDB_ADMIN_PASSWORD,
    secret: process.env.XMASDB_SESSION_SECRET,
  });
  const adminLoginRateLimiter = new AdminLoginRateLimiter();
  const adminMutationRateLimiter = new AdminMutationRateLimiter();
  const comingSoonRefreshCooldown = new WorkflowDispatchCooldown();
  if (!adminAuth.isConfigured()) console.warn('Admin authentication is unavailable: XMASDB_ADMIN_PASSWORD and XMASDB_SESSION_SECRET are required.');
  const isProduction = process.env.NODE_ENV === 'production';
  const requireAdmin = (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (!adminAuth.authenticate(getCookieValue(req, ADMIN_SESSION_COOKIE))) return res.status(401).json({ error: 'Unauthorized' });
    return next();
  };
  const requireSameOrigin = (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (!isSameOriginMutation(req)) return res.status(403).json({ error: 'Forbidden' });
    return next();
  };

  // Enable CORS headers for feeds so external tools like Radarr or curl can fetch without friction
  app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') {
      return res.sendStatus(200);
    }
    next();
  });

  // Compress text-like responses (HTML, CSS, JS, JSON, XML, SVG) with gzip.
  // Images (JPEG/PNG/WebP) are already compressed and left untouched.
  app.use(compression());

  // Health check
  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', service: 'XmasDB.com' });
  });

  // Logo asset handlers
  app.get('/logo.png', (_req, res, next) => {
    const pngPath = path.join(process.cwd(), 'public', 'logo.png');
    if (fs.existsSync(pngPath)) {
      res.setHeader('Content-Type', 'image/png');
      res.setHeader('Cache-Control', 'public, max-age=604800');
      return res.sendFile(pngPath);
    }
    next();
  });

  app.get('/logo.svg', (_req, res, next) => {
    const svgPath = path.join(process.cwd(), 'public', 'logo.svg');
    if (fs.existsSync(svgPath)) {
      res.setHeader('Content-Type', 'image/svg+xml');
      res.setHeader('Cache-Control', 'public, max-age=604800');
      return res.sendFile(svgPath);
    }
    next();
  });

  // XML Sitemap for Search Engines
  app.get('/sitemap.xml', (_req, res) => {
    res.setHeader('Content-Type', 'application/xml; charset=utf-8');
    res.send(getSitemapXml());
  });

  app.get('/robots.txt', (_req, res) => {
    res.type('text/plain').send(getRobotsTxt());
  });

  // =========================================================================
  // PUBLIC RADARR FEEDS (StevenLu Custom Import List Provider Compatible)
  // Format: [ { "title": "Movie Title (2025)", "imdb_id": "tt12345678" } ]
  // Rules:
  // - Top-level JSON array
  // - title: Title (Year)
  // - imdb_id: IMDb ID in tt... format
  // - Released movies eligible; Coming Soon movies eligible only within 7 days of premiere
  // =========================================================================

  // All Networks Radarr Feed
  app.get(['/json/all.json', '/api/feeds/all.json', '/api/feeds/radarr.json'], (_req, res) => {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.send(getRadarrAllFeedJson());
  });

  // Hallmark Radarr Feed
  app.get(['/json/hallmark.json', '/api/feeds/hallmark.json'], (_req, res) => {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.send(getRadarrNetworkFeedJson('hallmark'));
  });

  // Lifetime Radarr Feed
  app.get(['/json/lifetime.json', '/api/feeds/lifetime.json'], (_req, res) => {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.send(getRadarrNetworkFeedJson('lifetime'));
  });

  // GAF Radarr Feed
  app.get(['/json/gaf.json', '/api/feeds/gaf.json'], (_req, res) => {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.send(getRadarrNetworkFeedJson('gaf'));
  });

  // UPtv Radarr Feed
  app.get(['/json/uptv.json', '/api/feeds/uptv.json'], (_req, res) => {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.send(getRadarrNetworkFeedJson('uptv'));
  });

  // Per-Year Radarr Feed
  app.get(['/json/year/:year.json', '/api/feeds/year/:year.json'], (req, res) => {
    const year = parseInt(req.params.year, 10);
    if (isNaN(year)) {
      return res.status(400).json({ error: 'Invalid year specified' });
    }
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.send(getRadarrYearFeedJson(year));
  });

  // Per-Actor Radarr Feed by TMDB Person ID
  app.get(['/json/actors/:tmdbPersonId.json', '/api/feeds/actors/:tmdbPersonId.json'], (req, res) => {
    const tmdbPersonId = parseInt(req.params.tmdbPersonId, 10);
    if (isNaN(tmdbPersonId)) {
      return res.status(400).json({ error: 'Invalid TMDB Person ID' });
    }
    const data = getRadarrActorFeedJson(tmdbPersonId);
    if (!data) {
      return res.status(404).json({ error: 'Actor not found' });
    }
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.send(data);
  });

  // =========================================================================
  // INTERNAL CANONICAL RICH METADATA ENDPOINTS
  // =========================================================================

  app.get(['/api/metadata/all.json', '/json/metadata/all.json'], (_req, res) => {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.send(getFullDatabaseJson());
  });

  app.get(['/api/metadata/hallmark.json'], (_req, res) => {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.send(getBrandMoviesRichJson('hallmark'));
  });

  app.get(['/api/metadata/lifetime.json'], (_req, res) => {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.send(getBrandMoviesRichJson('lifetime'));
  });

  app.get(['/json/actors.json', '/api/metadata/actors.json', '/api/feeds/actors.json'], (_req, res) => {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.send(getActorsRichJson());
  });

  app.get(['/json/actors/:tmdbPersonId/metadata.json', '/api/metadata/actors/:tmdbPersonId.json'], (req, res) => {
    const tmdbPersonId = parseInt(req.params.tmdbPersonId, 10);
    if (isNaN(tmdbPersonId)) {
      return res.status(400).json({ error: 'Invalid TMDB Person ID' });
    }
    const data = getActorSingleRichJson(tmdbPersonId);
    if (!data) {
      return res.status(404).json({ error: 'Actor not found' });
    }
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.send(data);
  });

  // RSS Feed XML
  app.get(['/rss.xml', '/api/feeds/rss.xml', '/api/feeds/rss'], (req, res) => {
    const brand = req.query.brand as string | undefined;
    res.setHeader('Content-Type', 'application/rss+xml; charset=utf-8');
    res.send(getRssFeedXml(brand));
  });

  // =========================================================================
  // LIGHTWEIGHT CLIENT DATA API
  //
  // The browser no longer bundles the full catalogue. These endpoints derive
  // compact, per-page payloads from the same canonical MOVIES / actors data.
  // =========================================================================

  const sendJson = (res: express.Response, payload: unknown, status = 200) => {
    res.status(status).setHeader('Content-Type', 'application/json; charset=utf-8');
    // Catalogue data can be re-seeded without a frontend rebuild, so allow the
    // browser to reuse responses briefly while revalidating in the background.
    res.setHeader('Cache-Control', 'public, max-age=300, stale-while-revalidate=86400');
    res.send(JSON.stringify(payload));
  };

  const toCatalogueSearch = (query: express.Request['query']): string => {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) {
      if (typeof value === 'string') params.set(key, value);
    }
    const search = params.toString();
    return search ? `?${search}` : '';
  };

  // Global catalogue metadata (header, footer, stats strip).
  app.get('/api/meta', (_req, res) => sendJson(res, buildCatalogueMeta()));

  // Homepage sections.
  app.get('/api/home', (_req, res) => sendJson(res, buildHomePayload()));

  app.get('/api/about', (_req, res) => sendJson(res, buildAboutPayload()));
  app.get('/api/privacy', (_req, res) => sendJson(res, {}));

  app.post('/api/contact', express.json({ limit: '16kb' }), async (req, res) => {
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    if (!contactRateLimiter.allow(ip)) {
      return res.status(429).json({ error: 'Too many messages from this address. Please try again later.' });
    }

    const result = validateContactSubmission(req.body);
    if (!result.ok) {
      if (result.code === 'honeypot') return res.status(200).json({ ok: true });
      return res.status(400).json({ error: result.message });
    }

    try {
      await storeContactSubmission(result.submission, contactDataDir);
      return res.status(201).json({ ok: true });
    } catch {
      return res.status(500).json({ error: 'We could not save your message. Please try again.' });
    }
  });

  app.use('/api/contact', (error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    const status = typeof error === 'object' && error !== null && 'status' in error && error.status === 413 ? 413 : 400;
    return res.status(status).json({ error: 'Please check your submission and try again.' });
  });

  app.post('/api/admin/login', requireSameOrigin, express.json({ limit: '4kb' }), (req, res) => {
    if (!adminAuth.isConfigured()) return res.status(503).json({ error: 'Admin login is not configured.' });
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    if (!adminLoginRateLimiter.allow(ip)) return res.status(429).json({ error: 'Too many login attempts. Please try again later.' });
    if (!adminAuth.verifyPassword(req.body?.password)) {
      adminLoginRateLimiter.recordFailure(ip);
      return res.status(401).json({ error: 'Incorrect password.' });
    }
    adminLoginRateLimiter.clear(ip);
    res.setHeader('Set-Cookie', `${ADMIN_SESSION_COOKIE}=${encodeURIComponent(adminAuth.createCookie())}; ${cookieOptions(isProduction)}`);
    return res.json({ authenticated: true });
  });

  app.post('/api/admin/logout', requireSameOrigin, (req, res) => {
    adminAuth.revoke(getCookieValue(req, ADMIN_SESSION_COOKIE));
    res.setHeader('Set-Cookie', `${ADMIN_SESSION_COOKIE}=; ${clearCookieOptions(isProduction)}`);
    return res.status(204).end();
  });

  app.post('/api/admin/refresh-coming-soon', requireAdmin, requireSameOrigin, async (req, res) => {
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    if (!adminMutationRateLimiter.allow(ip)) return res.status(429).json({ error: 'Too many admin requests. Please try again later.' });
    if (!comingSoonRefreshCooldown.canDispatch()) {
      return res.status(429).json({
        status: 'cooldown',
        message: 'A Coming Soon refresh was requested recently. Please try again shortly.',
        retryAfterSeconds: Math.ceil(comingSoonRefreshCooldown.remainingMs() / 1000),
      });
    }
    try {
      await dispatchComingSoonRefresh();
      comingSoonRefreshCooldown.record();
      return res.json({
        status: 'started',
        message: 'Coming Soon refresh started. Any TMDb changes will be committed automatically and deployed by Coolify.',
      });
    } catch (error) {
      console.error(`[Admin Coming Soon Refresh] ${error instanceof Error ? error.message : 'GitHub dispatch failed'}`);
      return res.status(502).json({ error: 'Could not start the refresh. Please try again.' });
    }
  });

  app.get('/api/admin/submissions', requireAdmin, async (_req, res) => {
    try {
      const submissions = (await readContactSubmissions(contactDataDir)).sort((left, right) => right.createdAt.localeCompare(left.createdAt));
      return res.setHeader('Cache-Control', 'no-store').json({
        submissions,
        counts: {
          new: submissions.filter((submission) => submission.status === 'new').length,
          resolved: submissions.filter((submission) => submission.status === 'resolved').length,
          total: submissions.length,
        },
      });
    } catch {
      return res.status(500).json({ error: 'Submissions could not be read safely.' });
    }
  });

  app.patch('/api/admin/submissions/:id', requireAdmin, requireSameOrigin, express.json({ limit: '2kb' }), async (req, res) => {
    const status = req.body?.status;
    if (status !== 'new' && status !== 'resolved') return res.status(400).json({ error: 'Invalid status.' });
    try {
      let found = false;
      const submissions = await updateContactSubmissions((current) => current.map((submission) => {
        if (submission.id !== req.params.id) return submission;
        found = true;
        return { ...submission, status };
      }), contactDataDir);
      if (!found) return res.status(404).json({ error: 'Submission not found.' });
      return res.json({ submission: submissions.find((submission) => submission.id === req.params.id) });
    } catch {
      return res.status(500).json({ error: 'Submission could not be updated safely.' });
    }
  });

  app.delete('/api/admin/submissions/:id', requireAdmin, requireSameOrigin, async (req, res) => {
    try {
      let found = false;
      await updateContactSubmissions((current) => current.filter((submission) => {
        if (submission.id !== req.params.id) return true;
        found = true;
        return false;
      }), contactDataDir);
      return found ? res.status(204).end() : res.status(404).json({ error: 'Submission not found.' });
    } catch {
      return res.status(500).json({ error: 'Submission could not be deleted safely.' });
    }
  });

  app.post('/api/admin/movies/preview', requireAdmin, requireSameOrigin, express.json({ limit: '16kb' }), async (req, res) => {
    try {
      if (!isGitHubConfigured()) return res.status(503).json({ error: 'GitHub catalogue integration is not configured.' });
      const mode = req.body?.mode === 'single' ? 'single' : req.body?.mode === 'bulk' ? 'bulk' : null;
      const defaultBrand = typeof req.body?.defaultBrand === 'string' ? req.body.defaultBrand : 'hallmark';
      const defaultStatus = typeof req.body?.defaultStatus === 'string' ? req.body.defaultStatus : 'collection';
      const source = mode === 'single' ? String(req.body?.input || '') : String(req.body?.input || '');
      const parsed = parseBulkMovieInput(source, defaultBrand, defaultStatus, 50);
      if (parsed.error) return res.status(400).json({ error: parsed.error });
      const github = await readGitHubBranch();
      const validItems = parsed.items.filter((item) => item.tmdbId && !item.error);
      const apiKey = requireTmdbApiKey();
      const previews = await mapWithConcurrency(validItems, 3, async (item) => {
        const existing = MOVIES.find((movie) => movie.tmdbId === item.tmdbId) || github.movies.find((movie) => movie.tmdbId === item.tmdbId);
        if (existing) return { ...item, state: 'existing', title: existing.title, existingBrand: existing.brandId, existingStatus: existing.status || (existing.isComingSoon ? 'coming-soon' : 'collection') };
        const metadata = await fetchTmdbMovie(item.tmdbId!, apiKey);
        if (!metadata) return { ...item, state: 'not-found' };
        return {
          ...item,
          state: 'ready',
          title: metadata.title || metadata.originalTitle || `TMDB movie ${item.tmdbId}`,
          originalTitle: metadata.originalTitle,
          year: metadata.releaseDate?.slice(0, 4),
          releaseDate: metadata.releaseDate,
          imdbId: metadata.imdbId,
          runtimeMinutes: metadata.runtimeMinutes,
          overview: metadata.synopsis,
          posterUrl: metadata.posterUrl,
        };
      });
      const invalid = parsed.items.filter((item) => item.error);
      return res.json({ baseSha: github.commitSha, items: [...invalid.map((item) => ({ ...item, state: 'invalid' })), ...previews] });
    } catch (error) {
      console.error(`[Admin Movies Preview] ${error instanceof Error ? error.message : 'request failed'}`);
      return res.status(400).json({ error: 'Movies could not be previewed. Check the IDs and server configuration.' });
    }
  });

  app.post('/api/admin/movies/commit', requireAdmin, requireSameOrigin, express.json({ limit: '16kb' }), async (req, res) => {
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    if (!adminMutationRateLimiter.allow(ip)) return res.status(429).json({ error: 'Too many catalogue changes. Please try again later.' });
    try {
      const selected = req.body?.items;
      const baseSha = typeof req.body?.baseSha === 'string' ? req.body.baseSha : '';
      if (!Array.isArray(selected) || selected.length === 0 || selected.length > 50 || !baseSha) return res.status(400).json({ error: 'Choose at least one valid movie and preview it again.' });
      const ids = new Set<number>();
      const choices = selected.map((item: unknown) => {
        const value = item as Record<string, unknown>;
        const tmdbId = Number(value.tmdbId);
        const brand = typeof value.brand === 'string' ? normalizeBrand(value.brand) : undefined;
        const status = typeof value.status === 'string' ? normalizeStatus(value.status) : undefined;
        if (!Number.isInteger(tmdbId) || tmdbId <= 0 || !brand || !status || ids.has(tmdbId)) throw new Error('Invalid movie selection.');
        ids.add(tmdbId);
        return { tmdbId, brand, status };
      });
      const github = await readGitHubBranch();
      if (github.commitSha !== baseSha) return res.status(409).json({ error: 'The XmasDB repository changed while you were reviewing these movies. Refresh the preview and try again.' });
      if (choices.some(({ tmdbId }) => github.movies.some((movie) => movie.tmdbId === tmdbId))) return res.status(409).json({ error: 'One or more selected movies is already in the catalogue. Refresh the preview and try again.' });
      const apiKey = requireTmdbApiKey();
      const fetched = await mapWithConcurrency(choices, 3, async (choice) => {
        const metadata = await fetchTmdbMovie(choice.tmdbId, apiKey);
        if (!metadata) throw new Error(`TMDB movie ${choice.tmdbId} could not be fetched.`);
        return buildMovieFromTmdb(choice.tmdbId, metadata, choice.brand, choice.status);
      });
      const movies = [...github.movies, ...fetched];
      if (new Set(movies.map((movie) => movie.tmdbId)).size !== movies.length) throw new Error('The proposed catalogue contains duplicate TMDB IDs.');
      const commit = await commitMoviesToGitHub(movies, baseSha, fetched.length === 1 ? `Add Christmas movie: ${fetched[0].title}` : `Add ${fetched.length} Christmas movies`);
      return res.json({ added: fetched.length, commitSha: commit.commitSha, message: 'Added to catalogue. Deployment pending.' });
    } catch (error) {
      console.error(`[Admin Movies Commit] ${error instanceof Error ? error.message : 'request failed'}`);
      return res.status(400).json({ error: error instanceof Error && error.message.startsWith('The XmasDB repository changed') ? error.message : 'Catalogue update failed. No GitHub commit was created.' });
    }
  });

  app.use('/api/admin', (error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    return res.status(400).json({ error: 'Please check the request and try again.' });
  });

  // Catalogue listing (all movies, brand pages, year archives).
  app.get('/api/catalogue', (req, res) => {
    const catalogueQuery = parseCatalogueQuery(toCatalogueSearch(req.query));
    const brandSlug = typeof req.query.brand === 'string' ? req.query.brand : undefined;
    const yearValue = typeof req.query.year === 'string' ? Number(req.query.year) : undefined;
    const lockedYear = Number.isInteger(yearValue) && (yearValue as number) > 0 ? yearValue : undefined;
    const listing = buildCatalogueListing(catalogueQuery, brandSlug, lockedYear);
    if (!listing) return sendJson(res, { error: 'Brand not found' }, 404);
    return sendJson(res, listing);
  });

  // Single movie detail (canonical /movie/{tmdbId}/{slug}/ or legacy forms).
  app.get('/api/movie/:tmdbId/:slug', (req, res) => {
    const payload = buildMovieDetail(req.params.tmdbId, req.params.slug);
    if (!payload) return sendJson(res, { error: 'Movie not found' }, 404);
    return sendJson(res, payload);
  });
  app.get('/api/movie/:identifier', (req, res) => {
    const payload = buildMovieDetail(req.params.identifier);
    if (!payload) return sendJson(res, { error: 'Movie not found' }, 404);
    return sendJson(res, payload);
  });

  // Single actor detail (canonical /actor/{tmdbPersonId}/{slug}/ or legacy forms).
  app.get('/api/actor/:tmdbPersonId/:slug', (req, res) => {
    const payload = buildActorDetail(req.params.tmdbPersonId, req.params.slug);
    if (!payload) return sendJson(res, { error: 'Actor not found' }, 404);
    return sendJson(res, payload);
  });
  app.get('/api/actor/:identifier', (req, res) => {
    const payload = buildActorDetail(req.params.identifier);
    if (!payload) return sendJson(res, { error: 'Actor not found' }, 404);
    return sendJson(res, payload);
  });

  // Compact autocomplete index (no biographies, synopses or structured cast).
  app.get(['/api/search-index.json', '/api/search-index'], (_req, res) => sendJson(res, buildSearchIndex()));

  // Full search results for the results view.
  app.get('/api/search', (req, res) => {
    const query = typeof req.query.q === 'string' ? req.query.q : '';
    sendJson(res, buildSearchResults(query));
  });

  // Feeds page counts.
  app.get('/api/feeds/meta', (_req, res) => sendJson(res, buildFeedsMeta()));

  // Vite middleware for development vs static build for production
  if (process.env.NODE_ENV !== 'production') {
    app.use((req, res, next) => {
      if (req.path === '/api/contact' && req.method === 'GET') {
        return res.status(404).json({ error: 'Not found' });
      }
      if ((req.headers.accept || '').includes('text/html') && !isKnownPagePath(req.path)) {
        res.statusCode = 404;
      }
      next();
    });
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    const indexPath = path.join(distPath, 'index.html');

    // Keep public HTML on the canonical host and protocol without redirecting
    // machine-readable API and feed endpoints.
    app.use((req, res, next) => {
      const acceptsHtml = (req.headers.accept || '').includes('text/html');
      const forwardedProtocol = String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim();
      const needsRedirect = acceptsHtml && (
        req.hostname === 'www.xmasdb.com' ||
        (req.hostname === 'xmasdb.com' && forwardedProtocol === 'http')
      );
      if (!needsRedirect) return next();
      return res.redirect(301, `https://xmasdb.com${req.originalUrl}`);
    });

    // Bootstrap metadata is injected into every HTML response so the header,
    // footer and stats strip render accurate counts on the very first frame
    // without a separate request. This is data, not server-rendered markup.
    const metaBootstrap = `<script>window.__XMASDB_META__=${JSON.stringify(buildCatalogueMeta()).replace(/</g, '\\u003c')};</script>`;
    const indexHtml = fs
      .readFileSync(indexPath, 'utf-8')
      .replace('</head>', `    ${metaBootstrap}\n  </head>`);

    const sendIndexHtml = (req: express.Request, res: express.Response, status = 200) => {
      res.status(status);
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.setHeader('Cache-Control', 'no-cache');
      const seo = getServerSeo(req.path, req.originalUrl.includes('?') ? req.originalUrl.slice(req.originalUrl.indexOf('?')) : '');
      res.send(injectSeoIntoHtml(indexHtml, seo));
    };

    // Content-hashed build assets (/assets/*) are immutable by URL and can be cached for a year.
    app.use('/assets', express.static(path.join(distPath, 'assets'), {
      maxAge: '1y',
      immutable: true,
      fallthrough: true,
    }));

    // Generated image derivatives have stable content-specific paths and can be cached independently.
    app.use('/images/optimized', express.static(path.join(distPath, 'images', 'optimized'), {
      maxAge: '1y',
      immutable: true,
      fallthrough: true,
    }));

    app.use('/fonts', express.static(path.join(distPath, 'fonts'), {
      maxAge: '1y',
      immutable: true,
      fallthrough: true,
    }));

    // Locally cached artwork (posters, backdrops, people) may be re-seeded in place under a
    // stable URL, so cache for a week and rely on ETag revalidation rather than immutable.
    app.use('/images', express.static(path.join(distPath, 'images'), {
      maxAge: '7d',
      fallthrough: true,
    }));

    // Serve ONLY explicitly public root files. The dist directory also contains
    // the compiled server bundle and its source map, which must never be
    // reachable over HTTP, so the whole directory is not exposed statically.
    const publicRootFiles = new Set([
      'favicon.png',
      'favicon-64.png',
      'logo.png',
      'logo-550.webp',
      'logo-1100.webp',
      'logo.svg',
      'logo-all.png',
      'robots.txt',
      'site.webmanifest',
      'manifest.webmanifest',
    ]);
    const immutableRootFiles = new Set(['favicon-64.png', 'logo-550.webp', 'logo-1100.webp']);
    for (const fileName of publicRootFiles) {
      const filePath = path.join(distPath, fileName);
      app.get(`/${fileName}`, (_req, res, next) => {
        if (!fs.existsSync(filePath)) return next();
        res.setHeader('Cache-Control', immutableRootFiles.has(fileName)
          ? 'public, max-age=31536000, immutable'
          : 'public, max-age=604800');
        return res.sendFile(filePath);
      });
    }

    // HTML entry points (always revalidated so new deploys reach browsers promptly).
    app.get('*', (req, res, next) => {
      const redirect = getCanonicalRedirect(req.path);
      if (redirect) return res.redirect(301, redirect);
      next();
    });

    app.get(['/', '/index.html'], (req, res) => sendIndexHtml(req, res));

    // SEO-friendly deep links: known catalogue paths render the app shell,
    // unknown paths return a real 404 status.
    app.get('*', (req, res) => {
      sendIndexHtml(req, res, isKnownPagePath(req.path) ? 200 : 404);
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`XmasDB server running on port ${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
