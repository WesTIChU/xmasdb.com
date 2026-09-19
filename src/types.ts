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

export interface CrewMember {
  id: number;
  name: string;
  job: string;
  creditId?: string;
}

export interface ReleaseDateInfo {
  country: string;
  releaseDate: string;
  type?: number;
  certification?: string;
  note?: string;
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
  tagline?: string | null;
  premiereDate?: string;
  genres?: Genre[];
  releaseDates?: ReleaseDateInfo[];
  crew?: CrewMember[];
  voteAverage?: number;
  voteCount?: number;
  status?: string;
  tmdbUpdatedAt?: string;
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
}
