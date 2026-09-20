import { getActorBySlug, getActorByTmdbId } from '../data/actors';
import { getMovieBySlug, getMovieByTmdbId } from '../data/movies';
import { getBrandBySlug } from '../data/brands';
import { buildActorDetail, buildCatalogueListing, buildCatalogueMeta } from './catalogue-api';
import { parseCatalogueQuery } from '../utils/catalogue-pagination';
import { buildAboutSeo, buildActorSeo, buildBrandSeo, buildContactSeo, buildFeedsSeo, buildHomeSeo, buildMoviesSeo, buildMovieSeo, buildNotFoundSeo, buildPrivacySeo, buildYearSeo, type SeoDocument } from '../utils/seo';
import { toCanonicalUrl } from '../utils/urls';

export function getRobotsTxt(): string {
  return [
    'User-agent: *',
    'Allow: /',
    'Disallow: /api/',
    'Disallow: /json/',
    'Disallow: /rss.xml',
    'Sitemap: https://xmasdb.com/sitemap.xml',
    '',
  ].join('\n');
}

function routePath(pathname: string): string {
  return pathname.replace(/^\/+|\/+$/g, '');
}

export function getServerSeo(pathname: string, search = ''): SeoDocument {
  const clean = routePath(pathname);
  if (!clean || clean === 'index.html') return buildHomeSeo(buildCatalogueMeta().totalMovies);
  if (clean === 'movies' || clean === 'all') {
    return { ...buildMoviesSeo(buildCatalogueMeta().totalMovies), noIndex: Boolean(search) };
  }
  if (clean === 'feeds') return buildFeedsSeo();
  if (clean === 'about') return buildAboutSeo();
  if (clean === 'privacy') return buildPrivacySeo();
  if (clean === 'contact') return buildContactSeo();

  const yearMatch = clean.match(/^year\/(\d+)$/i);
  if (yearMatch) {
    const year = Number(yearMatch[1]);
    const listing = buildCatalogueListing(parseCatalogueQuery(''), undefined, year);
    return { ...buildYearSeo(year, listing?.total), noIndex: Boolean(search) };
  }

  const movieMatch = clean.match(/^movie\/([^/]+)(?:\/([^/]+))?$/i);
  if (movieMatch) {
    const movie = Number.isInteger(Number(movieMatch[1])) ? getMovieByTmdbId(Number(movieMatch[1])) : getMovieBySlug(movieMatch[1]);
    return movie ? buildMovieSeo(movie) : buildNotFoundSeo();
  }

  const actorMatch = clean.match(/^actor\/([^/]+)(?:\/([^/]+))?$/i);
  if (actorMatch) {
    const actor = Number.isInteger(Number(actorMatch[1])) ? getActorByTmdbId(Number(actorMatch[1])) : getActorBySlug(actorMatch[1]);
    if (!actor) return buildNotFoundSeo();
    const payload = buildActorDetail(String(actor.tmdbPersonId));
    return buildActorSeo(actor, payload?.filmography || []);
  }

  const brandMatch = clean.match(/^([^/]+)(?:\/(\d+))?$/i);
  if (brandMatch) {
    const brand = getBrandBySlug(brandMatch[1]);
    if (!brand) return buildNotFoundSeo();
    const year = brandMatch[2] ? Number(brandMatch[2]) : null;
    const listing = buildCatalogueListing(parseCatalogueQuery(''), brand.slug, year || undefined);
    return { ...buildBrandSeo(brand, year, listing?.total), noIndex: Boolean(search) };
  }
  return buildNotFoundSeo();
}

export function getCanonicalRedirect(pathname: string): string | null {
  const clean = routePath(pathname);
  if (!clean) return null;
  if (clean.toLowerCase() === 'index.html') return '/';
  const movieMatch = clean.match(/^movie\/([^/]+)(?:\/([^/]+))?$/i);
  if (movieMatch) {
    const movie = Number.isInteger(Number(movieMatch[1])) ? getMovieByTmdbId(Number(movieMatch[1])) : getMovieBySlug(movieMatch[1]);
    if (!movie) return null;
    const canonical = `/movie/${movie.tmdbId}/${movie.slug}/`;
    return pathname !== canonical ? canonical : null;
  }
  const actorMatch = clean.match(/^actor\/([^/]+)(?:\/([^/]+))?$/i);
  if (actorMatch) {
    const actor = Number.isInteger(Number(actorMatch[1])) ? getActorByTmdbId(Number(actorMatch[1])) : getActorBySlug(actorMatch[1]);
    if (!actor) return null;
    const canonical = `/actor/${actor.tmdbPersonId}/${actor.slug}/`;
    return pathname !== canonical ? canonical : null;
  }
  if (clean === 'movies' || clean === 'all') return pathname === '/movies/' ? null : '/movies/';
  if (clean === 'feeds') return pathname === '/feeds/' ? null : '/feeds/';
  if (clean === 'about') return pathname === '/about/' ? null : '/about/';
  if (clean === 'privacy') return pathname === '/privacy/' ? null : '/privacy/';
  if (clean === 'contact') return pathname === '/contact/' ? null : '/contact/';
  if (/^year\/\d+$/i.test(clean)) return pathname === `/${clean}/` ? null : `/${clean}/`;
  const brandMatch = clean.match(/^([^/]+)(?:\/(\d+))?$/i);
  if (brandMatch && getBrandBySlug(brandMatch[1])) return pathname === `/${clean.toLowerCase()}/` ? null : `/${clean.toLowerCase()}/`;
  return null;
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function renderMeta(name: string, content: string, property = false): string {
  return `<meta ${property ? 'property' : 'name'}="${name}" content="${escapeHtml(content)}" />`;
}

export function injectSeoIntoHtml(html: string, seo: SeoDocument): string {
  const managed = /\s*(?:<title>[\s\S]*?<\/title>|<meta\s+(?:name|property)="(?:description|robots|og:[^"]+|twitter:[^"]+)"[^>]*\/>|<link\s+rel="canonical"[^>]*\/>|<script\s+id="schema-json-ld"[^>]*>[\s\S]*?<\/script>)/gi;
  const cleaned = html.replace(managed, '');
  const canonical = seo.canonicalPath ? toCanonicalUrl(seo.canonicalPath) : undefined;
  const jsonLd = seo.schema ? JSON.stringify(seo.schema).replace(/</g, '\\u003c') : '';
  const tags = [
    `<title>${escapeHtml(seo.title)}</title>`,
    renderMeta('description', seo.description),
    renderMeta('robots', seo.noIndex ? 'noindex,follow' : 'index,follow'),
    canonical ? `<link rel="canonical" href="${escapeHtml(canonical)}" />` : '',
    renderMeta('og:type', seo.ogType || 'website', true),
    renderMeta('og:site_name', 'XmasDB', true),
    renderMeta('og:title', seo.title, true),
    renderMeta('og:description', seo.description, true),
    canonical ? renderMeta('og:url', canonical, true) : '',
    seo.image ? renderMeta('og:image', seo.image.startsWith('http') ? seo.image : toCanonicalUrl(seo.image), true) : '',
    renderMeta('twitter:card', 'summary_large_image'),
    renderMeta('twitter:title', seo.title),
    renderMeta('twitter:description', seo.description),
    seo.image ? renderMeta('twitter:image', seo.image.startsWith('http') ? seo.image : toCanonicalUrl(seo.image)) : '',
    jsonLd ? `<script id="schema-json-ld" type="application/ld+json">${jsonLd}</script>` : '',
  ].filter(Boolean).join('\n    ');
  return cleaned.replace('</head>', `    ${tags}\n  </head>`);
}
