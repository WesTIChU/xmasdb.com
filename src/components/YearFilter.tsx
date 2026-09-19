import React from 'react';
import { getNetworkPath, getYearPath, getMoviesPath } from '../utils/urls';
import { NavigationLink } from './NavigationLink';

interface YearFilterProps {
  years: number[];
  selectedYear: number | null;
  onSelectYear: (year: number | null) => void;
  brandSlug?: string;
}

export const YearFilter: React.FC<YearFilterProps> = ({
  years,
  selectedYear,
  onSelectYear,
  brandSlug,
}) => {
  const allPath = brandSlug ? getNetworkPath(brandSlug) : getMoviesPath();

  const getPathForYear = (year: number) => {
    return brandSlug ? getNetworkPath(brandSlug, year) : getYearPath(year);
  };

  return (
    <div
      className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-sm sm:text-base font-body text-[#59524A] my-4 sm:my-6"
      aria-label="Filter by release year"
    >
      <NavigationLink href={allPath} id="year-filter-all" onNavigate={() => onSelectYear(null)} isActive={selectedYear === null} className={`cursor-pointer px-1 py-0.5 transition-colors ${selectedYear === null ? 'font-bold' : 'text-[#59524A] hover:text-[#1A3D2F]'}`}>All</NavigationLink>

      {years.map((year) => {
        const yearPath = getPathForYear(year);
        return (
          <React.Fragment key={year}>
            <span className="text-[#C8BFB3] select-none">·</span>
            <NavigationLink href={yearPath} id={`year-filter-${year}`} onNavigate={() => onSelectYear(year)} isActive={selectedYear === year} className={`cursor-pointer px-1 py-0.5 transition-colors ${selectedYear === year ? 'font-bold' : 'text-[#59524A] hover:text-[#1A3D2F]'}`}>{year}</NavigationLink>
          </React.Fragment>
        );
      })}
    </div>
  );
};
