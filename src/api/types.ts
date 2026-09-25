import type { Actor, Brand, CastMember, Movie } from '../types';

/**
 * Lightweight movie shape used by catalogue listings, home sections, related
 * grids and actor filmographies. It deliberately omits cast arrays, trailers,
 * crew, release-date tables and synopsis so listing payloads stay small.
 */
export interface ListingMovie {
  id: string;
  slug: string;
  title: string;
  year: number;
  brandId: string;
  tmdbId: number;
  posterUrl: string;
  releaseDate: string;
  premiereDate?: string;
  status?: string;
}

/** A single catalogue/listing response (brand page, all movies, year archive). */
export interface CatalogueListing {
  movies: ListingMovie[];
  total: number;
  totalPages: number;
  page: number;
  perPage: number;
  /** Years available for the active scope (brand years or all catalogue years). */
  years: number[];
  brand?: Brand;
}

/** A populated brand plus its catalogue count. */
export interface MetaBrand extends Brand {
  count: number;
}

/** Global catalogue metadata used by the header, footer and stats strip. */
export interface CatalogueMeta {
  totalMovies: number;
  populatedBrands: MetaBrand[];
  years: number[];
  generatedAt: string;
}

export interface PopularActorEntry {
  slug: string;
  name: string;
  tmdbPersonId: number;
  photoUrl?: string;
  movieCount: number;
}

export interface PopularActorsGroup {
  brandId: string;
  actors: PopularActorEntry[];
}

export interface ArchiveYearEntry {
  year: number;
  movieCount: number;
}

/** Homepage payload: only what the visible sections need. */
export interface HomePayload {
  totalMovies: number;
  comingSoon: ListingMovie[];
  discovery: ListingMovie[];
  popularActors: PopularActorsGroup[];
  archiveYears: ArchiveYearEntry[];
}

export interface AboutActorEntry {
  name: string;
  slug: string;
  tmdbPersonId: number;
}

export interface AboutPayload {
  favouriteMovies: ListingMovie[];
  favouriteActors: AboutActorEntry[];
}

export interface PrivacyPayload {}
export interface ContactPayload {}

export type FeedStatisticsType = 'collection' | 'year' | 'actor' | 'metadata';

export interface FeedStatisticsRow {
  id: string;
  name: string;
  type: FeedStatisticsType;
  totalPulls: number;
  pullsToday: number;
  pullsLast7Days: number;
  pullsLast30Days: number;
  lastPulledAt?: string;
}

export interface FeedStatisticsPayload {
  generatedAt: string;
  summary: {
    totalPulls: number;
    pullsToday: number;
    pullsLast7Days: number;
    pullsLast30Days: number;
  };
  feeds: FeedStatisticsRow[];
}

export interface TmdbRefreshRun {
  id: string;
  type: 'full' | 'coming-soon' | 'manual' | 'import';
  startedAt: string;
  finishedAt?: string;
  durationMs?: number;
  status: 'RUNNING' | 'SUCCESS' | 'PARTIAL' | 'FAILED';
  counters: Record<string, number>;
  freshness?: Record<string, number | string | undefined>;
  legacyActorsBefore?: number;
  legacyActorsProcessed?: number;
  legacyImagesBefore?: number;
  legacyImagesProcessed?: number;
  failures: TmdbRefreshFailure[];
}

export interface TmdbRefreshFailure {
  key: string;
  kind: 'movie' | 'actor' | 'image' | 'system';
  operation: string;
  tmdbId?: number;
  message: string;
  httpStatus?: number;
  timestamp: string;
  recoveredAt?: string;
}

export interface TmdbRefreshHealthPayload {
  current: { status: 'HEALTHY' | 'ATTENTION NEEDED'; reasons: string[]; unresolvedFailures: number; overdueRecords: number };
  schedule: { nextFull: string; nextComingSoon: string };
  lastFull?: TmdbRefreshRun;
  lastComingSoon?: TmdbRefreshRun;
  latestRun?: TmdbRefreshRun;
  movies: { total: number; checked: number; changed: number; unchanged: number; failed: number; fresh: number; stale: number; neverFetched: number; oldestSuccessfulFetch?: string };
  actors: { total: number; fresh: number; stale: number; legacy: number; attempted: number; successful: number; failed: number; skippedFresh: number; oldestSuccessfulFetch?: string; legacyInitially?: number; processedThisRun?: number; remaining: number };
  images: Record<'posters' | 'backdrops' | 'people', { total: number; fresh: number; stale: number; legacy: number; refreshedThisRun: number; failedThisRun: number; oldestSuccessfulFetch?: string }>;
  history: TmdbRefreshRun[];
  unresolvedFailureDetails: TmdbRefreshFailure[];
}

/** Full movie detail plus lightweight related cards from the same brand. */
export interface MovieCrewCredit {
  tmdbPersonId: number;
  name: string;
  slug: string;
  job: string;
  department?: string;
  profileUrl?: string;
}

export type MovieDetailMovie = Omit<Movie, 'cast'> & {
  cast: Array<
    CastMember & {
      resolvedProfileUrl?: string;
      resolvedTmdbPersonId?: number;
    }
  >;
  directorCredit?: MovieCrewCredit;
  writingCredits: MovieCrewCredit[];
};

export interface MovieDetailPayload {
  movie: MovieDetailMovie;
  related: ListingMovie[];
}

export interface ActorFilmographyItem extends ListingMovie {
  backdropUrl?: string;
  character?: string;
  crewJobs?: string[];
}

export interface ActorDetailPayload {
  actor: Actor;
  filmography: ActorFilmographyItem[];
  actingFilmography: ActorFilmographyItem[];
  directingFilmography: ActorFilmographyItem[];
  writingFilmography: ActorFilmographyItem[];
  backdropUrl: string | null;
  /** Present only when multiple catalogue actors share the same display name. */
  titleDisambiguator?: string;
}

/** Compact autocomplete index. No biographies, synopses or structured cast. */
export interface SearchMovieEntry {
  id: string;
  slug: string;
  tmdbId: number;
  title: string;
  year: number;
  brandId: string;
  posterUrl: string;
  originalTitle?: string;
  /** Lowercased searchable text (cast names) used for autocomplete matching. */
  terms: string;
}

export interface SearchPersonEntry {
  name: string;
  slug: string;
  tmdbPersonId: number;
  photoUrl?: string;
  movieCount: number;
}

export interface SearchIndexPayload {
  movies: SearchMovieEntry[];
  people: SearchPersonEntry[];
}

export interface SearchResultsPayload {
  movies: ListingMovie[];
  actors: SearchPersonEntry[];
}

export interface FeedsMetaPayload {
  years: number[];
  populatedBrands: MetaBrand[];
  counts: {
    all: number;
    brands: Record<string, number>;
    years: Record<string, number>;
    actors: Record<string, number>;
  };
}
