import 'dotenv/config';
import express from 'express';
import compression from 'compression';
import path from 'path';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';
import { getMovieByTmdbId, getMovieBySlug, getMovieByTmdbIdAndSlug } from './src/data/movies';
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
import { getCanonicalRedirect, getRobotsTxt, getServerSeo, injectSeoIntoHtml } from './src/server/seo';

function isKnownPagePath(rawPath: string): boolean {
  const clean = rawPath.replace(/^\/+|\/+$/g, '');
  if (!clean || clean === 'movies' || clean === 'all' || clean === 'feeds' || clean === 'about') return true;
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

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT || 3000);

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
      'logo.png',
      'logo.svg',
      'logo-all.png',
      'robots.txt',
      'site.webmanifest',
      'manifest.webmanifest',
    ]);
    for (const fileName of publicRootFiles) {
      const filePath = path.join(distPath, fileName);
      app.get(`/${fileName}`, (_req, res, next) => {
        if (!fs.existsSync(filePath)) return next();
        res.setHeader('Cache-Control', 'public, max-age=604800');
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
