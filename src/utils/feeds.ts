import { MOVIES, getAllYearsForBrand } from '../data/movies';
import { getAllActors, getActorByTmdbId } from '../data/actors';
import { getPopulatedBrands } from '../data/brands';
import { FINGERPRINTS } from '../data/fingerprints';
import { getActorCreditCount, isActorIndexWorthy } from './actor-indexing';
import { getArchiveYearsForNetwork, getMovieArchiveYear } from './catalogue-lifecycle';
import { Movie } from '../types';
import {
  SITE_ORIGIN,
  getMoviePath,
  getActorPath,
  getNetworkPath,
  getYearPath,
  getMoviesPath,
  getFeedsPath,
  getCalendarPath,
  getFingerprintPath,
} from './urls';

/**
 * Public Radarr Feed Item Schema (Radarr Advanced List -> StevenLu Custom format)
 * Exact object structure:
 * [
 *   {
 *     "title": "Movie Title (2025)",
 *     "imdb_id": "tt12345678"
 *   }
 * ]
 */
export interface RadarrFeedItem {
  title: string;
  imdb_id: string;
}

export interface RadarrFeedAudit {
  catalogue: number;
  eligible: number;
  withImdb: number;
  feed: number;
  missingImdbTitles: string[];
}

const NETWORK_ARCHIVE_FEED_BRANDS = new Set(['hallmark', 'lifetime', 'gaf', 'uptv']);

/** Returns the season year used by combined network year feeds. */
export function getRadarrArchiveYear(movie: Movie): number {
  if (NETWORK_ARCHIVE_FEED_BRANDS.has(movie.brandId.toLowerCase())) {
    return getMovieArchiveYear(movie, movie.brandId) ?? movie.year;
  }
  return movie.year;
}

/**
 * Radarr Eligibility Rules:
 * 1. Must have a valid IMDb ID in "tt..." format.
 * 2. Collection/released movies are eligible for Radarr feeds.
 * 3. Coming Soon movies become eligible only when they are within 7 days of their premiere date.
 * 4. A Coming Soon movie with a missing or invalid premiere date must fail closed and remain excluded.
 * 5. This rule applies consistently to all Radarr feeds: full, network, year, and actor feeds.
 */
export function isMovieDateEligibleForRadarr(movie: Movie, referenceDate: Date = new Date()): boolean {
  const nowTime = referenceDate.getTime();
  const premiereDate = movie.premiereDate || movie.releaseDate;

  // If missing or blank canonical premiere date
  if (!premiereDate || typeof premiereDate !== 'string' || premiereDate.trim() === '') {
    // Fail closed for unreleased / coming soon or invalid dates
    return false;
  }

  const premiereTime = Date.parse(premiereDate);
  if (isNaN(premiereTime)) {
    // Missing or invalid premiere date must fail closed and remain excluded
    return false;
  }

  // Determine if movie is Coming Soon (explicit flag or future premiere date)
  const isComingSoon = Boolean(movie.isComingSoon) || premiereTime > nowTime;

  if (isComingSoon) {
    // Coming Soon movies become eligible ONLY when they are within 7 days of their premiere date
    const diffMs = premiereTime - nowTime;
    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;

    if (diffMs > sevenDaysMs) {
      return false; // More than 7 days away -> excluded
    }
  }

  // Released / within 7 days of premiere
  return true;
}

export function isMovieEligibleForRadarr(movie: Movie, referenceDate: Date = new Date()): boolean {
  // IMDb IDs are required by StevenLu's Radarr format.
  return /^tt\d+$/.test(movie.imdbId || '') && isMovieDateEligibleForRadarr(movie, referenceDate);
}

/**
 * Maps an eligible Movie to the exact Radarr feed item schema
 */
export function toRadarrFeedItem(movie: Movie): RadarrFeedItem {
  return {
    title: `${movie.title} (${movie.year})`,
    imdb_id: movie.imdbId!,
  };
}

/**
 * Returns eligible movies formatted for Radarr Advanced List -> StevenLu Custom provider
 */
export function buildRadarrFeed(movies: Movie[], referenceDate: Date = new Date()): RadarrFeedItem[] {
  const seenImdbIds = new Set<string>();
  const feed: RadarrFeedItem[] = [];

  for (const movie of movies) {
    if (!isMovieEligibleForRadarr(movie, referenceDate)) continue;
    const imdbId = movie.imdbId!;
    if (seenImdbIds.has(imdbId)) continue;
    seenImdbIds.add(imdbId);
    feed.push(toRadarrFeedItem(movie));
  }

  return feed;
}

