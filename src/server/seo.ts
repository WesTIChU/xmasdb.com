import { getActorBySlug, getActorByTmdbId } from '../data/actors';
import { getMovieBySlug, getMovieByTmdbId } from '../data/movies';
import { getBrandBySlug } from '../data/brands';
import { buildAboutPayload, buildActorDetail, buildCatalogueListing, buildCatalogueMeta, buildFeedsMeta, buildHomePayload, buildMovieDetail } from './catalogue-api';
import { getBrandById } from '../data/brands';
import { parseCatalogueQuery } from '../utils/catalogue-pagination';
import { buildAboutSeo, buildActorSeo, buildBrandSeo, buildContactSeo, buildFeedsSeo, buildHomeSeo, buildMoviesSeo, buildMovieSeo, buildNotFoundSeo, buildPrivacySeo, buildYearSeo, type SeoDocument } from '../utils/seo';
import { getActorPath, getMoviePath, toCanonicalUrl } from '../utils/urls';

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
  if (clean === 'admin/login') return { title: 'Admin Login | XmasDB', description: 'Private XmasDB administration.', canonicalPath: '/admin/login/', noIndex: true };
  if (clean === 'admin/submissions') return { title: 'Submissions | XmasDB', description: 'Private XmasDB administration.', canonicalPath: '/admin/submissions/', noIndex: true };
  if (clean === 'admin/movies/add') return { title: 'Add Movies | XmasDB', description: 'Private XmasDB administration.', canonicalPath: '/admin/movies/add/', noIndex: true };

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
    return buildActorSeo(actor, payload?.filmography || [], payload?.titleDisambiguator);
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
  if (clean === 'admin/login') return pathname === '/admin/login/' ? null : '/admin/login/';
  if (clean === 'admin/submissions') return pathname === '/admin/submissions/' ? null : '/admin/submissions/';
  if (clean === 'admin/movies/add') return pathname === '/admin/movies/add/' ? null : '/admin/movies/add/';
  if (/^year\/\d+$/i.test(clean)) return pathname === `/${clean}/` ? null : `/${clean}/`;
  const brandMatch = clean.match(/^([^/]+)(?:\/(\d+))?$/i);
  if (brandMatch && getBrandBySlug(brandMatch[1])) return pathname === `/${clean.toLowerCase()}/` ? null : `/${clean.toLowerCase()}/`;
  return null;
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function renderText(value: string | undefined): string {
  return escapeHtml(value || '').replace(/\r?\n/g, '<br />');
}

function renderMovieContent(pathname: string): string {
  const match = routePath(pathname).match(/^movie\/([^/]+)(?:\/([^/]+))?$/i);
  if (!match) return '';
  const payload = buildMovieDetail(match[1], match[2]);
  if (!payload) return '';
  const { movie } = payload;
  const brand = getBrandById(movie.brandId)?.shortName || movie.brandId;
  const cast = movie.cast.map((member) => {
    const href = member.tmdbPersonId ? getActorPath(member.tmdbPersonId, member.slug) : undefined;
    const name = escapeHtml(member.name);
    return href ? `<li><a href="${escapeHtml(href)}">${name}</a>${member.character ? ` as ${escapeHtml(member.character)}` : ''}</li>` : `<li>${name}</li>`;
  }).join('');
  const facts = [
    `<dt>Network</dt><dd>${escapeHtml(brand)}</dd>`,
    `<dt>Release Date</dt><dd>${escapeHtml(movie.releaseDate || String(movie.year))}</dd>`,
    movie.runtimeMinutes ? `<dt>Runtime</dt><dd>${movie.runtimeMinutes} min</dd>` : '',
    movie.director ? `<dt>Director</dt><dd>${escapeHtml(movie.director)}</dd>` : '',
    movie.voteAverage ? `<dt>Rating</dt><dd>${movie.voteAverage.toFixed(1)}</dd>` : '',
  ].filter(Boolean).join('');
  return `<main id="server-rendered-content"><article><h1>${escapeHtml(movie.title)}</h1><p>${renderText(movie.synopsis)}</p><dl>${facts}</dl><h2>Cast</h2><ul>${cast}</ul></article></main>`;
}

