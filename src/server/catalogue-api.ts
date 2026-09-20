import type { Movie } from '../types';
import {
  MOVIES,
  getMovieBySlug,
  getMovieByTmdbId,
  getMovieByTmdbIdAndSlug,
  getMoviesByBrand,
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
import { getMoviePremiereDateKey, isFutureComingSoonMovie } from '../utils/catalogue-lifecycle';
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

  const related = getMoviesByBrand(movie.brandId)
    .filter((candidate) => candidate.id !== movie.id && candidate.slug !== movie.slug)
    .slice(0, 4)
    .map(toListingMovie);

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

  return { actor, filmography, backdropUrl: backdrop ? backdrop.url : null };
}

// ---------------------------------------------------------------------------
// Search
// ---------------------------------------------------------------------------

let searchIndexCache: SearchIndexPayload | null = null;

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
  const query = rawQuery.trim().toLowerCase();
  if (!query) return { movies: [], actors: [] };

  const movies = MOVIES.filter(
    (movie) =>
      movie.title.toLowerCase().includes(query) ||
      movie.synopsis.toLowerCase().includes(query) ||
      movie.cast.some((member) => member.name.toLowerCase().includes(query))
  ).map(toListingMovie);

  const counts = buildActorMovieCounts();
  const actors = getAllActors()
    .filter((actor) => actor.name.toLowerCase().includes(query))
    .map((actor) => toPersonEntry(actor, counts));

  return { movies, actors };
}

// ---------------------------------------------------------------------------
// Homepage
// ---------------------------------------------------------------------------

let homeCache: HomePayload | null = null;

export function buildHomePayload(): HomePayload {
  if (homeCache) return homeCache;

  const comingSoon = [...MOVIES]
    .filter((movie) => isFutureComingSoonMovie(movie) && getMoviePremiereDateKey(movie) !== null)
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
  const discovery = MOVIES.filter((movie) => !comingSoonIds.has(movie.id))
    .slice(0, 6)
    .map(toListingMovie);

  const popularActors: PopularActorsGroup[] = [];
  for (const brand of getPopulatedBrands(MOVIES)) {
    const actors = getPopularActorsByBrand(brand.id, 6).map(({ actor, movieCount }) => ({
      slug: actor.slug,
      name: actor.name,
      tmdbPersonId: actor.tmdbPersonId,
      photoUrl: actor.profileUrl || actor.photoUrl,
      movieCount,
    }));
    if (actors.length > 0) popularActors.push({ brandId: brand.id, actors });
  }

  homeCache = {
    totalMovies: MOVIES.length,
    comingSoon,
    discovery,
    popularActors,
  };
  return homeCache;
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
