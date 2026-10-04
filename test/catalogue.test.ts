import assert from 'assert';
import { MOVIES } from '../src/data/movies';
import { getActorBackdrop } from '../src/utils/backdrops';
import { getPopulatedBrands } from '../src/data/brands';
import { getRadarrAllFeedJson, getRadarrNetworkFeedJson, getSitemapXml, isMovieEligibleForRadarr } from '../src/utils/feeds';
import { buildCatalogueUrl, getCataloguePage, parseCatalogueQuery } from '../src/utils/catalogue-pagination';
import { buildCatalogueListing, selectDiscoverMovies, selectThisMonthMovies, selectRelatedMovies } from '../src/server/catalogue-api';
import { getMoviePoster } from '../src/utils/posters';
import { getMoviePremiereDateKey } from '../src/utils/catalogue-lifecycle';

console.log('Running catalogue pagination and local backdrop tests...');

const defaultPage = getCataloguePage(MOVIES, parseCatalogueQuery(''));
assert.strictEqual(defaultPage.perPage, 24);
assert.strictEqual(defaultPage.movies.length, 24);
assert.strictEqual(defaultPage.total, MOVIES.length);

const comingSoonMovie = MOVIES.find((movie) => movie.status === 'coming-soon' && movie.releaseDate) || MOVIES.find((movie) => movie.status === 'coming-soon');
assert.ok(comingSoonMovie, 'canonical catalogue should contain a Coming Soon movie');
const catalogueMovieCount = MOVIES.filter((movie) => movie.status === 'collection' || movie.status === 'coming-soon').length;
assert.strictEqual(defaultPage.total, catalogueMovieCount);

const singItForChristmas = MOVIES.find((movie) => movie.tmdbId === 1547926);
assert.ok(singItForChristmas, 'TMDB 1547926 should remain in the catalogue');
const originalTitleSearchFixture = { ...singItForChristmas, originalTitle: 'Oy to the World' };
assert.ok(getCataloguePage([originalTitleSearchFixture], parseCatalogueQuery('?search=Oy%20to%20the%20World')).movies.some((movie) => movie.tmdbId === 1547926), 'catalogue search should match a movie original title');

const muchAdo = MOVIES.find((movie) => movie.tmdbId === 878410);
assert.ok(muchAdo, 'TMDB 878410 should remain the canonical movie record');
const alternativeTitleSearchFixture = { ...muchAdo, alternativeTitles: [{ title: 'A Hot Cocoa Christmas', country: 'US' }] };
assert.ok(getCataloguePage([alternativeTitleSearchFixture], parseCatalogueQuery('?search=A%20Hot%20Cocoa%20Christmas')).movies.some((movie) => movie.tmdbId === 878410), 'catalogue search should match an alternative title');

const letItSnow = MOVIES.find((movie) => movie.id === 'gaf-2024-let-it-snow');
assert.ok(letItSnow, 'Let It Snow remains in the catalogue with its existing ID');
assert.equal(letItSnow?.brandId, 'hallmark', 'Let It Snow is classified under Hallmark');
assert.equal(letItSnow?.tmdbId, 240906, 'Let It Snow keeps its TMDb identity');
assert.equal(letItSnow?.releaseDate, '2013-11-30', 'Let It Snow keeps the original TMDb release date');
assert.equal(letItSnow?.premiereDate, '2013-11-30', 'Let It Snow keeps the original premiere date');
assert.ok(buildCatalogueListing(parseCatalogueQuery(''), 'hallmark', 2013)?.movies.some((movie) => movie.id === 'gaf-2024-let-it-snow'), 'Let It Snow appears under Hallmark 2013');
assert.ok(!buildCatalogueListing(parseCatalogueQuery(''), 'gaf', 2013)?.movies.some((movie) => movie.id === 'gaf-2024-let-it-snow'), 'Let It Snow no longer appears under GAF 2013');