export function getRadarrFeedAudit(movies: Movie[], referenceDate: Date = new Date()): RadarrFeedAudit {
  const dateEligible = movies.filter((movie) => isMovieDateEligibleForRadarr(movie, referenceDate));
  const withImdb = dateEligible.filter((movie) => /^tt\d+$/.test(movie.imdbId || ''));
  return {
    catalogue: movies.length,
    eligible: dateEligible.length,
    withImdb: withImdb.length,
    feed: buildRadarrFeed(movies, referenceDate).length,
    missingImdbTitles: dateEligible.filter((movie) => !/^tt\d+$/.test(movie.imdbId || '')).map((movie) => movie.title),
  };
}

// ---------------- STABLE RADARR FEEDS ----------------

/**
 * /json/all.json
 * Contains eligible movies across all supported networks
 */
export function getRadarrAllFeedJson(): string {
  const feed = buildRadarrFeed(MOVIES);
  return JSON.stringify(feed, null, 2);
}

/**
 * /json/:brand.json (e.g. /json/hallmark.json, /json/lifetime.json)
 * Contains only eligible movies belonging to that network
 */
export function getRadarrNetworkFeedJson(brandId: string): string {
  const networkMovies = MOVIES.filter(
    (m) => m.brandId.toLowerCase() === brandId.toLowerCase()
  );
  const feed = buildRadarrFeed(networkMovies);
  return JSON.stringify(feed, null, 2);
}

/**
 * /json/year/:year.json (e.g. /json/year/2025.json)
 * Contains eligible movies for the specified year
 */
export function getRadarrYearFeedJson(year: number): string {
  const yearMovies = MOVIES.filter((m) => getRadarrArchiveYear(m) === year);
  const feed = buildRadarrFeed(yearMovies);
  return JSON.stringify(feed, null, 2);
}

/**
 * /json/actors/:tmdbPersonId.json
 * Contains eligible Christmas movies featuring that actor, regardless of network
 */
function getRadarrActorMovies(tmdbPersonId: number): Movie[] | null {
  const actor = getActorByTmdbId(tmdbPersonId);
  if (!actor) return null;

  return MOVIES.filter((m) =>
    m.cast.some(
      (c) =>
        (c.tmdbPersonId && c.tmdbPersonId === tmdbPersonId) ||
        c.slug.toLowerCase() === actor.slug.toLowerCase() ||
        c.name.toLowerCase() === actor.name.toLowerCase()
      )
  );
}

export function getRadarrActorFeedJson(tmdbPersonId: number): string | null {
  const actorMovies = getRadarrActorMovies(tmdbPersonId);
  if (!actorMovies) return null;

  const feed = buildRadarrFeed(actorMovies);
  return JSON.stringify(feed, null, 2);
}

export function getRadarrActorFeedCount(tmdbPersonId: number, referenceDate: Date = new Date()): number {
  const actorMovies = getRadarrActorMovies(tmdbPersonId);
  return actorMovies ? buildRadarrFeed(actorMovies, referenceDate).length : 0;
}

// ---------------- RSS FEED ----------------

