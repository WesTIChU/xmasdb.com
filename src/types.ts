export interface Brand {
  id: string;
  name: string;
  shortName: string;
  slug: string;
  description: string;
  accentColor: string;
}

export interface CastMember {
  actorId: string;
  name: string;
  character: string;
  slug: string;
  tmdbPersonId?: number;
  profileUrl?: string; // TMDB profile_path
  order?: number;
  birthday?: string;
  deathday?: string;
}

export interface Trailer {
  id?: string;
  key: string; // YouTube video ID from TMDB
  name: string;
  site?: string;
  type?: string; // 'Trailer' | 'Teaser' | 'Clip'
  official?: boolean;
}

export interface Genre {
  id: number;
  name: string;
}

export type MovieKeyword =
  | {
      id: number;
      name: string;
    }
  | {
      name: string;
      evidence: string;
    };

export interface CrewMember {
  id: number;
  name: string;
  job: string;
  department?: string;
  profileUrl?: string;
  creditId?: string;
}

export interface ReleaseDateInfo {
  country: string;
  releaseDate: string;
  type?: number;
  certification?: string;
  note?: string;
}

export interface MovieCertification {
  value: string;
  country: string;
  source: 'tmdb';
  lastConfirmedAt: string;
}

export interface AlternativeTitle {
  title: string;
  country: string;
}

export interface Movie {
  id: string;
  slug: string;
  title: string;
  year: number;
  brandId: string;
  releaseDate: string;
  runtimeMinutes?: number;
  synopsis: string;
  posterUrl: string;
  backdropUrl?: string;
  cast: CastMember[];
  director?: string;
  tmdbId: number;
  imdbId?: string;
  isComingSoon?: boolean;
  trailerYoutubeKey?: string;
  trailers?: Trailer[];
  links?: {
    tmdb?: string;
    imdb?: string;
    justWatch?: string;
  };
  originalTitle?: string;
  alternativeTitles?: AlternativeTitle[];
  tagline?: string | null;
  premiereDate?: string;
  /** XmasDB-managed network premiere override; never sourced from TMDB. */
  networkPremiereDate?: string;
  genres?: Genre[];
  /** TMDB keywords and additive Jev synopsis concepts; separate from Christmas Ingredients. */
  keywords?: MovieKeyword[];
  releaseDates?: ReleaseDateInfo[];
  /** The last non-empty TMDB certification selected for the catalogue's release context. */
  certification?: MovieCertification;
  crew?: CrewMember[];
  voteAverage?: number;
  voteCount?: number;
  status?: string;
  fingerprints?: string[];
  tmdbUpdatedAt?: string;
  tmdbFetchedAt?: string;
}

export interface Actor {
  id: string;
  slug: string;
  name: string;
  tmdbPersonId: number;
  photoUrl?: string;
  profileUrl?: string;
  birthday?: string;
  deathday?: string;
  placeOfBirth?: string;
  biography?: string;
  imdbPersonId?: string;
  gender?: string;
  knownForDepartment?: string;
  knownCredits?: number;
  alsoKnownAs?: string[];
  instagramId?: string;
  twitterId?: string;
  facebookId?: string;
  notableRoles?: string;
  tmdbUpdatedAt?: string;
  tmdbFetchedAt?: string;
}
