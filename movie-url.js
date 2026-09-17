/**
 * Shared Movie URL & Slugification Utilities
 * Generates clean, canonical pretty URLs: /movie/{tmdbId}/{slug}
 */

/**
 * Generates an SEO-friendly slug from a movie title according to prompt rules:
 * - lowercase
 * - trim
 * - spaces become hyphens
 * - remove/normalize punctuation
 * - collapse repeated hyphens
 * - remove leading/trailing hyphens
 * - handle apostrophes cleanly
 */
export function slugify(str) {
  if (!str || typeof str !== 'string') return '';
  return str
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove diacritics / accents
    .replace(/['’]/g, '') // handle apostrophes cleanly (e.g. "Santa's" -> "santas")
    .replace(/[^a-z0-9\s-]/g, '') // remove remaining punctuation
    .replace(/[\s_]+/g, '-') // spaces and underscores become hyphens
    .replace(/-+/g, '-') // collapse repeated hyphens
    .replace(/^-+|-+$/g, ''); // remove leading/trailing hyphens
}

/**
 * Returns canonical movie URL: /movie/{tmdbId}/{slug}
 * The TMDB ID remains the authoritative, stable identifier in the URL.
 */
export function getMovieUrl(movie) {
  if (!movie) return '/';
  const tmdbId = movie.tmdbId || movie.tmdb_id || movie.id;
  const title = movie.title || '';
  const slug = slugify(title);

  if (tmdbId) {
    return slug ? `/movie/${tmdbId}/${slug}` : `/movie/${tmdbId}`;
  }
  return slug ? `/movie/${slug}` : '/';
}

export function getActorUrl(actor) {
  if (!actor) return '/';
  const id = actor.id;
  const slug = slugify(actor.name || '');
  if (id) return slug ? `/actor/${id}/${slug}` : `/actor/${id}`;
  return slug ? `/actor/${slug}` : '/';
}
