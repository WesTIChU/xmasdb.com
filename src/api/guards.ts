import type {
  ActorDetailPayload,
  AboutPayload,
  PrivacyPayload,
  CatalogueListing,
  FeedsMetaPayload,
  HomePayload,
  MovieDetailPayload,
  ListingMovie,
} from './types';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isString(value: unknown): value is string {
  return typeof value === 'string';
}

function isListingMovie(value: unknown): value is ListingMovie {
  return isRecord(value)
    && isString(value.id)
    && isString(value.slug)
    && isString(value.title)
    && isNumber(value.year)
    && isString(value.brandId)
    && isNumber(value.tmdbId)
    && isString(value.posterUrl)
    && isString(value.releaseDate);
}

export function isCatalogueListingPayload(value: unknown): value is CatalogueListing {
  return isRecord(value)
    && Array.isArray(value.movies)
    && Array.isArray(value.years)
    && isNumber(value.total)
    && isNumber(value.totalPages)
    && isNumber(value.page)
    && isNumber(value.perPage);
}

export function isHomePayload(value: unknown): value is HomePayload {
  return isRecord(value)
    && isNumber(value.totalMovies)
    && Array.isArray(value.comingSoon)
    && Array.isArray(value.discovery)
    && Array.isArray(value.popularActors)
    && Array.isArray(value.archiveYears)
    && value.popularActors.every((group) => isRecord(group) && Array.isArray(group.actors));
}

export function isAboutPayload(value: unknown): value is AboutPayload {
  if (!isRecord(value) || !Array.isArray(value.favouriteMovies) || !Array.isArray(value.favouriteActors)) return false;
  return value.favouriteMovies.every(isListingMovie)
    && value.favouriteActors.every((actor) => isRecord(actor)
      && isString(actor.name)
      && isString(actor.slug)
      && isNumber(actor.tmdbPersonId));
}

export function isPrivacyPayload(value: unknown): value is PrivacyPayload {
  return isRecord(value);
}

export function isMovieDetailPayload(value: unknown): value is MovieDetailPayload {
  return isRecord(value)
    && isRecord(value.movie)
    && Array.isArray(value.movie.cast)
    && Array.isArray(value.related);
}

export function isActorDetailPayload(value: unknown): value is ActorDetailPayload {
  return isRecord(value)
    && isRecord(value.actor)
    && Array.isArray(value.filmography);
}

export function isFeedsMetaPayload(value: unknown): value is FeedsMetaPayload {
  return isRecord(value)
    && Array.isArray(value.years)
    && Array.isArray(value.populatedBrands)
    && isRecord(value.counts)
    && isNumber(value.counts.all)
    && isRecord(value.counts.brands)
    && isRecord(value.counts.years);
}
