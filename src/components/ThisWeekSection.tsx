import React, { useState } from 'react';
import type { ListingMovie, ThisWeekPayload } from '../api/types';
import { getMoviePath } from '../utils/urls';
import { getBrandById } from '../data/brands';
import { getMoviePoster } from '../utils/posters';
import { ComingSoonPoster } from './ComingSoonPoster';
import { NavigationLink } from './NavigationLink';

interface ThisWeekSectionProps {
  payload: ThisWeekPayload;
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

export const ThisWeekSection: React.FC<ThisWeekSectionProps> = ({ payload, onNavigate }) => (
  <section className="border-b border-[#E7DFD5] py-5 sm:py-6" aria-labelledby="this-week-heading">
    <div className="mb-3 flex items-end justify-between gap-4">
      <div>
        <h2 id="this-week-heading" className="font-heading text-xl sm:text-2xl font-semibold text-[#1A3D2F]">THIS WEEK</h2>
        <p className="mt-1 font-body text-xs text-[#736B63]">{payload.weekLabel} · Christmas movies that premiered this week in years gone by</p>
      </div>
      {payload.total > payload.movies.length && (
        <NavigationLink href={payload.path} onNavigate={onNavigate} className="shrink-0 text-xs font-sans-clean font-medium text-[#1A3D2F] hover:text-[#143626]">View all this week <span className="xmas-nav-arrow">→</span></NavigationLink>
      )}
    </div>
    <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar sm:overflow-visible sm:gap-3">
      {payload.movies.map((movie) => <CompactMovie key={movie.id} movie={movie} onNavigate={onNavigate} />)}
    </div>
  </section>
);
