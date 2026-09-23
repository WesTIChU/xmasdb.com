import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MOVIES } from '../src/data/movies';
import { getActorByTmdbId, getAllActors } from '../src/data/actors';
import { Header } from '../src/components/Header';
import { getFeedsPath, getMoviePath, getActorPath } from '../src/utils/urls';
import { getSitemapXml } from '../src/utils/feeds';
import {
  buildAboutSeo,
  buildContactSeo,
  buildPrivacySeo,
  buildActorSeo,
  buildBrandSeo,
  buildFeedsSeo,
  buildHomeSeo,
  buildMoviesSeo,
  buildMovieSeo,
  buildYearSeo,
} from '../src/utils/seo';
import { getCanonicalRedirect, getRobotsTxt, getServerSeo, injectSeoIntoHtml, renderServerHtml } from '../src/server/seo';
import { getBrandBySlug } from '../src/data/brands';
import { buildActorDetail } from '../src/server/catalogue-api';
import { isCatalogueListingPayload } from '../src/api/guards';
import { parseCatalogueQuery } from '../src/utils/catalogue-pagination';
import { buildCatalogueListing } from '../src/server/catalogue-api';
import { parseRoute } from '../src/App';

const movie = MOVIES[0];
const actor = getAllActors()[0];
const actorDetail = buildActorDetail(String(actor.tmdbPersonId));

