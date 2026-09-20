import assert from 'assert';
import { MOVIES } from '../src/data/movies';
import { getActorBackdrop } from '../src/utils/backdrops';
import { getPopulatedBrands } from '../src/data/brands';
import { getRadarrAllFeedJson, getRadarrNetworkFeedJson, getSitemapXml, isMovieEligibleForRadarr } from '../src/utils/feeds';
import { buildCatalogueUrl, getCataloguePage, parseCatalogueQuery } from '../src/utils/catalogue-pagination';
import { buildCatalogueListing, selectDiscoverMovies } from '../src/server/catalogue-api';
import { getMoviePoster } from '../src/utils/posters';

console.log('Running catalogue pagination and local backdrop tests...');

const defaultPage = getCataloguePage(MOVIES, parseCatalogueQuery(''));
assert.strictEqual(defaultPage.perPage, 24);
assert.strictEqual(defaultPage.movies.length, 24);
assert.strictEqual(defaultPage.total, MOVIES.length);

const comingSoonMovie = MOVIES.find((movie) => movie.status === 'coming-soon' && movie.releaseDate) || MOVIES.find((movie) => movie.status === 'coming-soon');
assert.ok(comingSoonMovie, 'canonical catalogue should contain a Coming Soon movie');
const catalogueMovieCount = MOVIES.filter((movie) => movie.status === 'collection' || movie.status === 'coming-soon').length;
assert.strictEqual(defaultPage.total, catalogueMovieCount);
const catalogueOrder = getCataloguePage(MOVIES, parseCatalogueQuery('?perPage=96')).movies;
const firstCollectionIndex = catalogueOrder.findIndex((movie) => movie.status !== 'coming-soon');
assert.ok(firstCollectionIndex > 0);
assert.ok(catalogueOrder.slice(0, firstCollectionIndex).every((movie) => movie.status === 'coming-soon'));
assert.ok(catalogueOrder.slice(firstCollectionIndex).every((movie) => movie.status === 'collection'));
const allSearchPage = getCataloguePage(MOVIES, parseCatalogueQuery(`?search=${encodeURIComponent(comingSoonMovie!.title)}`));
const yearSearchPage = getCataloguePage(MOVIES, parseCatalogueQuery(`?search=${encodeURIComponent(comingSoonMovie!.title)}`), undefined, comingSoonMovie!.year);
assert.ok(allSearchPage.movies.some((movie) => movie.tmdbId === comingSoonMovie!.tmdbId));
assert.ok(yearSearchPage.movies.some((movie) => movie.tmdbId === comingSoonMovie!.tmdbId));
if (comingSoonMovie!.releaseDate) {
  const beforeEligibility = new Date(Date.parse(comingSoonMovie!.releaseDate) - 8 * 24 * 60 * 60 * 1000);
  assert.strictEqual(isMovieEligibleForRadarr(comingSoonMovie!, beforeEligibility), false);
} else {
  assert.strictEqual(isMovieEligibleForRadarr(comingSoonMovie!, new Date()), false);
}

const fortyEight = getCataloguePage(MOVIES, parseCatalogueQuery('?page=2&perPage=48'));
assert.strictEqual(fortyEight.page, 2);
assert.strictEqual(fortyEight.movies.length, 48);

const ninetySix = getCataloguePage(MOVIES, parseCatalogueQuery('?page=999&perPage=96'));
assert.strictEqual(ninetySix.page, ninetySix.totalPages);
assert.ok(ninetySix.movies.length > 0);

const filtered = getCataloguePage(MOVIES, parseCatalogueQuery('?brand=hallmark&year=2025&sort=newest&perPage=24'));
assert.ok(filtered.total < MOVIES.length);
assert.ok(filtered.movies.every((movie) => movie.brandId === 'hallmark' && movie.year === 2025));
assert.strictEqual(buildCatalogueUrl('/movies/', '?brand=hallmark&perPage=48&page=4', { page: 2 }, false), '/movies/?brand=hallmark&perPage=48&page=2');
assert.strictEqual(parseCatalogueQuery('?page=abc&perPage=50000').page, 1);
assert.strictEqual(parseCatalogueQuery('?page=abc&perPage=50000').perPage, 24);

