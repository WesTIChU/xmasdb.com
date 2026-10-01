import React from 'react';
import type { ThisMonthPayload } from '../api/types';
import { getMoviesPath, getMoviePath } from '../utils/urls';
import { MovieCard } from './MovieCard';
import { NavigationLink } from './NavigationLink';
import { HollyDivider } from './HollyDivider';

interface ThisMonthSectionProps {
  payload: ThisMonthPayload;
  onNavigate: (path: string) => void;
}

export const ThisMonthSection: React.FC<ThisMonthSectionProps> = ({ payload, onNavigate }) => (
  <section className="py-7 sm:py-9" aria-labelledby="this-month-heading">
    <div className="lg:-mx-8">
      <div className="w-full flex items-end justify-between gap-4 mb-5">
        <div>
          <h2 id="this-month-heading" className="font-heading text-xl sm:text-2xl font-semibold text-[#1A3D2F]">THIS MONTH</h2>
          <p className="mt-1 font-body text-xs text-[#736B63]">Christmas movies that premiered in {payload.monthLabel} through the years</p>
        </div>
        <NavigationLink
          href={`${getMoviesPath()}?releaseMonth=${payload.month}`}
          onNavigate={onNavigate}
          className="ml-auto shrink-0 text-xs sm:text-sm font-sans-clean font-medium text-[#1A3D2F] hover:text-[#143626]"
        >
          View all {payload.monthLabel.toLowerCase()} movies <span className="xmas-nav-arrow">→</span>
        </NavigationLink>
      </div>
    </div>
    <div className="lg:-mx-8">
      <div className="flex gap-4 sm:gap-5 overflow-x-auto pb-2 no-scrollbar snap-x snap-mandatory sm:grid sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-6 sm:overflow-visible">
        {payload.movies.map((movie) => (
          <div key={movie.id} className="w-[140px] sm:w-auto shrink-0 snap-start">
            <MovieCard
              movie={movie}
              optimizeHomepageImage
              titleLines={3}
              onSelectMovie={(slug, tmdbId) => onNavigate(getMoviePath(tmdbId || movie.tmdbId, slug))}
            />
          </div>
        ))}
      </div>
    </div>
    <HollyDivider className="mt-4 -mb-4 sm:mt-5 sm:-mb-5" lineClassName="w-6 sm:w-8" ornamentClassName="h-4 w-12 sm:h-5 sm:w-14" />
  </section>
);
