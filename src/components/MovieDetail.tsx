import React, { useState } from 'react';
import { ExternalLink, Calendar, Clock, Tv, Film, Play, Star, Clapperboard } from 'lucide-react';
import type { ListingMovie, MovieDetailMovie } from '../api/types';
import { Trailer } from '../types';
import { getBrandById } from '../data/brands';
import { getNetworkPath, getMoviesPath, getActorPath, getMoviePath } from '../utils/urls';
import { ComingSoonPoster } from './ComingSoonPoster';
import { formatMoviePremiereDate } from '../utils/catalogue-lifecycle';
import { MovieCard } from './MovieCard';
import { NavigationLink } from './NavigationLink';
import { BackNavigation } from './BackNavigation';
import { getMoviePoster } from '../utils/posters';

interface MovieDetailProps {
  movie: MovieDetailMovie;
  related: ListingMovie[];
  onNavigate: (path: string) => void;
}

export const MovieDetail: React.FC<MovieDetailProps> = ({ movie, related, onNavigate }) => {
  const brand = getBrandById(movie.brandId);
  const [isCastExpanded, setIsCastExpanded] = useState(false);

  // Collect available trailers
  const trailers: Trailer[] = React.useMemo(() => {
    if (movie.trailers && movie.trailers.length > 0) {
      return movie.trailers;
    }
    if (movie.trailerYoutubeKey) {
      return [
        {
          id: 'primary',
          key: movie.trailerYoutubeKey,
          name: 'Official Trailer',
          site: 'YouTube',
          type: 'Trailer',
        },
      ];
    }
    return [];
  }, [movie]);

  const [activeTrailerIndex, setActiveTrailerIndex] = useState<number>(0);
  const [hasImageError, setHasImageError] = useState(false);
  const activeTrailer = trailers[activeTrailerIndex] || trailers[0];
  const poster = getMoviePoster(movie);
  const hasValidImdbId = typeof movie.imdbId === 'string' && /^tt\d+$/.test(movie.imdbId);
  const hasValidTmdbId = typeof movie.tmdbId === 'number' && movie.tmdbId > 0;

  const showComingSoon = hasImageError || !poster;
  const visibleCast = isCastExpanded ? movie.cast : movie.cast.slice(0, 12);
  const hasAdditionalCast = movie.cast.length > 12;

  return (
    <div id="movie-detail-view" className="py-6 sm:py-10 max-w-4xl mx-auto">
      {/* Back navigation - festive XmasDB signature */}
      <div className="mb-6">
        <BackNavigation href={brand ? getNetworkPath(brand.slug) : getMoviesPath()} id="back-to-brand-btn" label={`Back to ${brand ? brand.name : 'All Movies'}`} title={`Back to ${brand ? brand.name : 'All Movies'}`} onNavigate={onNavigate} />
      </div>

      {/* Backdrop (if present) as a tasteful header - reduced height by ~25% (h-36 sm:h-52 instead of h-48 sm:h-72) */}
      {movie.backdropUrl && (
        <div className="relative w-full h-36 sm:h-52 rounded-lg overflow-hidden mb-8 border border-[#E7DFD5] shadow-xs bg-[#EBE4DA]">
          <img
            src={movie.backdropUrl}
            alt={`${movie.title} scene`}
            width={1280}
            height={360}
            referrerPolicy="no-referrer"
            className="w-full h-full object-cover object-center"
            onError={(e) => {
              // Hide backdrop quietly if missing
              e.currentTarget.style.display = 'none';
            }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#FAF7F2] via-transparent to-black/20" />
        </div>
      )}

      {/* Main Content Layout */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* Left column: Poster & metadata sidebar */}
        <div className="md:col-span-1">
          <div className="aspect-2/3 w-full max-w-xs mx-auto rounded-md overflow-hidden bg-[#EBE4DA] shadow-md border border-[#E4DDD3]">
            {showComingSoon ? (
              <ComingSoonPoster
                year={movie.year}
                networkName={brand ? brand.shortName : undefined}
              />
            ) : (
              <img
                src={poster}
                alt={movie.title}
                width={500}
                height={750}
                referrerPolicy="no-referrer"
                fetchPriority="high"
                className="w-full h-full object-cover"
                onError={() => {
                  setHasImageError(true);
                }}
              />
            )}
          </div>

          {(hasValidImdbId || hasValidTmdbId) && (
            <div id="movie-external-links" className="mt-3 w-full max-w-xs mx-auto flex items-center gap-2">
              {hasValidImdbId && (
                <a
                  href={`https://www.imdb.com/title/${movie.imdbId}/`}
                  target="_blank"
                  rel="noopener noreferrer"
                  id="movie-imdb-link"
                  className="flex-1 justify-center py-1.5 px-2.5 rounded bg-[#FAF7F2] hover:bg-[#EFE8DD] border border-[#DDD4C6] hover:border-[#1A3D2F] text-[#1A3D2F] text-xs font-sans-clean font-medium inline-flex items-center gap-1.5 transition-colors shadow-2xs group"
                  title={`View ${movie.title} on IMDb`}
                >
                  <span>IMDb</span><ExternalLink className="w-3 h-3 text-[#1A3D2F] group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                </a>
              )}
              {hasValidTmdbId && (
                <a
                  href={`https://www.themoviedb.org/movie/${movie.tmdbId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  id="movie-tmdb-link"
                  className="flex-1 justify-center py-1.5 px-2.5 rounded bg-[#FAF7F2] hover:bg-[#EFE8DD] border border-[#DDD4C6] hover:border-[#1A3D2F] text-[#1A3D2F] text-xs font-sans-clean font-medium inline-flex items-center gap-1.5 transition-colors shadow-2xs group"
                  title={`View ${movie.title} on TMDb`}
                >
                  <span>TMDb</span><ExternalLink className="w-3 h-3 text-[#1A3D2F] group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                </a>
              )}
            </div>
          )}

          {/* Quick metadata sidebar */}
          <div className="mt-6 text-sm text-[#59524A] space-y-2.5 font-sans-clean border-t border-[#E7DFD5] pt-4">
            {brand && (
              <div className="flex items-center justify-between">
                <span className="text-[#6F675E] flex items-center gap-1.5">
                  <Tv className="w-3.5 h-3.5" /> Network
                </span>
                <NavigationLink href={`/${brand.slug}`} onNavigate={onNavigate} className="font-medium text-[#1A3D2F] hover:text-[#143626] cursor-pointer">
                  {brand.shortName}
                </NavigationLink>
              </div>
            )}

            <div className="flex items-center justify-between">
              <span className="text-[#6F675E] flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5" /> Release Date
              </span>
               <span className="font-medium text-[#23211E]">{formatMoviePremiereDate(movie) || 'Premiere date TBA'}</span>
            </div>

            {movie.runtimeMinutes && (
              <div className="flex items-center justify-between">
                <span className="text-[#6F675E] flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5" /> Runtime
                </span>
                <span className="font-medium text-[#23211E]">{movie.runtimeMinutes} min</span>
              </div>
            )}

            {typeof movie.voteAverage === 'number' && movie.voteAverage > 0 && (
              <div className="flex items-center justify-between">
                <span className="text-[#6F675E] flex items-center gap-1.5">
                  <Star className="w-3.5 h-3.5" /> Rating
                </span>
                <span className="font-medium text-[#23211E] px-1.5 py-0.5 rounded bg-[#EFE9DF] text-xs">
                  ★ {movie.voteAverage.toFixed(1)}
                </span>
              </div>
            )}

            {(movie.director || movie.directorCredit) && (
              <div className="flex items-center justify-between">
                <span className="text-[#6F675E] flex items-center gap-1.5">
                  <Clapperboard className="w-3.5 h-3.5" /> Director
                </span>
                {movie.directorCredit ? (
                  <a
                    href={getActorPath(movie.directorCredit.tmdbPersonId, movie.directorCredit.slug)}
                    onClick={(event) => {
                      event.preventDefault();
                      onNavigate(getActorPath(movie.directorCredit!.tmdbPersonId, movie.directorCredit!.slug));
                    }}
                    className="font-medium text-[#23211E] hover:text-[#841818] hover:underline"
                  >
                    {movie.directorCredit.name}
                  </a>
                ) : <span className="font-medium text-[#23211E]">{movie.director}</span>}
              </div>
            )}

            {movie.writingCredits.length > 0 && (
              <div className="flex items-start justify-between gap-4">
                <span className="text-[#6F675E] flex items-center gap-1.5 shrink-0">
                  <Clapperboard className="w-3.5 h-3.5" /> Writers
                </span>
                <span className="font-medium text-[#23211E] text-right">
                  {movie.writingCredits.map((writer, index) => (
                    <React.Fragment key={`${writer.tmdbPersonId}-${writer.job}`}>
                      {index > 0 && <span className="text-[#A3998D]"> · </span>}
                      <a
                        href={getActorPath(writer.tmdbPersonId, writer.slug)}
                        onClick={(event) => {
                          event.preventDefault();
                          onNavigate(getActorPath(writer.tmdbPersonId, writer.slug));
                        }}
                        className="hover:text-[#841818] hover:underline"
                      >
                        {writer.name}
                      </a>
                    </React.Fragment>
                  ))}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Right column: Title, Synopsis, Cast, Trailers, External Links */}
        <div className="md:col-span-2 text-left space-y-8">
          <div className="border-b border-[#E7DFD5] pb-4">
            {/* Small understated brand label above movie title */}
            {brand && (
              <span
                id="movie-brand-label"
                className="block text-xs font-sans-clean font-semibold uppercase tracking-widest text-[#841818] mb-1.5"
              >
                {brand.shortName}
              </span>
            )}
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-heading font-semibold text-[#1A3D2F] tracking-tight">
              {movie.title}
            </h1>
            <p className="text-lg text-[#841818] font-body mt-1">
              {movie.year}
            </p>
          </div>

          {/* Synopsis */}
          <section aria-labelledby="synopsis-heading">
            <h3 id="synopsis-heading" className="text-base font-heading font-semibold text-[#1A3D2F] mb-2">
              Synopsis
            </h3>
            <p className="text-[#3A332B] font-body text-base leading-relaxed">
              {movie.synopsis}
            </p>
          </section>

          {/* Starring Cast with Editorial Profile Photos */}
          <section aria-labelledby="cast-heading">
            <div className="flex items-center justify-between mb-4">
              <h3 id="cast-heading" className="text-base font-heading font-semibold text-[#1A3D2F]">
                Starring Cast
              </h3>
              <span className="text-xs text-[#6F675E] font-sans-clean">
                {movie.cast.length} {movie.cast.length === 1 ? 'member' : 'members'}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4" id="movie-cast-list">
              {visibleCast.map((member) => {
                const actorTmdbId = member.resolvedTmdbPersonId ?? member.tmdbPersonId ?? 0;
                const actorPath = getActorPath(actorTmdbId, member.slug);
                const photoSrc = member.resolvedProfileUrl || member.profileUrl;

                return (
                  <div
                    key={member.actorId}
                    className="flex items-center gap-3.5 group"
                  >
                    {/* Slightly larger editorial portrait */}
                    <a
                      href={actorPath}
                      onClick={(e) => {
                        e.preventDefault();
                        onNavigate(actorPath);
                      }}
                      className="w-14 h-14 sm:w-15 sm:h-15 rounded-lg overflow-hidden bg-[#ECE4D8] shrink-0 border border-[#E0D7CC] group-hover:border-[#841818]/60 transition-colors flex items-center justify-center focus:outline-none"
                    >
                      {photoSrc ? (
                        <img
                          src={photoSrc}
                          alt={member.name}
                          width={500}
                          height={750}
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                          onError={(e) => {
                            e.currentTarget.style.display = 'none';
                            const fallback = e.currentTarget.nextElementSibling;
                            if (fallback) {
                              (fallback as HTMLElement).style.display = 'flex';
                            }
                          }}
                        />
                      ) : null}
                      <div
                        style={{ display: photoSrc ? 'none' : 'flex' }}
                        className="w-full h-full items-center justify-center bg-[#ECE4D8] text-[#1A3D2F] font-heading font-semibold text-lg select-none"
                        aria-hidden="true"
                      >
                        {member.name.charAt(0)}
                      </div>
                    </a>

                    {/* Prominent actor name with character underneath in muted text */}
                    <div className="flex-1 min-w-0">
                      <a
                        href={actorPath}
                        onClick={(e) => {
                          e.preventDefault();
                          onNavigate(actorPath);
                        }}
                        className="text-left block font-heading font-medium text-[#1A3D2F] group-hover:text-[#841818] transition-colors truncate text-sm sm:text-base leading-snug"
                      >
                        {member.name}
                      </a>
                      <span className="block text-xs text-[#736B63] font-body mt-0.5 truncate">
                        as {member.character}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
            {hasAdditionalCast && (
              <button
                type="button"
                aria-expanded={isCastExpanded}
                aria-controls="movie-cast-list"
                onClick={() => setIsCastExpanded((expanded) => !expanded)}
                className="mt-4 text-xs sm:text-sm font-sans-clean font-medium text-[#1A3D2F] hover:text-[#143626]"
              >
                {isCastExpanded ? 'Show fewer ↑' : `View all ${movie.cast.length} cast members ↓`}
              </button>
            )}
          </section>

          {/* Trailers & Previews Section */}
          <section aria-labelledby="trailers-heading" className="border-t border-[#E7DFD5] pt-6">
            <div className="flex items-center justify-between mb-3">
              <h3 id="trailers-heading" className="text-base font-heading font-semibold text-[#1A3D2F] flex items-center gap-2">
                <Film className="w-4 h-4 text-[#841818]" />
                <span>Trailer & Video Previews</span>
              </h3>
              {activeTrailer && (
                <a
                  href={`https://www.youtube.com/watch?v=${activeTrailer.key}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-[#59524A] hover:text-[#841818] font-sans-clean inline-flex items-center gap-1"
                >
                  <span>Watch on YouTube</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </div>

            {trailers.length > 0 ? (
              <div className="space-y-3" id="movie-trailer-player">
                {/* Multi-trailer tabs if more than one exists */}
                {trailers.length > 1 && (
                  <div className="flex flex-wrap gap-2 pb-1">
                    {trailers.map((t, idx) => (
                      <button
                        key={t.id || t.key}
                        type="button"
                        onClick={() => setActiveTrailerIndex(idx)}
                        className={`cursor-pointer px-3 py-1 text-xs font-sans-clean rounded-full transition-colors flex items-center gap-1.5 ${
                          activeTrailerIndex === idx
                            ? 'bg-[#1A3D2F] text-[#FAF7F2] font-medium'
                            : 'bg-[#EFE9DF] text-[#59524A] hover:bg-[#E5DDCF]'
                        }`}
                      >
                        <Play className="w-2.5 h-2.5" />
                        <span>{t.name}</span>
                      </button>
                    ))}
                  </div>
                )}

                {/* Embedded Responsive YouTube Player */}
                <div className="relative aspect-video w-full rounded-lg overflow-hidden bg-black border border-[#DCD3C7] shadow-xs">
                  <iframe
                    key={activeTrailer.key}
                    src={`https://www.youtube-nocookie.com/embed/${activeTrailer.key}?rel=0`}
                    title={`${movie.title} - ${activeTrailer.name}`}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                    className="absolute inset-0 w-full h-full"
                  />
                </div>
              </div>
            ) : (
              <div className="py-2 text-sm font-body text-[#736B63] flex flex-wrap items-center gap-x-2 gap-y-1">
                <span>Official trailer has not yet been catalogued for this title.</span>
                <a
                  href={`https://www.youtube.com/results?search_query=${encodeURIComponent(
                    `${movie.title} ${movie.year} trailer`
                  )}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs font-sans-clean text-[#841818] hover:text-[#5E1010] hover:underline"
                >
                  <span>Search YouTube</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            )}
          </section>

        </div>
      </div>

      {/* MORE FROM {BRAND} Section */}
      {brand && related.length > 0 && (
        <section
          id="related-brand-movies-section"
          aria-labelledby="related-brand-movies-heading"
          className="mt-12 sm:mt-16 pt-8 sm:pt-10 border-t border-[#E7DFD5]"
        >
          <div className="flex items-center justify-between mb-6">
            <h3
              id="related-brand-movies-heading"
              className="text-base sm:text-lg md:text-xl font-heading font-semibold uppercase tracking-wider text-[#1A3D2F]"
            >
              More from {brand.shortName}
            </h3>
            <NavigationLink href={getNetworkPath(brand.slug)} onNavigate={onNavigate} className="text-xs sm:text-sm font-sans-clean font-medium hover:text-[#143626] transition-colors">View all <span className="xmas-nav-arrow">→</span></NavigationLink>
          </div>

          <div
            id="related-brand-movies-grid"
            className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6"
          >
            {related.map((relMovie) => (
              <MovieCard
                key={relMovie.id}
                movie={relMovie}
                onSelectMovie={(slug, tmdbId) => {
                  onNavigate(getMoviePath(tmdbId || relMovie.tmdbId, slug));
                }}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
};
