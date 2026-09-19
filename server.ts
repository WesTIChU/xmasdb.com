import 'dotenv/config';
import express from 'express';
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

function isKnownPagePath(rawPath: string): boolean {
  const clean = rawPath.replace(/^\/+|\/+$/g, '');
  if (!clean || clean === 'movies' || clean === 'all' || clean === 'feeds') return true;
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

  // Health check
  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', service: 'XmasDB.com' });
  });

  // Logo asset handlers
  app.get('/logo.png', (_req, res, next) => {
    const pngPath = path.join(process.cwd(), 'public', 'logo.png');
    if (fs.existsSync(pngPath)) {
      res.setHeader('Content-Type', 'image/png');
      return res.sendFile(pngPath);
    }
    next();
  });

  app.get('/logo.svg', (_req, res, next) => {
    const svgPath = path.join(process.cwd(), 'public', 'logo.svg');
    if (fs.existsSync(svgPath)) {
      res.setHeader('Content-Type', 'image/svg+xml');
      return res.sendFile(svgPath);
    }
    next();
  });

  // XML Sitemap for Search Engines
  app.get('/sitemap.xml', (_req, res) => {
    res.setHeader('Content-Type', 'application/xml; charset=utf-8');
    res.send(getSitemapXml());
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
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      if (!isKnownPagePath(req.path)) res.status(404);
      res.sendFile(path.join(distPath, 'index.html'));
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
