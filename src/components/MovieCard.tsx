import React, { useState } from 'react';
import type { ListingMovie } from '../api/types';
import { ComingSoonPoster } from './ComingSoonPoster';
import { getBrandById } from '../data/brands';
import { getMoviePath } from '../utils/urls';
import { getMoviePoster } from '../utils/posters';
import { getHomepagePosterSrcSet } from '../utils/homepage-images';

interface MovieCardProps {
  movie: ListingMovie;
  onSelectMovie: (slug: string, tmdbId?: number) => void;
  /** Eagerly loads this card's poster at high priority (use for above-the-fold cards). */
  priority?: boolean;
  /** Allows contextual rows to provide their own metadata beneath the title. */
  metadata?: React.ReactNode;
  /** Hides the default year and brand metadata when a row supplies none. */
  showYearBrandMetadata?: boolean;
  /** Uses derivatives generated for the homepage's current image set. */
  optimizeHomepageImage?: boolean;
}

export const MovieCard: React.FC<MovieCardProps> = ({ movie, onSelectMovie, priority = false, metadata, showYearBrandMetadata = true, optimizeHomepageImage = false }) => {
  const [hasImageError, setHasImageError] = useState(false);
  const brand = getBrandById(movie.brandId);
  const canonicalPath = getMoviePath(movie.tmdbId, movie.slug);
  const poster = getMoviePoster(movie);

  const showComingSoon = hasImageError || !poster;

  return (
    <article id={`movie-card-${movie.slug}`} className="min-w-0">
      <a
        href={canonicalPath}
        onClick={(e) => {
          e.preventDefault();
          onSelectMovie(movie.slug, movie.tmdbId);
        }}
        className="group flex min-w-0 flex-col transition-all duration-200 block text-inherit no-underline"
      >
        {/* Poster container with proper 2:3 movie-poster proportions - main visual focus */}
        <div className="relative aspect-2/3 w-full overflow-hidden rounded-md bg-[#EBE4DA] shadow-xs group-hover:shadow-md transition-shadow border border-[#E0D7CC] group-hover:border-[#B8860B]/50">
          {showComingSoon ? (
            <ComingSoonPoster
              year={movie.year}
              networkName={brand ? brand.shortName : undefined}
            />
          ) : (
            <img
              src={poster}
              srcSet={optimizeHomepageImage ? getHomepagePosterSrcSet(poster) : undefined}
              sizes={optimizeHomepageImage ? '(min-width: 1024px) 143px, (min-width: 640px) 30vw, 140px' : undefined}
              alt={`Poster for ${movie.title}`}
              loading={priority ? 'eager' : 'lazy'}
              fetchPriority={priority ? 'high' : undefined}
              decoding="async"
              width={500}
              height={750}
              referrerPolicy="no-referrer"
              className="h-full w-full object-cover object-center group-hover:scale-101 transition-transform duration-300"
              onError={() => {
                setHasImageError(true);
              }}
            />
          )}

          {/* Subtle festive network badge on top-left of poster */}
          {brand && !showComingSoon && (
            <div className="absolute top-2 left-2 z-10">
              <span className="px-2 py-0.5 rounded text-[10px] font-sans-clean font-semibold uppercase tracking-wider bg-black/60 backdrop-blur-xs text-[#FAF7F2] border border-white/20">
                {brand.shortName}
              </span>
            </div>
          )}
        </div>

        {/* Movie Title & Year directly beneath poster */}
        <div className="pt-2.5 pb-1 text-center">
          <h3
            className="min-h-[2.75rem] min-w-0 overflow-hidden px-1 font-heading text-base sm:text-base lg:text-lg font-semibold text-[#1A3D2F] group-hover:text-[#841818] transition-colors leading-snug line-clamp-2 break-words text-pretty"
            title={movie.title}
          >
            {movie.title}
          </h3>
          {(metadata !== undefined || showYearBrandMetadata) && (
            <p className="text-xs sm:text-sm text-[#736B63] mt-0.5 font-body">
              {metadata !== undefined ? metadata : movie.year}
              {metadata === undefined && brand && (
                <span className="text-[#756B60] text-xs font-sans-clean ml-1.5">· {brand.shortName}</span>
              )}
            </p>
          )}
        </div>
      </a>
    </article>
  );
};