const routeArtworkCases: Array<{ brand: string; title?: string; movie?: typeof MOVIES[number] }> = [
  { brand: 'hallmark', title: 'Double Booked for the Holidays' },
  { brand: 'lifetime', movie: MOVIES.find((movie) => movie.brandId === 'lifetime') },
  { brand: 'gaf', movie: MOVIES.find((movie) => movie.brandId === 'gaf') },
];
for (const routeCase of routeArtworkCases) {
  const movie = routeCase.movie || MOVIES.find((candidate) => candidate.title === routeCase.title);
  assert.ok(movie, `${routeCase.brand} artwork fixture should exist`);
  const search = `?search=${encodeURIComponent(movie!.title)}`;
  const allListing = buildCatalogueListing(parseCatalogueQuery(search), undefined);
  const brandListing = buildCatalogueListing(parseCatalogueQuery(`${search}&brand=${routeCase.brand}`), routeCase.brand);
  const yearListing = buildCatalogueListing(parseCatalogueQuery(search), undefined, movie!.year);
  const allMovie = allListing?.movies.find((candidate) => candidate.tmdbId === movie!.tmdbId);
  const brandMovie = brandListing?.movies.find((candidate) => candidate.tmdbId === movie!.tmdbId);
  const yearMovie = yearListing?.movies.find((candidate) => candidate.tmdbId === movie!.tmdbId);
  assert.ok(allMovie, `${routeCase.brand} movie should be present on /movies/`);
  assert.ok(brandMovie, `${routeCase.brand} movie should be present on /${routeCase.brand}/`);
  assert.ok(yearMovie, `${routeCase.brand} movie should be present in its year archive`);
  assert.strictEqual(brandMovie!.posterUrl, allMovie!.posterUrl, `${routeCase.brand} routes must share canonical artwork`);
  assert.strictEqual(yearMovie!.posterUrl, allMovie!.posterUrl, `${routeCase.brand} year archive must share canonical artwork`);
}

const refreshedArtwork = { ...MOVIES[0], posterUrl: '/images/posters/fixture-a1b2c3d4.jpg' };
assert.strictEqual(getMoviePoster(refreshedArtwork), refreshedArtwork.posterUrl, 'cache-busted local poster paths must be respected');
const comingSoonWithArtwork = { ...MOVIES.find((movie) => movie.status === 'coming-soon')!, posterUrl: '/images/posters/coming-soon-refreshed.jpg' };
const comingSoonWithoutArtwork = { ...comingSoonWithArtwork, posterUrl: '' };
assert.strictEqual(getMoviePoster(comingSoonWithArtwork), comingSoonWithArtwork.posterUrl, 'Coming Soon movies with artwork use the real poster');
assert.strictEqual(getMoviePoster(comingSoonWithoutArtwork), null, 'Coming Soon movies without artwork use the placeholder');

const nikkiMovies = MOVIES.filter((movie) => movie.cast.some((cast) => cast.tmdbPersonId === 59750));
const paulMovies = MOVIES.filter((movie) => movie.cast.some((cast) => cast.tmdbPersonId === 62909));
assert.ok(getActorBackdrop(nikkiMovies, 59750)?.url.startsWith('/images/backdrops/'));
assert.ok(getActorBackdrop(paulMovies, 62909)?.url.startsWith('/images/backdrops/'));
assert.strictEqual(getActorBackdrop([{ ...MOVIES[0], backdropUrl: undefined }], 1), null);

