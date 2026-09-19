/**
 * Canonical URL Architecture for XmasDB.com
 *
 * /                         Main XmasDB / All Movies landing page
 * /movies/                  All movies
 * /hallmark/                Hallmark Christmas movies
 * /lifetime/                Lifetime Christmas movies
 * /gaf/                     GAF Christmas movies (future)
 *
 * /movie/{tmdbId}/{slug}/   Individual movie (network-independent)
 * /actor/{tmdbId}/{slug}/   Individual actor (network-independent)
 * /year/{year}/             All-network year archive
 *
 * /hallmark/{year}/         Hallmark movies for a year
 * /lifetime/{year}/         Lifetime movies for a year
 *
 * /feeds/                   Human-facing Radarr / JSON feeds page
 */

export const SITE_ORIGIN = 'https://xmasdb.com';

/**
 * Generate canonical movie path: /movie/{tmdbId}/{slug}/
 */
export function getMoviePath(tmdbId: number | string, slug: string): string {
  const cleanSlug = slug.toLowerCase().replace(/^\/+|\/+$/g, '');
  return `/movie/${tmdbId}/${cleanSlug}/`;
}

/**
 * Generate canonical actor path: /actor/{tmdbPersonId}/{slug}/
 */
export function getActorPath(tmdbPersonId: number | string, slug: string): string {
  const cleanSlug = slug.toLowerCase().replace(/^\/+|\/+$/g, '');
  return `/actor/${tmdbPersonId}/${cleanSlug}/`;
}

/** Generate the public Radarr-compatible actor feed path. */
export function getActorFeedPath(tmdbPersonId: number | string): string {
  return `/json/actors/${tmdbPersonId}.json`;
}

/**
 * Generate canonical network / brand path:
 * /{brandSlug}/ or /{brandSlug}/{year}/
 */
export function getNetworkPath(brandSlug: string, year?: number | null): string {
  const cleanSlug = brandSlug.toLowerCase().replace(/^\/+|\/+$/g, '');
  if (year && !isNaN(year)) {
    return `/${cleanSlug}/${year}/`;
  }
  return `/${cleanSlug}/`;
}

/**
 * Generate canonical all-network year path: /year/{year}/
 */
export function getYearPath(year: number): string {
  return `/year/${year}/`;
}

/**
 * Generate canonical all movies path: /movies/
 */
export function getMoviesPath(): string {
  return `/movies/`;
}

/**
 * Generate canonical feeds path: /feeds/
 */
export function getFeedsPath(): string {
  return `/feeds/`;
}

/**
 * Convert relative canonical path to absolute canonical URL
 */
export function toCanonicalUrl(path: string): string {
  const normalized = path.startsWith('/') ? path : `/${path}`;
  // Keep file extensions as-is, otherwise ensure trailing slash
  const hasExtension = /\.[a-z0-9]+$/i.test(normalized);
  const withSlash = hasExtension || normalized.endsWith('/') ? normalized : `${normalized}/`;
  return `${SITE_ORIGIN}${withSlash}`;
}