const hotChocolateHoliday = MOVIES.find((movie) => movie.tmdbId === 777405);
assert.ok(hotChocolateHoliday, 'Hot Chocolate Holiday remains in the catalogue');
assert.equal(hotChocolateHoliday?.id, 'gaf-2021-hot-chocolate-holiday', 'Hot Chocolate Holiday keeps its existing movie ID');
assert.equal(hotChocolateHoliday?.brandId, 'lifetime', 'Hot Chocolate Holiday is classified under Lifetime');
assert.equal(MOVIES.filter((movie) => movie.tmdbId === 777405).length, 1, 'Hot Chocolate Holiday has no duplicate movie');
assert.ok(!buildCatalogueListing(parseCatalogueQuery(''), 'gaf', 2021)?.movies.some((movie) => movie.tmdbId === 777405), 'Hot Chocolate Holiday disappears from GAF 2021');
assert.ok(buildCatalogueListing(parseCatalogueQuery(''), 'lifetime', 2021)?.movies.some((movie) => movie.tmdbId === 777405), 'Hot Chocolate Holiday appears under Lifetime 2021');

const thisMonthBase = { ...MOVIES[0], status: 'collection' as const, premiereDate: undefined, releaseDate: '2020-11-25' };
const thisMonthMovie = (id: string, releaseDate: string, status: 'collection' | 'coming-soon' = 'collection', title = id) => ({ ...thisMonthBase, id, title, releaseDate, status });
const emptyThisMonth = selectThisMonthMovies([thisMonthMovie('other-month', '2020-12-25')], new Date('2026-11-25T12:00:00Z'));
assert.equal(emptyThisMonth, null, 'empty months render nothing');
const thisMonthMatches = selectThisMonthMovies([
  thisMonthMovie('month-2016', '2016-11-01', 'collection', 'Older'),
  thisMonthMovie('month-2019', '2019-11-30', 'collection', 'Nineteen'),
  thisMonthMovie('month-2022-b', '2022-11-25', 'collection', 'Beta'),
  thisMonthMovie('month-2022-a', '2022-11-25', 'collection', 'Alpha'),
  thisMonthMovie('month-2023', '2023-11-25', 'collection', 'Newest'),
  thisMonthMovie('different-month', '2023-12-25'),
  thisMonthMovie('future', '2026-11-26'),
  thisMonthMovie('invalid', 'not-a-date'),
  thisMonthMovie('coming-soon', '2023-11-25', 'coming-soon'),
], new Date('2026-11-25T12:00:00Z'));
assert.equal(thisMonthMatches?.total, 5);
assert.deepEqual(new Set(thisMonthMatches?.movies.map((movie) => movie.title)), new Set(['Newest', 'Alpha', 'Beta', 'Nineteen', 'Older']));
assert.equal(thisMonthMatches?.movies.length, 5);
const yearDiversityMovies = [
  thisMonthMovie('diverse-a', '2018-11-01', 'collection', 'A'),
  thisMonthMovie('diverse-b', '2019-11-02', 'collection', 'B'),
  thisMonthMovie('diverse-c', '2020-11-03', 'collection', 'C'),
  thisMonthMovie('diverse-d', '2021-11-04', 'collection', 'D'),
  thisMonthMovie('diverse-e', '2022-11-05', 'collection', 'E'),
  thisMonthMovie('diverse-f', '2023-11-06', 'collection', 'F'),
  thisMonthMovie('diverse-g', '2024-11-07', 'collection', 'G'),
  thisMonthMovie('diverse-future', '2026-11-26', 'collection', 'Future'),
];
const diverseMatches = selectThisMonthMovies(yearDiversityMovies, new Date('2026-11-25T12:00:00Z'))!;
const sameDayMatches = selectThisMonthMovies(yearDiversityMovies, new Date('2026-11-25T12:00:00Z'))!;
assert.deepEqual(diverseMatches.movies.map((movie) => movie.id), sameDayMatches.movies.map((movie) => movie.id), 'same day must produce the same selection');
assert.equal(new Set(diverseMatches.movies.map((movie) => (movie.premiereDate || movie.releaseDate).slice(0, 4))).size, 6, 'selection should prefer distinct release years');
assert.ok(!diverseMatches.movies.some((movie) => movie.title === 'Future'), 'future movies must be excluded');
const tomorrowMatches = selectThisMonthMovies(yearDiversityMovies, new Date('2026-11-26T12:00:00Z'))!;
assert.notDeepEqual(diverseMatches.movies.map((movie) => movie.id), tomorrowMatches.movies.map((movie) => movie.id), 'daily rotation should naturally change the selection');
const octoberThisMonth = selectThisMonthMovies(MOVIES, new Date('2026-10-31T12:00:00Z'));
const octoberCanonicalMovies = MOVIES.filter((movie) => {
  const dateKey = getMoviePremiereDateKey(movie);
  return movie.status === 'collection' && dateKey?.slice(5, 7) === '10' && dateKey <= '2026-10-31';
});
assert.equal(octoberThisMonth?.total, octoberCanonicalMovies.length, 'October should use canonical premiere/release dates across prior years');
const bebeWinansMovie = MOVIES.find((movie) => movie.id === 'lifetime-2024-bebe-winans-we-three-kings');
assert.equal(bebeWinansMovie?.releaseDate, '2024-10-30', 'BeBe Winans’ We Three Kings keeps its canonical October release date');
assert.ok(octoberCanonicalMovies.some((movie) => movie.id === bebeWinansMovie?.id), 'canonical October results include BeBe Winans’ We Three Kings');
assert.equal(octoberThisMonth?.movies.length, 6, 'This Month should show up to six genuine October matches');
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

