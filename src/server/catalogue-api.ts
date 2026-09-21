import type { Movie } from '../types';
import {
  MOVIES,
  getMovieBySlug,
  getMovieByTmdbId,
  getMovieByTmdbIdAndSlug,
  getAllYearsForBrand,
} from '../data/movies';
import {
  getAllActors,
  getActorBySlug,
  getActorByTmdbId,
  getPopularActorsByBrand,
  getTmdbPersonIdForSlug,
} from '../data/actors';
import { getBrandBySlug, getPopulatedBrands } from '../data/brands';
import { getCataloguePage, type CatalogueQuery } from '../utils/catalogue-pagination';
import { getMoviePremiereDateKey, isFutureComingSoonMovie, isMoviePremierePast } from '../utils/catalogue-lifecycle';
import { getActorBackdrop } from '../utils/backdrops';
import { buildRadarrFeed } from '../utils/feeds';
import type {
  ActorDetailPayload,
  AboutPayload,
  ActorFilmographyItem,
  CatalogueListing,
  CatalogueMeta,
  FeedsMetaPayload,
  HomePayload,
  ListingMovie,
  MetaBrand,
  MovieDetailPayload,
  PopularActorsGroup,
  SearchIndexPayload,
  SearchMovieEntry,
  SearchPersonEntry,
  SearchResultsPayload,
} from '../api/types';
import { scoreActorSearchResult, scoreMovieSearchFields } from '../utils/search-relevance';

const FAVOURITE_MOVIE_TITLES = [
  'Christmas by Starlight',
  'A Godwink Christmas',
  'Once Upon a Holiday',
  'Coyote Creek Christmas',
  'Christmas at the Plaza',
  'A Timeless Christmas',
] as const;

const FAVOURITE_ACTOR_NAMES = ['Paul Campbell', 'Kimberley Sustad', 'Ryan Paevey'] as const;

/** Converts a canonical movie into the compact listing shape used by cards. */
export function toListingMovie(movie: Movie): ListingMovie {
  return {
    id: movie.id,
    slug: movie.slug,
    title: movie.title,
    year: movie.year,
    brandId: movie.brandId,
    tmdbId: movie.tmdbId,
    posterUrl: movie.posterUrl,
    releaseDate: movie.releaseDate,
    premiereDate: movie.premiereDate,
    status: movie.status,
  };
}

export function buildAboutPayload(): AboutPayload {
  const favouriteMovies = FAVOURITE_MOVIE_TITLES.map((title) => {
    const movie = MOVIES.find((candidate) => candidate.title.toLowerCase() === title.toLowerCase());
    if (!movie) throw new Error(`Favourite movie not found: ${title}`);
    return toListingMovie(movie);
  });
  const favouriteActors = FAVOURITE_ACTOR_NAMES.map((name) => {
    const actor = getAllActors().find((candidate) => candidate.name.toLowerCase() === name.toLowerCase());
    if (!actor) throw new Error(`Favourite actor not found: ${name}`);
    return { name: actor.name, slug: actor.slug, tmdbPersonId: actor.tmdbPersonId };
  });
  return { favouriteMovies, favouriteActors };
}

function toMetaBrand(brandId: string): MetaBrand | null {
  const brand = getPopulatedBrands(MOVIES).find((b) => b.id === brandId);
  if (!brand) return null;
  return {
    ...brand,
    count: MOVIES.filter((movie) => movie.brandId === brand.id).length,
  };
}
// ---------------------------------------------------------------------------
// Metadata (header, footer, stats strip)
// ---------------------------------------------------------------------------

let metaCache: CatalogueMeta | null = null;

export function buildCatalogueMeta(): CatalogueMeta {
  if (!metaCache) {
    metaCache = {
      totalMovies: MOVIES.length,
      populatedBrands: getPopulatedBrands(MOVIES).map((brand) => ({
        ...brand,
        count: MOVIES.filter((movie) => movie.brandId === brand.id).length,
      })),
      years: getAllYearsForBrand(),
      generatedAt: new Date().toISOString(),
    };
  }
  return metaCache;
}

// ---------------------------------------------------------------------------
// Catalogue listings (brand, all movies, year archive)
// ---------------------------------------------------------------------------

