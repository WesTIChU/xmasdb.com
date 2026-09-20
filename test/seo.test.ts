import assert from 'node:assert/strict';
import { MOVIES } from '../src/data/movies';
import { getAllActors } from '../src/data/actors';
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
import { getCanonicalRedirect, getRobotsTxt, getServerSeo, injectSeoIntoHtml } from '../src/server/seo';
import { getBrandBySlug } from '../src/data/brands';
import { buildActorDetail } from '../src/server/catalogue-api';
import { isCatalogueListingPayload } from '../src/api/guards';
import { parseCatalogueQuery } from '../src/utils/catalogue-pagination';
import { buildCatalogueListing } from '../src/server/catalogue-api';
import { parseRoute } from '../src/App';

const movie = MOVIES[0];
const actor = getAllActors()[0];
const actorDetail = buildActorDetail(String(actor.tmdbPersonId));

assert.match(buildHomeSeo(MOVIES.length).title, /XmasDB/);
assert.match(buildMoviesSeo(MOVIES.length).description, new RegExp(String(MOVIES.length)));
assert.match(buildMovieSeo(movie).title, new RegExp(movie.title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
assert.match(buildActorSeo(actor, actorDetail?.filmography || []).title, new RegExp(actor.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
assert.match(buildBrandSeo(getBrandBySlug('hallmark')!, 2025).title, /Hallmark/);
assert.match(buildYearSeo(2025).title, /2025/);
assert.match(buildFeedsSeo().title, /StevenLu/);

// A route starts with an intentionally empty payload while its request is in
// flight. Listing consumers must reject that state rather than reading fields
// from it, while real brand/year responses must satisfy the complete shape.
assert.equal(isCatalogueListingPayload(undefined), false);
assert.equal(isCatalogueListingPayload({ movies: [], years: [] }), false);
for (const brand of ['hallmark', 'lifetime', 'gaf']) {
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

for (const path of ['/', '/movies/', '/hallmark/', '/lifetime/', '/gaf/', '/feeds/', '/about/', '/privacy/', '/contact/']) {
  assert.notEqual(parseRoute(path).type, 'not-found', `${path} should resolve to a known route`);
}
assert.equal(parseRoute('/contact/').type, 'contact');
assert.equal(parseRoute('/contact').type, 'contact');
assert.equal(parseRoute('/admin/login/').type, 'admin-login');
assert.equal(parseRoute('/admin/submissions/').type, 'admin-submissions');
assert.equal(parseRoute('/admin/movies/add/').type, 'admin-add-movies');
assert.equal(parseRoute('/this-page-does-not-exist/').type, 'not-found');
assert.equal(getServerSeo('/admin/login/').noIndex, true);
assert.equal(getCanonicalRedirect('/admin/submissions'), '/admin/submissions/');

const html = injectSeoIntoHtml('<!doctype html><html><head><title>old</title></head><body></body></html>', movieSeo);
assert.match(html, new RegExp(`<title>${movie.title}`));
assert.match(html, /rel="canonical"/);
assert.match(html, /og:title/);
assert.match(html, /application\/ld\+json/);

const sitemap = getSitemapXml();
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