const populatedBrandIds = getPopulatedBrands(MOVIES).map((brand) => brand.id);
assert.ok(populatedBrandIds.includes('hallmark'));
assert.ok(populatedBrandIds.includes('gaf'));
assert.ok(populatedBrandIds.includes('lifetime'));
assert.ok(!populatedBrandIds.includes('uptv'));
assert.ok(getPopulatedBrands([{ brandId: 'lifetime' }]).some((brand) => brand.id === 'lifetime'));
const gafFeed = JSON.parse(getRadarrNetworkFeedJson('gaf')) as Array<{ title: string; imdb_id: string }>;
const hallmarkFeed = JSON.parse(getRadarrNetworkFeedJson('hallmark')) as Array<{ title: string; imdb_id: string }>;
const lifetimeFeed = JSON.parse(getRadarrNetworkFeedJson('lifetime')) as Array<{ title: string; imdb_id: string }>;
assert.ok(gafFeed.length > 0);
assert.ok(gafFeed.every((item) => item.title && item.imdb_id.startsWith('tt')));
assert.ok(hallmarkFeed.length > 0);
assert.ok(lifetimeFeed.length > 0);
assert.ok(JSON.parse(getRadarrAllFeedJson()).length >= gafFeed.length + hallmarkFeed.length);
assert.ok(getSitemapXml().includes('/gaf/'));
assert.ok(getSitemapXml().includes('/lifetime/'));

const discoverDate = new Date('2026-09-20T12:00:00Z');
const discover = selectDiscoverMovies(MOVIES, discoverDate);
assert.ok(discover.length <= 6);
assert.strictEqual(discover.filter((movie) => movie.brandId === 'hallmark').length, 2);
assert.strictEqual(discover.filter((movie) => movie.brandId === 'lifetime').length, 2);
assert.strictEqual(discover.filter((movie) => movie.brandId === 'gaf').length, 2);
assert.strictEqual(new Set(discover.map((movie) => movie.id)).size, discover.length);
assert.ok(discover.every((movie) => movie.status === 'collection'));
assert.strictEqual(
  JSON.stringify(selectDiscoverMovies(MOVIES, discoverDate).map((movie) => movie.id)),
  JSON.stringify(discover.map((movie) => movie.id)),
);
assert.notStrictEqual(
  JSON.stringify(selectDiscoverMovies(MOVIES, new Date('2026-09-21T12:00:00Z')).map((movie) => movie.id)),
  JSON.stringify(discover.map((movie) => movie.id)),
);
assert.deepStrictEqual(
  selectDiscoverMovies([...MOVIES].reverse(), discoverDate).map((movie) => movie.id),
  discover.map((movie) => movie.id),
);
assert.ok(discover.some((movie) => movie.year < 2025));

const oneHallmarkMovie = MOVIES.find((movie) => movie.brandId === 'hallmark' && movie.status === 'collection')!;
const fallbackDiscover = selectDiscoverMovies(
  [oneHallmarkMovie, ...MOVIES.filter((movie) => movie.brandId !== 'hallmark')],
  discoverDate,
);
assert.ok(fallbackDiscover.length <= 6);
assert.strictEqual(fallbackDiscover.filter((movie) => movie.brandId === 'hallmark').length, 1);
assert.strictEqual(new Set(fallbackDiscover.map((movie) => movie.id)).size, fallbackDiscover.length);

const comingSoonFixture = { ...oneHallmarkMovie, id: 'fixture-coming-soon', status: 'coming-soon', premiereDate: '2026-12-01' };
assert.ok(!selectDiscoverMovies([comingSoonFixture, oneHallmarkMovie], discoverDate).some((movie) => movie.id === comingSoonFixture.id));
const futureCollectionFixture = { ...oneHallmarkMovie, id: 'fixture-future-collection', status: 'collection', releaseDate: '2027-01-01', premiereDate: '2027-01-01' };
assert.ok(!selectDiscoverMovies([futureCollectionFixture, oneHallmarkMovie], discoverDate).some((movie) => movie.id === futureCollectionFixture.id));

console.log('Catalogue pagination and local backdrop tests passed.');