export function buildCatalogueListing(
  query: CatalogueQuery,
  brandSlug?: string,
  lockedYear?: number
): CatalogueListing | null {
  let brandId: string | undefined;
  if (brandSlug) {
    const brand = getBrandBySlug(brandSlug);
    const meta = toMetaBrand(brand?.id || '');
    if (!brand || !meta) return null;
    brandId = brand.id;
  }

  const page = getCataloguePage(MOVIES, query, brandId, lockedYear);
  const brand = brandId ? getPopulatedBrands(MOVIES).find((b) => b.id === brandId) : undefined;

  return {
    movies: page.movies.map(toListingMovie),
    total: page.total,
    totalPages: page.totalPages,
    page: page.page,
    perPage: page.perPage,
    years: brandId ? getAllYearsForBrand(brandId) : getAllYearsForBrand(),
    brand,
  };
}

// ---------------------------------------------------------------------------
// Movie detail
// ---------------------------------------------------------------------------

function resolveMovie(identifier: string, slug?: string): Movie | undefined {
  if (slug) {
    const id = Number(identifier);
    if (!Number.isNaN(id)) return getMovieByTmdbIdAndSlug(id, slug);
    return getMovieBySlug(identifier);
  }
  const id = Number(identifier);
  if (!Number.isNaN(id)) {
    const byId = getMovieByTmdbId(id);
    if (byId) return byId;
  }
  return getMovieBySlug(identifier);
}

function castIdentity(member: Movie['cast'][number]): string {
  return member.tmdbPersonId ? `tmdb:${member.tmdbPersonId}` : `slug:${member.slug.toLowerCase()}`;
}

function principalCast(movie: Movie): Set<string> {
  return new Set(
    [...movie.cast]
      .sort((a, b) => (a.order ?? Number.MAX_SAFE_INTEGER) - (b.order ?? Number.MAX_SAFE_INTEGER))
      .slice(0, 12)
      .map(castIdentity),
  );
}

export function selectRelatedMovies(movie: Movie, movies: Movie[] = MOVIES): ListingMovie[] {
  const movieCast = principalCast(movie);
  const candidates = new Map(
    movies
      .filter((candidate) => candidate.brandId === movie.brandId && candidate.id !== movie.id && candidate.slug !== movie.slug)
      .map((candidate) => [candidate.id, candidate]),
  );

  return [...candidates.values()]
    .map((candidate) => {
      const sharedCast = [...principalCast(candidate)].filter((member) => movieCast.has(member)).length;
      return { candidate, sharedCast, yearDistance: Math.abs(candidate.year - movie.year) };
    })
    .sort((a, b) =>
      (b.sharedCast - a.sharedCast)
      || (a.yearDistance - b.yearDistance)
      || (b.candidate.year - a.candidate.year)
      || a.candidate.id.localeCompare(b.candidate.id),
    )
    .slice(0, 4)
    .map(({ candidate }) => toListingMovie(candidate));
}

export function buildMovieDetail(identifier: string, slug?: string): MovieDetailPayload | null {
  const movie = resolveMovie(identifier, slug);
  if (!movie) return null;

  const movieWithResolvedCast = {
    ...movie,
    cast: movie.cast.map((member) => ({
      ...member,
      resolvedProfileUrl: getActorBySlug(member.slug)?.photoUrl,
      resolvedTmdbPersonId: member.tmdbPersonId || getTmdbPersonIdForSlug(member.slug),
    })),
  };

  const related = selectRelatedMovies(movie);

  return { movie: movieWithResolvedCast, related };
}

// ---------------------------------------------------------------------------
// Actor detail
// ---------------------------------------------------------------------------

function resolveActor(identifier: string, slug?: string): ReturnType<typeof getActorBySlug> {
  if (slug) {
    const id = Number(identifier);
    if (!Number.isNaN(id)) {
      const byId = getActorByTmdbId(id);
      if (byId) return byId;
    }
    return getActorBySlug(slug);
  }
  const id = Number(identifier);
  if (!Number.isNaN(id)) {
    const byId = getActorByTmdbId(id);
    if (byId) return byId;
  }
  return getActorBySlug(identifier);
}

export function buildActorDetail(identifier: string, slug?: string): ActorDetailPayload | null {
  const actor = resolveActor(identifier, slug);
  if (!actor) return null;

  const actorSlug = actor.slug.toLowerCase();
  const movies = MOVIES.filter((movie) =>
    movie.cast.some((member) => member.tmdbPersonId === actor.tmdbPersonId)
  );

  const filmography: ActorFilmographyItem[] = movies.map((movie) => ({
    ...toListingMovie(movie),
    backdropUrl: movie.backdropUrl,
    character: movie.cast.find((member) => member.slug.toLowerCase() === actorSlug)?.character,
  }));

  const backdrop = getActorBackdrop(movies, actor.tmdbPersonId);

  return {
    actor,
    filmography,
    backdropUrl: backdrop ? backdrop.url : null,
    titleDisambiguator: getActorTitleDisambiguator(actor),
  };
}