export function getRssFeedXml(brandId?: string): string {
  const movies = brandId
    ? MOVIES.filter((m) => m.brandId.toLowerCase() === brandId.toLowerCase())
    : MOVIES;

  const siteUrl = SITE_ORIGIN;
  const title = brandId
    ? `${brandId.toUpperCase()} Christmas Movies - XmasDB.com`
    : 'XmasDB.com - New & Upcoming Christmas Movie Additions';
  const description = 'Curated TV Christmas movie releases and holiday filmography updates.';

  const itemsXml = movies
    .slice()
    .sort((a, b) => b.year - a.year)
    .map((m) => {
      const pubDate = new Date(`${m.year}-11-01`).toUTCString();
      const safeSynopsis = m.synopsis
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
      const safeTitle = `${m.title} (${m.year})`
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
      const link = `${siteUrl}${getMoviePath(m.tmdbId, m.slug)}`;

      return `    <item>
      <title>${safeTitle}</title>
      <link>${link}</link>
      <guid isPermaLink="true">${link}</guid>
      <description>${safeSynopsis}</description>
      <category>${m.brandId}</category>
      <pubDate>${pubDate}</pubDate>
    </item>`;
    })
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8" ?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${title}</title>
    <link>${siteUrl}</link>
    <description>${description}</description>
    <language>en-us</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
${itemsXml}
  </channel>
</rss>`;
}

// ---------------- SITEMAP ----------------

type SitemapName = 'movies' | 'actors' | 'archives' | 'pages';
type SitemapEntry = { loc: string; changefreq?: string; priority?: string; lastmod?: string };
let actorSitemapCache: SitemapEntry[] | null = null;

function sitemapEntries(name: SitemapName): SitemapEntry[] {
  const urls: SitemapEntry[] = [];

  if (name === 'movies') {
    for (const m of MOVIES) urls.push({ loc: `${SITE_ORIGIN}${getMoviePath(m.tmdbId, m.slug)}`, changefreq: 'monthly', priority: '0.9' });
    return urls;
  }

  if (name === 'actors') {
    if (actorSitemapCache) return actorSitemapCache;
    const entries: SitemapEntry[] = [];
    for (const actor of getAllActors()) {
      if (isActorIndexWorthy(actor, { length: getActorCreditCount(actor.tmdbPersonId) })) {
        entries.push({ loc: `${SITE_ORIGIN}${getActorPath(actor.tmdbPersonId, actor.slug)}`, changefreq: 'monthly', priority: '0.8' });
      }
    }
    actorSitemapCache = entries;
    return entries;
  }

  if (name === 'archives') {
    for (const b of getPopulatedBrands(MOVIES)) {
      urls.push({ loc: `${SITE_ORIGIN}${getNetworkPath(b.slug)}`, changefreq: 'weekly', priority: '0.8' });
      for (const yr of getArchiveYearsForNetwork(MOVIES, b.id)) urls.push({ loc: `${SITE_ORIGIN}${getNetworkPath(b.slug, yr)}`, changefreq: 'monthly', priority: '0.7' });
    }
    for (const yr of getAllYearsForBrand()) urls.push({ loc: `${SITE_ORIGIN}${getYearPath(yr)}`, changefreq: 'monthly', priority: '0.7' });
    return urls;
  }

  // Useful canonical pages. Query-string variants are deliberately excluded.
  urls.push({ loc: `${SITE_ORIGIN}/`, changefreq: 'daily', priority: '1.0' });
  urls.push({ loc: `${SITE_ORIGIN}/about/`, changefreq: 'monthly', priority: '0.5' });
  urls.push({ loc: `${SITE_ORIGIN}/privacy/`, changefreq: 'monthly', priority: '0.5' });
  urls.push({ loc: `${SITE_ORIGIN}/contact/`, changefreq: 'monthly', priority: '0.5' });
  urls.push({ loc: `${SITE_ORIGIN}${getMoviesPath()}`, changefreq: 'daily', priority: '0.9' });
  urls.push({ loc: `${SITE_ORIGIN}/birthdays`, changefreq: 'weekly', priority: '0.7' });

  urls.push({ loc: `${SITE_ORIGIN}${getFeedsPath()}`, changefreq: 'monthly', priority: '0.5' });
  urls.push({ loc: `${SITE_ORIGIN}${getCalendarPath()}`, changefreq: 'weekly', priority: '0.6' });
  for (const fingerprint of FINGERPRINTS) urls.push({ loc: `${SITE_ORIGIN}${getFingerprintPath(fingerprint.id)}`, changefreq: 'monthly', priority: '0.5' });
  return urls;
}

function escapeSitemapXml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

export function getSitemapChildXml(name: SitemapName): string {
  const urlElements = sitemapEntries(name).map((u) => `  <url>
    <loc>${escapeSitemapXml(u.loc)}</loc>${u.lastmod ? `
    <lastmod>${escapeSitemapXml(u.lastmod)}</lastmod>` : ''}${u.changefreq ? `
    <changefreq>${u.changefreq}</changefreq>` : ''}${u.priority ? `
    <priority>${u.priority}</priority>` : ''}
  </url>`).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urlElements}
</urlset>`;
}

export function getSitemapXml(): string {
  const names: SitemapName[] = ['movies', 'actors', 'archives', 'pages'];
  const sitemapElements = names.map((name) => `  <sitemap><loc>${SITE_ORIGIN}/sitemaps/${name}.xml</loc></sitemap>`).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${sitemapElements}
</sitemapindex>`;
}
