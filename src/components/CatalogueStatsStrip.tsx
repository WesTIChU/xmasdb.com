import React, { useEffect, useRef, useState } from 'react';
import type { CatalogueMeta } from '../api/types';
import { getMoviesPath, getNetworkPath } from '../utils/urls';
import { NavigationLink } from './NavigationLink';

interface CatalogueStatsStripProps {
  meta: CatalogueMeta | null;
  onNavigate: (path: string) => void;
}

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

export const CatalogueStatsStrip: React.FC<CatalogueStatsStripProps> = ({ meta, onNavigate }) => {
  const [countdown, setCountdown] = useState(() => getChristmasCountdown(new Date()));
  const [isHourPulseActive, setIsHourPulseActive] = useState(false);
  const previousHourRef = useRef(countdown.hours);
  const pulseTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    const timer = window.setInterval(() => {
      const nextCountdown = getChristmasCountdown(new Date());
      if (nextCountdown.hours !== previousHourRef.current) {
        previousHourRef.current = nextCountdown.hours;
        if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
          setIsHourPulseActive(true);
          if (pulseTimeoutRef.current !== null) window.clearTimeout(pulseTimeoutRef.current);
          pulseTimeoutRef.current = window.setTimeout(() => {
            setIsHourPulseActive(false);
            pulseTimeoutRef.current = null;
          }, 600);
        }
      }
      setCountdown(nextCountdown);
    }, 60000);
    return () => {
      window.clearInterval(timer);
      if (pulseTimeoutRef.current !== null) window.clearTimeout(pulseTimeoutRef.current);
    };
  }, []);

  const totalMovies = meta?.totalMovies ?? 0;
  const populatedBrands = meta?.populatedBrands ?? [];

  return (
  <aside className="catalogue-stats-strip relative w-full overflow-hidden bg-[#143626] text-[#FAF7F2]" aria-label="XmasDB catalogue statistics and Christmas countdown">
    <svg className="pointer-events-none absolute inset-x-0 bottom-0 z-0 h-[9px] w-full sm:h-2.5" viewBox="0 0 1200 12" preserveAspectRatio="none" aria-hidden="true">
      <path
        fill="#FAF7F2"
        fillOpacity="0.94"
        d="M0 7C22 6 36 8 56 6C76 4 88 2 108 3C130 4 140 7 162 6C184 5 196 7 216 5C238 3 250 1.5 272 3C294 4 306 7 328 6C350 5 362 7 382 5C404 3 418 2 438 3C460 4 472 7 494 6C516 5 528 7 548 5C570 3 584 1.5 606 3C628 4 640 7 662 6C684 5 696 7 716 5C738 3 752 2 772 3C794 4 806 7 828 6C850 5 862 7 882 5C904 3 918 1.5 940 3C962 4 974 7 996 6C1018 5 1030 7 1050 5C1072 3 1086 2 1106 3C1128 4 1140 7 1162 6C1180 5 1190 6 1200 5V12H0Z"
      />
    </svg>
    <div className="relative z-10 max-w-4xl mx-auto min-h-[34px] px-4 sm:px-6 flex items-center justify-center gap-2 sm:gap-3 whitespace-nowrap font-sans-clean text-[10px] sm:text-[11px] tracking-[0.08em]">
      <span className="hidden sm:inline text-[#FAF7F2]/90">XMASDB <span className="text-[#C59A3F]">·</span></span>
      <NavigationLink href={getMoviesPath()} onNavigate={onNavigate} squiggleColor="#E9D8AE" className="shrink-0 text-[#FAF7F2] hover:text-[#D4AF37] transition-colors">
        <span className="font-semibold">{totalMovies} MOVIES</span>
      </NavigationLink>
      <span className="text-[#C59A3F] select-none" aria-hidden="true">✦</span>
      <div className="catalogue-stats-brands flex min-w-0 shrink items-center gap-2 sm:gap-3 overflow-x-auto no-scrollbar">
        {populatedBrands.map((brand, index) => (
          <React.Fragment key={brand.id}>
            {index > 0 && <span className="text-[#C59A3F] select-none" aria-hidden="true">·</span>}
            <NavigationLink href={getNetworkPath(brand.slug)} onNavigate={onNavigate} squiggleColor="#E9D8AE" className="shrink-0 text-[#FAF7F2] hover:text-[#D4AF37] transition-colors">
              <span className="font-semibold">{brand.shortName.toUpperCase()} {brand.count}</span>
            </NavigationLink>
          </React.Fragment>
        ))}
      </div>
      <span className="text-[#C59A3F] select-none" aria-hidden="true">✦</span>
      <span className="shrink-0 font-semibold text-[#FAF7F2]/90" aria-label={`${countdown.days} days, ${countdown.hours} hours, ${countdown.minutes} minutes and ${countdown.seconds} seconds until Christmas`}>
         CHRISTMAS IN <span className={`stats-countdown-time inline-block text-[#E9D8AE]${isHourPulseActive ? ' stats-countdown-hour-pulse' : ''}`}>{countdown.days}D {String(countdown.hours).padStart(2, '0')}H {String(countdown.minutes).padStart(2, '0')}M</span>
      </span>
    </div>
  </aside>
  );
};
