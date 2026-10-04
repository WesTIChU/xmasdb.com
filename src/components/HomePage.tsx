import React from 'react';
import type { HomePayload } from '../api/types';
import { getCalendarPath, getMoviePath, getMoviesPath } from '../utils/urls';
import { MovieCard } from './MovieCard';
import { NavigationLink } from './NavigationLink';
import { PopularActorsSection } from './PopularActorsSection';
import { formatMoviePremiereDate } from '../utils/catalogue-lifecycle';
import { getYearPath } from '../utils/urls';
import { ThisMonthSection } from './ThisMonthSection';
import { HollyDivider } from './HollyDivider';
import { BirthdaySection } from './BirthdaySection';
import { CalendarDays } from 'lucide-react';

interface HomePageProps {
  payload: Partial<HomePayload>;
  onNavigate: (path: string) => void;
}

const homepageMovieGridOuterClass = 'lg:-mx-8';
const homepageMovieGridClass = 'flex gap-4 sm:gap-5 overflow-x-auto pb-2 no-scrollbar snap-x snap-mandatory sm:grid sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-6 sm:overflow-visible';

export const HomePage: React.FC<HomePageProps> = ({ payload, onNavigate }) => {
  const comingSoon = Array.isArray(payload?.comingSoon) ? payload.comingSoon : [];
  const discovery = Array.isArray(payload?.discovery) ? payload.discovery : [];
  const thisMonth = payload?.thisMonth || null;
  const popularActors = Array.isArray(payload?.popularActors) ? payload.popularActors : [];
  const totalMovies = typeof payload?.totalMovies === 'number' ? payload.totalMovies : 0;
  const archiveYears = Array.isArray(payload?.archiveYears) ? payload.archiveYears : [];
  const birthdays = Array.isArray(payload?.birthdays) ? payload.birthdays : [];
  return (
    <div className="pt-0 pb-6 sm:pb-8" id="home-view">
      <PopularActorsSection groups={popularActors} onNavigate={onNavigate} />

      <section className="py-7 sm:py-9" aria-labelledby="coming-soon-heading">
        <div className={homepageMovieGridOuterClass}>
          <div className="w-full flex flex-wrap items-end justify-between gap-x-5 gap-y-2 mb-5">
            <div>
              <h2 id="coming-soon-heading" className="font-heading text-xl sm:text-2xl font-semibold text-[#1A3D2F]">Coming Soon</h2>
            </div>
            <div className="ml-auto flex flex-wrap items-center justify-end gap-x-3 gap-y-1.5 translate-y-1 text-xs sm:flex-nowrap sm:text-sm font-sans-clean font-medium">
              <a href={getCalendarPath()} onClick={(event) => { event.preventDefault(); onNavigate(getCalendarPath()); }} className="inline-flex items-center gap-[6px] whitespace-nowrap text-[#1A3D2F] hover:text-[#143626]" aria-label="View Christmas movie release calendar"><CalendarDays className="h-3.5 w-3.5 shrink-0 text-[#B8860B]" strokeWidth={1.8} aria-hidden="true" /><span>Release Calendar</span></a>
              <span className="font-sans-clean text-[#C8BFB3]" aria-hidden="true">·</span>
              <NavigationLink href={getMoviesPath()} onNavigate={onNavigate} className="whitespace-nowrap text-[#1A3D2F] hover:text-[#143626]">View all coming soon <span className="xmas-nav-arrow">→</span></NavigationLink>
            </div>
          </div>
        </div>
        <div className={homepageMovieGridOuterClass}>
          <div className={homepageMovieGridClass}>
            {comingSoon.map((movie) => {
              return <div key={movie.id} className="w-[140px] sm:w-auto shrink-0 snap-start">
                <MovieCard
                  movie={movie}
                  optimizeHomepageImage
                  titleLines={3}
                  metadata={formatMoviePremiereDate(movie) || 'Coming Soon'}
                  onSelectMovie={(slug, tmdbId) => onNavigate(getMoviePath(tmdbId || movie.tmdbId, slug))}
                />
              </div>;
            })}
          </div>
        </div>
        <HollyDivider className="homepage-holly-divider" lineClassName="w-6 sm:w-8" ornamentClassName="h-4 w-12 sm:h-5 sm:w-14" />
      </section>

      {thisMonth && <ThisMonthSection payload={thisMonth} onNavigate={onNavigate} />}

      <section className="py-7 sm:py-9" aria-labelledby="discovery-heading">
        <div className={homepageMovieGridOuterClass}>
          <div className="w-full flex items-end justify-between gap-4 mb-5">
            <div>
              <h2 id="discovery-heading" className="font-heading text-xl sm:text-2xl font-semibold text-[#1A3D2F]">Discover</h2>
            </div>
            <NavigationLink href={getMoviesPath()} onNavigate={onNavigate} className="ml-auto shrink-0 text-xs sm:text-sm font-sans-clean font-medium text-[#1A3D2F] hover:text-[#143626]">View all {totalMovies} movies <span className="xmas-nav-arrow">→</span></NavigationLink>
          </div>
        </div>
        <div className={homepageMovieGridOuterClass}>
          <div className={homepageMovieGridClass}>
            {discovery.map((movie) => <div key={movie.id} className="w-[140px] sm:w-auto shrink-0 snap-start"><MovieCard movie={movie} optimizeHomepageImage titleLines={3} onSelectMovie={(slug, tmdbId) => onNavigate(getMoviePath(tmdbId || movie.tmdbId, slug))} /></div>)}
          </div>
        </div>
        <HollyDivider className="homepage-holly-divider" lineClassName="w-6 sm:w-8" ornamentClassName="h-4 w-12 sm:h-5 sm:w-14" />
      </section>

      <BirthdaySection actors={birthdays} onNavigate={onNavigate} />

      {archiveYears.length > 0 && (
        <section className="py-7 sm:py-9" aria-labelledby="archive-years-heading">
          <div className="w-full flex items-end justify-between gap-4 mb-5">
            <div>
              <p className="font-sans-clean text-xs font-semibold uppercase tracking-[0.18em] text-[#8A6800]">Explore the archive</p>
                <h2 id="archive-years-heading" className="mt-1 font-heading text-xl sm:text-2xl font-semibold text-[#1A3D2F]">Through the Years</h2>
            </div>
            <NavigationLink href={getMoviesPath()} onNavigate={onNavigate} className="ml-auto shrink-0 text-xs sm:text-sm font-sans-clean font-medium text-[#1A3D2F] hover:text-[#143626]">View all years <span className="xmas-nav-arrow">→</span></NavigationLink>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-6">
            {archiveYears.map(({ year, movieCount }) => {
              const yearPath = getYearPath(year);
              return (
                <a
                  key={year}
                  href={yearPath}
                  onClick={(event) => {
                    event.preventDefault();
                    onNavigate(yearPath);
                  }}
                  className="group relative rounded-md border border-[#DED4C8] bg-[#FFFDF9] px-3 py-4 text-center transition-colors hover:border-[#B8860B]/60 hover:bg-[#F5EFE6] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#841818]"
                >
                  <span className="absolute right-2 top-2 text-[10px] text-[#B8860B]" aria-hidden="true">✦</span>
                  <span className="block font-heading text-2xl font-semibold text-[#1A3D2F] transition-colors group-hover:text-[#841818] sm:text-3xl">{year}</span>
                  <span className="mt-1 block px-1 font-body text-[10px] leading-tight text-[#736B63] sm:whitespace-nowrap sm:text-[11px] lg:text-[10px]">{movieCount} Christmas {movieCount === 1 ? 'movie' : 'movies'}</span>
                </a>
              );
            })}
          </div>
        </section>
      )}

    </div>
  );
};
