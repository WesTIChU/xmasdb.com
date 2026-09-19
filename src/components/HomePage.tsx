import React from 'react';
import type { HomePayload } from '../api/types';
import { getBrandById } from '../data/brands';
import { getMoviePath, getMoviesPath } from '../utils/urls';
import { MovieCard } from './MovieCard';
import { NavigationLink } from './NavigationLink';
import { PopularActorsSection } from './PopularActorsSection';
import { formatMoviePremiereDate } from '../utils/catalogue-lifecycle';

interface HomePageProps {
  payload: Partial<HomePayload>;
  onNavigate: (path: string) => void;
}

export const HomePage: React.FC<HomePageProps> = ({ payload, onNavigate }) => {
  const comingSoon = Array.isArray(payload?.comingSoon) ? payload.comingSoon : [];
  const discovery = Array.isArray(payload?.discovery) ? payload.discovery : [];
  const popularActors = Array.isArray(payload?.popularActors) ? payload.popularActors : [];
  const totalMovies = typeof payload?.totalMovies === 'number' ? payload.totalMovies : 0;
  return (
    <div className="pt-0 pb-6 sm:pb-8" id="home-view">
      <PopularActorsSection groups={popularActors} onNavigate={onNavigate} />

      <section className="py-7 sm:py-9 border-b border-[#E7DFD5]" aria-labelledby="coming-soon-heading">
        <div className="flex items-end justify-between gap-4 mb-5">
          <div>
            <p className="font-sans-clean text-xs font-semibold uppercase tracking-[0.18em] text-[#841818]">New on the horizon</p>
            <h2 id="coming-soon-heading" className="mt-1 font-heading text-xl sm:text-2xl font-semibold text-[#1A3D2F]">Coming Soon</h2>
          </div>
          <NavigationLink href={getMoviesPath()} onNavigate={onNavigate} className="shrink-0 translate-y-1 text-xs sm:text-sm font-sans-clean font-medium text-[#1A3D2F] hover:text-[#143626]">View all coming soon <span className="xmas-nav-arrow">→</span></NavigationLink>
        </div>
        <div className="flex gap-4 sm:gap-5 overflow-x-auto pb-2 no-scrollbar snap-x snap-mandatory sm:grid sm:grid-cols-3 md:grid-cols-6 sm:overflow-visible">
          {comingSoon.map((movie) => {
            const brand = getBrandById(movie.brandId);
            return <div key={movie.id} className="w-[140px] sm:w-auto shrink-0 snap-start">
              <MovieCard movie={movie} onSelectMovie={(slug, tmdbId) => onNavigate(getMoviePath(tmdbId || movie.tmdbId, slug))} />
              <p className="mt-1 text-center text-[11px] text-[#8C8379] font-body">{formatMoviePremiereDate(movie) || 'Premiere date TBA'} <span className="text-[#C8BFB3]">·</span> {brand?.shortName}</p>
            </div>;
          })}
        </div>
      </section>

      <section className="py-7 sm:py-9 border-b border-[#E7DFD5]" aria-labelledby="discovery-heading">
        <div className="flex items-end justify-between gap-4 mb-5">
          <div>
            <p className="font-sans-clean text-xs font-semibold uppercase tracking-[0.18em] text-[#736B63]">From the archive</p>
            <h2 id="discovery-heading" className="mt-1 font-heading text-xl sm:text-2xl font-semibold text-[#1A3D2F]">Discover Christmas Movies</h2>
          </div>
          <NavigationLink href={getMoviesPath()} onNavigate={onNavigate} className="shrink-0 text-xs sm:text-sm font-sans-clean font-medium text-[#1A3D2F] hover:text-[#143626]">View all {totalMovies} movies <span className="xmas-nav-arrow">→</span></NavigationLink>
        </div>
        <div className="flex gap-4 sm:gap-5 overflow-x-auto pb-2 no-scrollbar snap-x snap-mandatory sm:grid sm:grid-cols-3 md:grid-cols-6 sm:overflow-visible">
          {discovery.map((movie) => <div key={movie.id} className="w-[140px] sm:w-auto shrink-0 snap-start"><MovieCard movie={movie} onSelectMovie={(slug, tmdbId) => onNavigate(getMoviePath(tmdbId || movie.tmdbId, slug))} /></div>)}
        </div>
      </section>

    </div>
  );
};