function renderActorContent(pathname: string): string {
  const match = routePath(pathname).match(/^actor\/([^/]+)(?:\/([^/]+))?$/i);
  if (!match) return '';
  const payload = buildActorDetail(match[1], match[2]);
  if (!payload) return '';
  const { actor, filmography } = payload;
  const facts = [
    actor.birthday ? `<dt>Born</dt><dd>${escapeHtml(actor.birthday)}</dd>` : '',
    actor.deathday ? `<dt>Died</dt><dd>${escapeHtml(actor.deathday)}</dd>` : '',
    actor.placeOfBirth ? `<dt>Place of birth</dt><dd>${escapeHtml(actor.placeOfBirth)}</dd>` : '',
    actor.knownForDepartment ? `<dt>Known for</dt><dd>${escapeHtml(actor.knownForDepartment)}</dd>` : '',
  ].filter(Boolean).join('');
  const movies = filmography.map((movie) => `<li><a href="${escapeHtml(getMoviePath(movie.tmdbId, movie.slug))}">${escapeHtml(movie.title)}</a> (${movie.year})${movie.character ? ` as ${escapeHtml(movie.character)}` : ''}</li>`).join('');
  return `<main id="server-rendered-content"><article><h1>${escapeHtml(actor.name)}</h1>${actor.biography ? `<p>${renderText(actor.biography)}</p>` : ''}<dl>${facts}</dl><h2>Christmas movie filmography</h2><ul>${movies}</ul></article></main>`;
}

function withQueryValues(search: string, values: Record<string, string>): string {
  const params = new URLSearchParams(search);
  Object.entries(values).forEach(([key, value]) => params.set(key, value));
  const query = params.toString();
  return query ? `?${query}` : '';
}

function getServerRouteBootstrap(pathname: string, search = ''): { url: string; payload: unknown } | null {
  const clean = routePath(pathname);
  const actorMatch = clean.match(/^actor\/([^/]+)(?:\/([^/]+))?$/i);
  if (actorMatch) {
    const payload = buildActorDetail(actorMatch[1], actorMatch[2]);
    if (payload) return { url: `/api/actor/${actorMatch[1]}${actorMatch[2] ? `/${actorMatch[2]}` : ''}`, payload };
  }
  const movieMatch = clean.match(/^movie\/([^/]+)(?:\/([^/]+))?$/i);
  if (movieMatch) {
    const payload = buildMovieDetail(movieMatch[1], movieMatch[2]);
    if (payload) return { url: `/api/movie/${movieMatch[1]}${movieMatch[2] ? `/${movieMatch[2]}` : ''}`, payload };
  }
  if (!clean) return { url: '/api/home', payload: buildHomePayload() };
  if (clean === 'movies' || clean === 'all') return { url: `/api/catalogue${search}`, payload: buildCatalogueListing(parseCatalogueQuery(search)) };
  const yearMatch = clean.match(/^year\/(\d+)$/i);
  if (yearMatch) {
    const query = withQueryValues(search, { year: yearMatch[1] });
    return { url: `/api/catalogue${query}`, payload: buildCatalogueListing(parseCatalogueQuery(query), undefined, Number(yearMatch[1])) };
  }
  const brandMatch = clean.match(/^([^/]+)(?:\/(\d+))?$/i);
  if (brandMatch && getBrandBySlug(brandMatch[1])) {
    const values: Record<string, string> = { brand: brandMatch[1] };
    if (brandMatch[2]) values.year = brandMatch[2];
    const query = withQueryValues(search, values);
    return { url: `/api/catalogue${query}`, payload: buildCatalogueListing(parseCatalogueQuery(query), brandMatch[1], brandMatch[2] ? Number(brandMatch[2]) : undefined) };
  }
  if (clean === 'feeds') return { url: '/api/feeds/meta', payload: buildFeedsMeta() };
  if (clean === 'about') return { url: '/api/about', payload: buildAboutPayload() };
  if (clean === 'privacy') return { url: '/api/privacy', payload: {} };
  return null;
}