const allCatalogueScopes = ['gaf', 'hallmark', 'lifetime', 'uptv'];
for (const brand of allCatalogueScopes) {
  const all = getCataloguePage(MOVIES, parseCatalogueQuery('?sort=newest&perPage=96'), brand);
  const year = getCataloguePage(MOVIES, parseCatalogueQuery('?sort=newest&perPage=96'), brand, 2026);
  const allIds = new Set(all.movies.map((movie) => movie.tmdbId));
  assert.ok(year.movies.every((movie) => allIds.has(movie.tmdbId)), `${brand} year movies must be present in its All dataset`);
  const futureDates = all.movies
    .filter((movie) => movie.year === 2026)
    .map((movie) => movie.premiereDate || movie.releaseDate);
  assert.ok(futureDates.every((date, index) => index === 0 || date <= futureDates[index - 1]), `${brand} All results sort 2026 movies by release/premiere date`);
}

const allMovies = getCataloguePage(MOVIES, parseCatalogueQuery('?sort=newest&perPage=96'));
const allMovieDates = allMovies.movies.map((movie) => movie.premiereDate || movie.releaseDate);
assert.ok(allMovieDates.every((date, index) => index === 0 || date <= allMovieDates[index - 1]), 'All Movies sorts newest results before pagination');
assert.strictEqual(buildCatalogueUrl('/movies/', '?brand=hallmark&perPage=48&page=4', { page: 2 }, false), '/movies/?brand=hallmark&perPage=48&page=2');
assert.strictEqual(parseCatalogueQuery('?page=abc&perPage=50000').page, 1);
assert.strictEqual(parseCatalogueQuery('?page=abc&perPage=50000').perPage, 24);

