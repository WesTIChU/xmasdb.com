import React, { useState } from 'react';
import { Movie } from '../types';
import { ComingSoonPoster } from './ComingSoonPoster';
import { getBrandById } from '../data/brands';
import { getMoviePath } from '../utils/urls';
import { getMoviePoster } from '../utils/posters';

interface MovieCardProps {
  movie: Movie;
  onSelectMovie: (slug: string, tmdbId?: number) => void;
}

export const MovieCard: React.FC<MovieCardProps> = ({ movie, onSelectMovie }) => {
  const [hasImageError, setHasImageError] = useState(false);
  const brand = getBrandById(movie.brandId);
  const canonicalPath = getMoviePath(movie.tmdbId, movie.slug);
  const poster = getMoviePoster(movie);

  const showComingSoon = hasImageError || !poster;

  return (
    <article id={`movie-card-${movie.slug}`}>
      <a
        href={canonicalPath}
        onClick={(e) => {
          e.preventDefault();
          onSelectMovie(movie.slug, movie.tmdbId);
        }}
        className="group flex flex-col transition-all duration-200 block text-inherit no-underline"
      >
        {/* Poster container with proper 2:3 movie-poster proportions - main visual focus */}
        <div className="relative aspect-2/3 w-full overflow-hidden rounded-md bg-[#EBE4DA] shadow-xs group-hover:shadow-md transition-shadow border border-[#E0D7CC] group-hover:border-[#B8860B]/50">
          {showComingSoon ? (
            <ComingSoonPoster
              title={movie.title}
              year={movie.year}
              networkName={brand ? brand.name : undefined}
            />
          ) : (
            <img
              src={poster}
              alt={`Poster for ${movie.title}`}
              loading="lazy"
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
            className="font-heading text-base sm:text-lg font-semibold text-[#1A3D2F] group-hover:text-[#841818] transition-colors leading-snug line-clamp-2"
            title={movie.title}
          >
            {movie.title}
          </h3>
          <p className="text-xs sm:text-sm text-[#736B63] mt-0.5 font-body">
            {movie.year}
            {brand && (
              <span className="text-[#A3998D] text-xs font-sans-clean ml-1.5">
                · {brand.shortName}
              </span>
            )}
          </p>
        </div>
      </a>
    </article>
  );
};