function renderListingContent(pathname: string, payload: unknown): string {
  if (!payload || typeof payload !== 'object' || !('movies' in payload) || !Array.isArray(payload.movies)) return '';
  const data = payload as { movies: Array<{ title: string; year: number; slug: string; tmdbId: number }>; brand?: { name: string }; total?: number };
  const clean = routePath(pathname);
  const title = data.brand?.name || (clean.startsWith('year/') ? `Christmas Movies from ${clean.slice(5)}` : clean === 'movies' || clean === 'all' ? 'All Christmas Movies' : 'Christmas Movies');
  const movies = data.movies.slice(0, 24).map((movie) => `<li><a href="${escapeHtml(getMoviePath(movie.tmdbId, movie.slug))}">${escapeHtml(movie.title)}</a> (${movie.year})</li>`).join('');
  return `<main id="server-rendered-content"><article><h1>${escapeHtml(title)}</h1><p>${data.total || 0} Christmas movies in the catalogue.</p><ul>${movies}</ul></article></main>`;
}

function renderRouteContent(pathname: string, payload: unknown): string {
  const clean = routePath(pathname);
  if (!clean) return '<main id="server-rendered-content"><article><h1>Christmas Movie Database</h1><p>Browse Christmas movies, actors and holiday filmographies from Hallmark, Lifetime and GAF.</p></article></main>';
  if (clean === 'movies' || clean === 'all' || /^year\/\d+$/i.test(clean) || getBrandBySlug(clean.split('/')[0])) return renderListingContent(pathname, payload);
  if (clean === 'feeds') return '<main id="server-rendered-content"><article><h1>Christmas Movie Feeds</h1><p>Use XmasDB Radarr and JSON feeds to browse Christmas movies by network, year and actor.</p><h2>Available feeds</h2><ul><li>All movies</li><li>Hallmark, Lifetime and GAF networks</li><li>Year and actor feeds</li></ul></article></main>';
  if (clean === 'about') return '<main id="server-rendered-content"><article><h1>Why I Built the Christmas Movie Database</h1><p>XmasDB is a curated Christmas movie database covering holiday films, networks and actors.</p></article></main>';
  if (clean === 'privacy') return '<main id="server-rendered-content"><article><h1>Privacy &amp; AI</h1><p>XmasDB explains how this site handles privacy, analytics and AI-assisted catalogue work.</p></article></main>';
  if (clean === 'contact') return '<main id="server-rendered-content"><article><h1>Contact XmasDB</h1><p>Send questions, corrections and Christmas movie catalogue suggestions to XmasDB.</p></article></main>';
  return '';
}

export function renderServerContent(pathname: string): string {
  return renderActorContent(pathname) || renderMovieContent(pathname);
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

export function renderServerHtml(indexHtml: string, pathname: string, search = ''): string {
  const routeBootstrap = getServerRouteBootstrap(pathname, search);
  const content = renderServerContent(pathname) || renderRouteContent(pathname, routeBootstrap?.payload);
  const html = content ? indexHtml.replace('<div id="root"></div>', `<div id="root">${content}</div>`) : indexHtml;
  const bootstrap = routeBootstrap
    ? `<script>window.__XMASDB_ROUTE__=${JSON.stringify(routeBootstrap).replace(/</g, '\\u003c')};</script>`
    : '';
  const withBootstrap = bootstrap ? html.replace('</head>', `    ${bootstrap}\n  </head>`) : html;
  return injectSeoIntoHtml(withBootstrap, getServerSeo(pathname, search));
}
