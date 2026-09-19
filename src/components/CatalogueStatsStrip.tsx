import React, { useEffect, useState } from 'react';
import { MOVIES } from '../data/movies';
import { getPopulatedBrands } from '../data/brands';
import { getMoviesPath, getNetworkPath } from '../utils/urls';
import { NavigationLink } from './NavigationLink';

interface CatalogueStatsStripProps {
  onNavigate: (path: string) => void;
}

const catalogueMovies = Array.from(new Map(MOVIES.map((movie) => [movie.tmdbId, movie])).values());

function getChristmasCountdown(now: Date) {
  let christmas = new Date(now.getFullYear(), 11, 25);
  if (now.getTime() >= christmas.getTime()) christmas = new Date(now.getFullYear() + 1, 11, 25);
  const remaining = Math.max(0, christmas.getTime() - now.getTime());
  const totalSeconds = Math.floor(remaining / 1000);
  return {
    days: Math.floor(totalSeconds / 86400),
    hours: Math.floor((totalSeconds % 86400) / 3600),
    minutes: Math.floor((totalSeconds % 3600) / 60),
    seconds: totalSeconds % 60,
  };
}

export const CatalogueStatsStrip: React.FC<CatalogueStatsStripProps> = ({ onNavigate }) => {
  const [countdown, setCountdown] = useState(() => getChristmasCountdown(new Date()));

  useEffect(() => {
    const timer = window.setInterval(() => setCountdown(getChristmasCountdown(new Date())), 1000);
    return () => window.clearInterval(timer);
  }, []);

  return (
  <aside className="catalogue-stats-strip w-full overflow-hidden bg-[#143626] text-[#FAF7F2]" aria-label="XmasDB catalogue statistics and Christmas countdown">
    <div className="max-w-4xl mx-auto min-h-[34px] px-4 sm:px-6 flex items-center justify-center gap-2 sm:gap-3 whitespace-nowrap font-sans-clean text-[10px] sm:text-[11px] tracking-[0.08em]">
      <span className="hidden sm:inline text-[#FAF7F2]/90">XMASDB <span className="text-[#C59A3F]">·</span></span>
      <NavigationLink href={getMoviesPath()} onNavigate={onNavigate} squiggleColor="#E9D8AE" className="shrink-0 text-[#FAF7F2] hover:text-[#D4AF37] transition-colors">
        <span className="font-semibold">{catalogueMovies.length} MOVIES</span>
      </NavigationLink>
      <span className="text-[#C59A3F] select-none" aria-hidden="true">✦</span>
      <div className="catalogue-stats-brands flex min-w-0 shrink items-center gap-2 sm:gap-3 overflow-x-auto no-scrollbar">
        {getPopulatedBrands(catalogueMovies).map((brand, index) => (
          <React.Fragment key={brand.id}>
            {index > 0 && <span className="text-[#C59A3F] select-none" aria-hidden="true">·</span>}
            <NavigationLink href={getNetworkPath(brand.slug)} onNavigate={onNavigate} squiggleColor="#E9D8AE" className="shrink-0 text-[#FAF7F2] hover:text-[#D4AF37] transition-colors">
              <span className="font-semibold">{brand.shortName.toUpperCase()} {catalogueMovies.filter((movie) => movie.brandId === brand.id).length}</span>
            </NavigationLink>
          </React.Fragment>
        ))}
      </div>
      <span className="text-[#C59A3F] select-none" aria-hidden="true">✦</span>
      <span className="shrink-0 text-[#FAF7F2]/90" aria-label={`${countdown.days} days, ${countdown.hours} hours, ${countdown.minutes} minutes and ${countdown.seconds} seconds until Christmas`}>
        CHRISTMAS IN <span className="text-[#E9D8AE]">{countdown.days}D {String(countdown.hours).padStart(2, '0')}H {String(countdown.minutes).padStart(2, '0')}M</span>
      </span>
    </div>
  </aside>
  );
};