const routeArtworkCases: Array<{ brand: string; title?: string; movie?: typeof MOVIES[number] }> = [
  { brand: 'hallmark', movie: MOVIES.find((movie) => movie.tmdbId === 1773329) },
  { brand: 'lifetime', movie: MOVIES.find((movie) => movie.brandId === 'lifetime') },
  { brand: 'gaf', movie: MOVIES.find((movie) => movie.brandId === 'gaf') },
  { brand: 'uptv', movie: MOVIES.find((movie) => movie.tmdbId === 488262) },
];
for (const routeCase of routeArtworkCases) {
  const movie = routeCase.movie;
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
assert.ok(populatedBrandIds.includes('uptv'));
assert.ok(getPopulatedBrands([{ brandId: 'lifetime' }]).some((brand) => brand.id === 'lifetime'));
const gafFeed = JSON.parse(getRadarrNetworkFeedJson('gaf')) as Array<{ title: string; imdb_id: string }>;
const hallmarkFeed = JSON.parse(getRadarrNetworkFeedJson('hallmark')) as Array<{ title: string; imdb_id: string }>;
const lifetimeFeed = JSON.parse(getRadarrNetworkFeedJson('lifetime')) as Array<{ title: string; imdb_id: string }>;
const uptvFeed = JSON.parse(getRadarrNetworkFeedJson('uptv')) as Array<{ title: string; imdb_id: string }>;
assert.ok(gafFeed.length > 0);
assert.ok(gafFeed.every((item) => item.title && item.imdb_id.startsWith('tt')));
assert.ok(hallmarkFeed.length > 0);
assert.ok(lifetimeFeed.length > 0);
assert.ok(uptvFeed.length > 0);
assert.ok(uptvFeed.every((item) => item.imdb_id.startsWith('tt')));
assert.strictEqual(new Set(uptvFeed.map((item) => item.imdb_id)).size, uptvFeed.length);
assert.ok(
  uptvFeed.every((item) =>
    MOVIES.some(
      (movie) =>
        movie.brandId === 'uptv' &&
        movie.imdbId === item.imdb_id &&
        `${movie.title} (${movie.year})` === item.title,
    ),
  ),
);
assert.ok(JSON.parse(getRadarrAllFeedJson()).length >= gafFeed.length + hallmarkFeed.length);
assert.ok(getSitemapXml().includes('/gaf/'));
assert.ok(getSitemapXml().includes('/lifetime/'));
assert.ok(getSitemapXml().includes('/uptv/'));
assert.ok(getSitemapXml().includes('/uptv/2017/'));

const discoverDate = new Date('2026-09-20T12:00:00Z');
const discover = selectDiscoverMovies(MOVIES, discoverDate);
assert.ok(discover.length <= 6);
assert.strictEqual(discover.filter((movie) => movie.brandId === 'hallmark').length, 2);
assert.strictEqual(discover.filter((movie) => movie.brandId === 'lifetime').length, 2);
assert.ok(discover.some((movie) => movie.brandId === 'gaf'));
assert.ok(discover.filter((movie) => movie.brandId === 'gaf').length <= 2);
assert.ok(discover.some((movie) => movie.brandId === 'uptv'), 'UPtv movies should participate in discovery');
assert.ok(discover.filter((movie) => movie.brandId === 'uptv').length <= 2);
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

const sisterSwap = MOVIES.find((movie) => movie.tmdbId === 866665);
assert.ok(sisterSwap, 'Sister Swap fixture should exist');
assert.ok(sisterSwap!.cast.length > 12, 'Sister Swap should exercise the large cast behaviour');
const sisterRecommendations = selectRelatedMovies(sisterSwap!, MOVIES, () => 0);
const alternateSisterRecommendations = selectRelatedMovies(sisterSwap!, MOVIES, () => 0.999999);
assert.equal(sisterRecommendations.length, 4);
assert.ok(sisterRecommendations.every((movie) => movie.brandId === sisterSwap!.brandId));
assert.ok(!sisterRecommendations.some((movie) => movie.id === sisterSwap!.id));
assert.equal(new Set(sisterRecommendations.map((movie) => movie.id)).size, sisterRecommendations.length);
assert.ok(!sisterRecommendations.some((movie) => movie.title === sisterSwap!.title));
assert.notDeepStrictEqual(
  sisterRecommendations.map((movie) => movie.id),
  alternateSisterRecommendations.map((movie) => movie.id),
  'related selections should vary with the random source',
);

console.log('Catalogue pagination and local backdrop tests passed.');