const homeSeo = buildHomeSeo(MOVIES.length);
assert.equal(homeSeo.title, 'XmasDB - Christmas Movie Database | Hallmark, Lifetime, GAF & UPtv');
assert.match(homeSeo.description, /Hallmark, Lifetime, GAF, UPtv/);
assert.match(buildMoviesSeo(MOVIES.length).description, new RegExp(String(MOVIES.length)));
assert.match(buildMovieSeo(movie).title, new RegExp(movie.title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
assert.match(buildActorSeo(actor, actorDetail?.filmography || []).title, new RegExp(actor.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
assert.match(buildBrandSeo(getBrandBySlug('hallmark')!, 2025).title, /Hallmark/);
assert.match(buildYearSeo(2025).title, /2025/);
assert.equal(buildFeedsSeo().title, 'Christmas Movie Feeds for Radarr | XmasDB');
assert.match(buildFeedsSeo().description, /Christmas movie JSON feeds for Radarr/);
assert.ok(Array.isArray(buildFeedsSeo().schema));
assert.match(JSON.stringify(buildFeedsSeo().schema), /Does this work with NZBGet or SABnzbd\?/);

// A route starts with an intentionally empty payload while its request is in
// flight. Listing consumers must reject that state rather than reading fields
// from it, while real brand/year responses must satisfy the complete shape.
assert.equal(isCatalogueListingPayload(undefined), false);
assert.equal(isCatalogueListingPayload({ movies: [], years: [] }), false);
for (const brand of ['hallmark', 'lifetime', 'gaf', 'uptv']) {
  assert.equal(isCatalogueListingPayload(buildCatalogueListing(parseCatalogueQuery(''), brand, 2025)), true, `${brand}/2025 listing shape`);
}
assert.match(buildAboutSeo().title, /Why I Built the Christmas Movie Database/);
assert.equal(buildAboutSeo().canonicalPath, '/about/');
assert.match(buildContactSeo().title, /Contact XmasDB/);
assert.equal(buildContactSeo().canonicalPath, '/contact/');
assert.match(buildPrivacySeo().title, /Privacy & AI/);
assert.equal(buildPrivacySeo().canonicalPath, '/privacy/');

const movieSeo = getServerSeo(getMoviePath(movie.tmdbId, movie.slug));
assert.equal(movieSeo.canonicalPath, getMoviePath(movie.tmdbId, movie.slug));
assert.equal(movieSeo.noIndex, undefined);
assert.equal(movieSeo.title, `${movie.title} (${movie.year}) | XmasDB`);
assert.equal(getCanonicalRedirect(`/movie/${movie.tmdbId}/${movie.slug}`), getMoviePath(movie.tmdbId, movie.slug));
assert.equal(getCanonicalRedirect(`/movie/${movie.tmdbId}/wrong-slug/`), getMoviePath(movie.tmdbId, movie.slug));

const actorSeo = getServerSeo(getActorPath(actor.tmdbPersonId, actor.slug));
assert.equal(actorSeo.canonicalPath, getActorPath(actor.tmdbPersonId, actor.slug));
assert.equal(getServerSeo('/movies/', '?page=2').noIndex, true);
assert.equal(getServerSeo('/definitely-not-real/').noIndex, true);
assert.equal(getServerSeo('/about/').canonicalPath, '/about/');
assert.equal(getCanonicalRedirect('/about'), '/about/');
assert.equal(getServerSeo('/privacy/').canonicalPath, '/privacy/');
assert.equal(getCanonicalRedirect('/privacy'), '/privacy/');
assert.equal(getServerSeo('/contact/').canonicalPath, '/contact/');
assert.equal(getCanonicalRedirect('/contact'), '/contact/');
assert.equal(getServerSeo('/year/9999/').noIndex, true);
assert.equal(getServerSeo('/hallmark/9999/').noIndex, true);

for (const path of ['/', '/movies/', '/hallmark/', '/lifetime/', '/gaf/', '/uptv/', '/feeds/', '/about/', '/privacy/', '/contact/']) {
  assert.notEqual(parseRoute(path).type, 'not-found', `${path} should resolve to a known route`);
}
assert.equal(parseRoute('/contact/').type, 'contact');
assert.equal(parseRoute('/contact').type, 'contact');
assert.equal(parseRoute('/admin/login/').type, 'admin-login');
assert.equal(parseRoute('/admin/submissions/').type, 'admin-submissions');
assert.equal(parseRoute('/admin/movies/add/').type, 'admin-add-movies');
assert.equal(parseRoute('/admin/feed-statistics/').type, 'admin-feed-statistics');
assert.equal(parseRoute('/this-page-does-not-exist/').type, 'not-found');
assert.equal(getServerSeo('/admin/login/').noIndex, true);
assert.equal(getCanonicalRedirect('/admin/submissions'), '/admin/submissions/');

const html = injectSeoIntoHtml('<!doctype html><html><head><title>old</title></head><body></body></html>', movieSeo);
assert.match(html, new RegExp(`<title>${movie.title}`));
assert.match(html, /rel="canonical"/);
assert.match(html, /og:title/);
assert.match(html, /application\/ld\+json/);

// Direct HTML responses must contain entity content before React executes.
const danica = getActorByTmdbId(65220)!;
const danicaPath = getActorPath(danica.tmdbPersonId, danica.slug);
const serverShell = '<!doctype html><html><head></head><body><div id="root"></div></body></html>';
const homepageHtml = renderServerHtml(await readFile('index.html', 'utf8'), '/');
assert.match(homepageHtml, /<title>XmasDB - Christmas Movie Database \| Hallmark, Lifetime, GAF &amp; UPtv<\/title>/);
assert.match(homepageHtml, /property="og:title" content="XmasDB - Christmas Movie Database \| Hallmark, Lifetime, GAF &amp; UPtv"/);
assert.match(homepageHtml, /name="twitter:title" content="XmasDB - Christmas Movie Database \| Hallmark, Lifetime, GAF &amp; UPtv"/);
assert.match(homepageHtml, /name="description" content="Browse (?:\d+ )?Christmas movies from Hallmark, Lifetime, GAF, UPtv/);
const actorHtml = renderServerHtml(serverShell, danicaPath);
assert.match(actorHtml, /<h1>Danica McKellar<\/h1>/);
assert.match(actorHtml, /Danica Mae McKellar/);
assert.match(actorHtml, /Christmas movie filmography/);
assert.match(actorHtml, /href="\/movie\/\d+\/[^\"]+"/);
assert.match(actorHtml, /name="robots" content="index,follow"/);
assert.ok(actorHtml.includes(`rel="canonical" href="https://xmasdb.com${danicaPath}"`));
assert.match(actorHtml, /application\/ld\+json/);
assert.match(actorHtml, /__XMASDB_ROUTE__/);
assert.match(actorHtml, /\/api\/actor\/65220\/danica-mckellar/);
assert.doesNotMatch(actorHtml, /Actor not found|Loading\.\.\.|No actor found/);

const moviePath = getMoviePath(movie.tmdbId, movie.slug);
const movieHtml = renderServerHtml(serverShell, moviePath);
assert.ok(movieHtml.includes(`<h1>${movie.title}</h1>`));
assert.match(movieHtml, /<h2>Cast<\/h2>/);
assert.equal((movieHtml.match(/<h1\b/g) || []).length, 1);
assert.match(movieHtml, /name="robots" content="index,follow"/);
assert.ok(movieHtml.includes(`rel="canonical" href="https://xmasdb.com${moviePath}"`));
assert.match(movieHtml, /__XMASDB_ROUTE__/);
assert.match(movieHtml, /\/api\/movie\/\d+\/[^"<]+/);

const htmlServer = createServer((request, response) => {
  const pathname = new URL(request.url || '/', 'http://localhost').pathname;
  response.statusCode = pathname === danicaPath || pathname === moviePath ? 200 : 404;
  response.setHeader('Content-Type', 'text/html; charset=utf-8');
  response.end(response.statusCode === 200 ? renderServerHtml(serverShell, pathname) : 'Not found');
});
await new Promise<void>((resolve) => htmlServer.listen(0, '127.0.0.1', resolve));
const address = htmlServer.address();
assert.ok(address && typeof address === 'object');
const baseUrl = `http://127.0.0.1:${address.port}`;
try {
  for (const [path, expectedText] of [[danicaPath, 'Danica McKellar'], [moviePath, movie.title]] as const) {
    const response = await fetch(`${baseUrl}${path}`);
    const body = await response.text();
    assert.equal(response.status, 200, `${path} should be indexable over HTTP`);
    assert.match(body, new RegExp(`<h1>${expectedText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}<\\/h1>`));
  }
} finally {
  await new Promise<void>((resolve, reject) => htmlServer.close((error) => error ? reject(error) : resolve()));
}

const headerProps = {
  currentPath: '/',
  onNavigate: () => {},
  searchQuery: '',
  onSearchChange: () => {},
  populatedBrands: [],
};
const homeHeader = renderToStaticMarkup(React.createElement(Header, headerProps));
const innerHeader = renderToStaticMarkup(React.createElement(Header, { ...headerProps, currentPath: moviePath }));
assert.equal((homeHeader.match(/<h1\b/g) || []).length, 1, 'homepage branding should provide its single H1');
assert.equal((innerHeader.match(/<h1\b/g) || []).length, 0, 'inner-page branding must not create a second H1');

const representativeSeoPaths = [
  '/',
  moviePath,
  danicaPath,
  '/hallmark/',
  '/year/2025/',
  '/movies/',
  '/feeds/',
  '/about/',
  '/contact/',
  '/privacy/',
];
for (const path of representativeSeoPaths) {
  const pageHtml = renderServerHtml(serverShell, path);
  assert.equal((pageHtml.match(/<h1\b/g) || []).length, 1, `${path} should server-render exactly one H1`);
}

const sitemap = getSitemapXml();
const sitemapPaths = [...sitemap.matchAll(/<loc>https:\/\/xmasdb\.com([^<]+)<\/loc>/g)].map((match) => match[1]);
assert.equal(new Set(sitemapPaths).size, sitemapPaths.length, 'sitemap must not contain duplicate URLs');
assert.ok(sitemapPaths.every((path) => !/[?&]/.test(path)), 'sitemap must contain canonical paths without query strings');
assert.equal(sitemapPaths.filter((path) => path.startsWith('/movie/')).length, MOVIES.length);
assert.equal(sitemapPaths.filter((path) => path.startsWith('/actor/')).length, getAllActors().length);
assert.ok(sitemapPaths.every((path) => {
  const seo = getServerSeo(path);
  const html = renderServerHtml(serverShell, path);
  const expectedRobots = seo.noIndex ? 'noindex,follow' : 'index,follow';
  return html.includes(`<title>${seo.title.replace(/&/g, '&amp;')}</title>`)
    && html.includes(`name="description"`)
    && html.includes(`rel="canonical" href="https://xmasdb.com${seo.canonicalPath}"`)
    && html.includes(`name="robots" content="${expectedRobots}"`)
    && /<h1>/.test(html)
    && !html.includes('Something went wrong loading this page.')
    && !html.includes('Loading...');
}), 'every sitemap URL must have complete server metadata and visible content');
const sitemapTitles = sitemapPaths.map((path) => getServerSeo(path).title);
assert.equal(new Set(sitemapTitles).size, sitemapTitles.length, 'every indexable URL must have a unique title');
assert.match(sitemap, new RegExp(`https://xmasdb\\.com${getMoviePath(movie.tmdbId, movie.slug)}`));
assert.match(sitemap, new RegExp(`https://xmasdb\\.com${getActorPath(actor.tmdbPersonId, actor.slug)}`));
assert.match(sitemap, /https:\/\/xmasdb\.com\/hallmark\//);
assert.match(sitemap, /https:\/\/xmasdb\.com\/year\/2025\//);
assert.match(sitemap, new RegExp(`https://xmasdb\\.com${getFeedsPath()}`));
assert.match(sitemap, /https:\/\/xmasdb\.com\/about\//);
assert.match(sitemap, /https:\/\/xmasdb\.com\/privacy\//);
assert.match(sitemap, /https:\/\/xmasdb\.com\/contact\//);
assert.doesNotMatch(sitemap, /\/admin\//);
assert.doesNotMatch(sitemap, /\/json\//);
assert.doesNotMatch(sitemap, /[?&](page|search|sort|perPage)=/);
assert.match(sitemap, /<loc>https:\/\/xmasdb\.com\//);

assert.match(getRobotsTxt(), /Sitemap: https:\/\/xmasdb\.com\/sitemap\.xml/);
assert.match(getRobotsTxt(), /Allow: \/\n/);

console.log('SEO metadata, canonical routing, sitemap, robots, and server head tests passed.');
