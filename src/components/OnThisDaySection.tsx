import React, { useState } from 'react';
import type { ListingMovie, OnThisDayPayload } from '../api/types';
import { getMoviePath } from '../utils/urls';
import { getBrandById } from '../data/brands';
import { getMoviePoster } from '../utils/posters';
import { ComingSoonPoster } from './ComingSoonPoster';
import { HollyDivider } from './HollyDivider';

interface OnThisDaySectionProps {
  payload: OnThisDayPayload;
  onNavigate: (path: string) => void;
}

const CompactMovie: React.FC<{ movie: ListingMovie; onNavigate: (path: string) => void }> = ({ movie, onNavigate }) => {
  const [hasImageError, setHasImageError] = useState(false);
  const poster = getMoviePoster(movie);
  const brand = getBrandById(movie.brandId);
  const path = getMoviePath(movie.tmdbId, movie.slug);
  return (
    <a
      href={path}
      onClick={(event) => { event.preventDefault(); onNavigate(path); }}
      className="group flex min-w-[210px] items-center gap-3 rounded-md border border-[#E0D7CC] bg-[#FFFDF9] p-2 transition-colors hover:border-[#B8860B]/60 hover:bg-[#FAF7F2] sm:min-w-0 sm:flex-1"
    >
      <div className="h-[72px] w-12 shrink-0 overflow-hidden rounded border border-[#E0D7CC] bg-[#EBE4DA]">
        {!poster || hasImageError ? (
          <ComingSoonPoster year={movie.year} networkName={brand?.shortName} />
        ) : (
          <img
            src={poster}
            alt={`Poster for ${movie.title}`}
            loading="lazy"
            width="500"
            height="750"
            referrerPolicy="no-referrer"
            className="h-full w-full object-cover"
            onError={() => setHasImageError(true)}
          />
        )}
      </div>
      <span className="min-w-0">
        <span className="block line-clamp-2 font-heading text-sm font-semibold leading-snug text-[#1A3D2F] group-hover:text-[#841818]">{movie.title}</span>
        <span className="mt-1 block font-body text-xs text-[#736B63]">{movie.year}</span>
      </span>
    </a>
  );
};

export const OnThisDaySection: React.FC<OnThisDaySectionProps> = ({ payload, onNavigate }) => (
  <section className="py-5 sm:py-6" aria-labelledby="on-this-day-heading">
    <div className="mb-3 flex items-end justify-between gap-4">
      <div>
        <h2 id="on-this-day-heading" className="font-heading text-xl sm:text-2xl font-semibold text-[#1A3D2F]">ON THIS DAY</h2>
        <p className="mt-1 font-body text-xs text-[#736B63]">Christmas movies that premiered on {payload.dateLabel} through the years</p>
      </div>
    </div>
    <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar sm:overflow-visible sm:gap-3">
      {payload.movies.map((movie) => <CompactMovie key={movie.id} movie={movie} onNavigate={onNavigate} />)}
    </div>
    <HollyDivider className="mt-4 -mb-4 sm:mt-5 sm:-mb-5" lineClassName="w-6 sm:w-8" ornamentClassName="h-4 w-12 sm:h-5 sm:w-14" />
  </section>
);