// ---------------------------------------------------------------------------
// Search
// ---------------------------------------------------------------------------

let searchIndexCache: SearchIndexPayload | null = null;

let actorTitleDisambiguators: Map<string, string> | null = null;

function getActorTitleDisambiguator(actor: ReturnType<typeof getActorBySlug>): string | undefined {
  if (!actor) return undefined;
  if (!actorTitleDisambiguators) {
    const nameCounts = new Map<string, number>();
    const actors = getAllActors();
    for (const candidate of actors) {
      const name = candidate.name.trim().toLowerCase();
      nameCounts.set(name, (nameCounts.get(name) || 0) + 1);
    }
    actorTitleDisambiguators = new Map(
      actors
        .filter((candidate) => (nameCounts.get(candidate.name.trim().toLowerCase()) || 0) > 1)
        .map((candidate) => [candidate.slug, String(candidate.tmdbPersonId)])
    );
  }
  return actorTitleDisambiguators.get(actor.slug);
}

function buildActorMovieCounts(): Map<string, number> {
  const map = new Map<string, number>();
  for (const movie of MOVIES) {
    for (const member of movie.cast) {
      const slug = member.slug.toLowerCase().trim();
      map.set(slug, (map.get(slug) || 0) + 1);
    }
  }
  return map;
}

function toPersonEntry(
  actor: ReturnType<typeof getAllActors>[number],
  counts: Map<string, number>
): SearchPersonEntry {
  return {
    name: actor.name,
    slug: actor.slug,
    tmdbPersonId: actor.tmdbPersonId,
    photoUrl: actor.profileUrl || actor.photoUrl,
    movieCount: counts.get(actor.slug.toLowerCase()) || 0,
  };
}

export function buildSearchIndex(): SearchIndexPayload {
  if (!searchIndexCache) {
    const counts = buildActorMovieCounts();
    searchIndexCache = {
      movies: MOVIES.map<SearchMovieEntry>((movie) => ({
        id: movie.id,
        slug: movie.slug,
        tmdbId: movie.tmdbId,
        title: movie.title,
        year: movie.year,
        brandId: movie.brandId,
        posterUrl: movie.posterUrl,
        originalTitle: movie.originalTitle,
        // Join names with a NUL separator so substring matching can never span
        // across two different cast members (preserving per-name matching).
        terms: movie.cast.map((member) => member.name).join('\u0000').toLowerCase(),
      })),
      people: getAllActors().map((actor) => toPersonEntry(actor, counts)),
    };
  }
  return searchIndexCache;
}

export function buildSearchResults(rawQuery: string): SearchResultsPayload {
  const query = rawQuery.trim();
  if (!query) return { movies: [], actors: [] };

  const movies = MOVIES
    .map((movie) => ({
      movie,
      score: scoreMovieSearchFields({
        title: movie.title,
        originalTitle: movie.originalTitle,
        secondaryText: `${movie.synopsis} ${movie.cast.map((member) => member.name).join(' ')}`,
      }, query),
    }))
    .filter((result) => result.score > 0)
    .sort((a, b) => b.score - a.score)
    .map(({ movie }) => toListingMovie(movie));

  const counts = buildActorMovieCounts();
  const actors = getAllActors()
    .map((actor) => toPersonEntry(actor, counts))
    .map((actor) => ({ actor, score: scoreActorSearchResult(actor, query) }))
    .filter((result) => result.score > 0)
    .sort((a, b) => b.score - a.score || b.actor.movieCount - a.actor.movieCount)
    .map(({ actor }) => actor);

  return { movies, actors };
}

// ---------------------------------------------------------------------------
// Homepage
// ---------------------------------------------------------------------------

let homeCache: { dateKey: string; payload: HomePayload } | null = null;

const DISCOVERY_BRAND_IDS = ['hallmark', 'lifetime', 'gaf'] as const;

function getUtcDateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function dailyMovieHash(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function isValidDiscoverMovie(movie: Movie, now: Date, excludedIds: Set<string>): boolean {
  return !excludedIds.has(movie.id)
    && movie.status?.toLowerCase() === 'collection'
    && !isFutureComingSoonMovie(movie, now)
    && isMoviePremierePast(movie, now)
    && typeof movie.id === 'string'
    && typeof movie.slug === 'string'
    && typeof movie.title === 'string'
    && Number.isInteger(movie.year)
    && typeof movie.brandId === 'string'
    && Number.isInteger(movie.tmdbId)
    && typeof movie.posterUrl === 'string'
    && typeof movie.releaseDate === 'string';
}

export function selectDiscoverMovies(
  movies: Movie[],
  now: Date = new Date(),
  excludedIds: Set<string> = new Set(),
): Movie[] {
  const dateKey = getUtcDateKey(now);
  const eligible = movies.filter((movie) => isValidDiscoverMovie(movie, now, excludedIds));
  const sortForDay = (left: Movie, right: Movie) => {
    const leftHash = dailyMovieHash(`${dateKey}:${left.id}`);
    const rightHash = dailyMovieHash(`${dateKey}:${right.id}`);
    return leftHash - rightHash || left.id.localeCompare(right.id);
  };
  const selectedByBrand = new Map<string, Movie[]>();

  for (const brandId of DISCOVERY_BRAND_IDS) {
    selectedByBrand.set(
      brandId,
      eligible.filter((movie) => movie.brandId.toLowerCase() === brandId).sort(sortForDay).slice(0, 2),
    );
  }

  const selected: Movie[] = [];
  const selectedIds = new Set<string>();
  for (let slot = 0; slot < 2; slot += 1) {
    for (const brandId of DISCOVERY_BRAND_IDS) {
      const movie = selectedByBrand.get(brandId)?.[slot];
      if (movie && !selectedIds.has(movie.id)) {
        selected.push(movie);
        selectedIds.add(movie.id);
      }
    }
  }

  if (selected.length < 6) {
    for (const movie of eligible.sort(sortForDay)) {
      if (selected.length >= 6) break;
      if (!selectedIds.has(movie.id)) {
        selected.push(movie);
        selectedIds.add(movie.id);
      }
    }
  }

  return selected.slice(0, 6);
}

export function buildHomePayload(now: Date = new Date()): HomePayload {
  const dateKey = getUtcDateKey(now);
  if (homeCache?.dateKey === dateKey) return homeCache.payload;

  const comingSoon = [...MOVIES]
     .filter((movie) => isFutureComingSoonMovie(movie, now) && getMoviePremiereDateKey(movie) !== null)
    .sort((a, b) => {
      const aDate = getMoviePremiereDateKey(a);
      const bDate = getMoviePremiereDateKey(b);
      if (!aDate && bDate) return 1;
      if (aDate && !bDate) return -1;
      return (aDate || '').localeCompare(bDate || '');
    })
    .slice(0, 6)
    .map(toListingMovie);

  const comingSoonIds = new Set(comingSoon.map((movie) => movie.id));
  const discovery = selectDiscoverMovies(MOVIES, now, comingSoonIds)
    .map(toListingMovie);

  const archiveYears = getAllYearsForBrand()
    .slice(0, 6)
    .map((year) => ({
      year,
      movieCount: MOVIES.filter((movie) => movie.year === year).length,
    }));

  const popularActors: PopularActorsGroup[] = [];
  for (const brand of getPopulatedBrands(MOVIES)) {
    const actors = getPopularActorsByBrand(brand.id, 8).map(({ actor, movieCount }) => ({
      slug: actor.slug,
      name: actor.name,
      tmdbPersonId: actor.tmdbPersonId,
      photoUrl: actor.profileUrl || actor.photoUrl,
      movieCount,
    }));
    if (actors.length > 0) popularActors.push({ brandId: brand.id, actors });
  }

  const payload = {
    totalMovies: MOVIES.length,
    comingSoon,
    discovery,
    popularActors,
    archiveYears,
  };
  homeCache = { dateKey, payload };
  return payload;
}

// ---------------------------------------------------------------------------
// Feeds page metadata
// ---------------------------------------------------------------------------

let feedsMetaCache: FeedsMetaPayload | null = null;

export function buildFeedsMeta(): FeedsMetaPayload {
  if (feedsMetaCache) return feedsMetaCache;

  const populatedBrands = buildCatalogueMeta().populatedBrands;
  const brandCounts: Record<string, number> = {};
  for (const brand of populatedBrands) {
    brandCounts[brand.id] = buildRadarrFeed(
      MOVIES.filter((movie) => movie.brandId === brand.id)
    ).length;
  }

  const years = getAllYearsForBrand();
  const yearCounts: Record<string, number> = {};
  for (const year of years) {
    yearCounts[String(year)] = buildRadarrFeed(MOVIES.filter((movie) => movie.year === year)).length;
  }

  feedsMetaCache = {
    years,
    populatedBrands,
    counts: {
      all: buildRadarrFeed(MOVIES).length,
      brands: brandCounts,
      years: yearCounts,
    },
  };
  return feedsMetaCache;
}
