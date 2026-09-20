import React from 'react';
import type { MetaBrand } from '../api/types';
import { getMoviesPath, getNetworkPath, getFeedsPath } from '../utils/urls';
import { SearchAutocomplete } from './SearchAutocomplete';
import { NavSquiggle } from './NavigationLink';

interface HeaderProps {
  currentPath: string;
  onNavigate: (path: string) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  populatedBrands: MetaBrand[];
}

export const Header: React.FC<HeaderProps> = ({
  currentPath,
  onNavigate,
  searchQuery,
  onSearchChange,
  populatedBrands,
}) => {
  // Normalize current path
  const normalizedPath = (currentPath.replace(/\/+$/, '') || '/') + '/';

  const isBrandActive = (brandSlug: string) => {
    return normalizedPath.startsWith(`/${brandSlug}/`);
  };

  const isAllActive = () => {
    return (
      normalizedPath === '/' ||
      normalizedPath.startsWith('/movies/') ||
      normalizedPath.startsWith('/year/') ||
      normalizedPath.startsWith('/all/')
    );
  };

  const isFeedsActive = () => {
    return normalizedPath.startsWith('/feeds/');
  };

  return (
      <header className="border-b border-[#E7DFD5] bg-[#FAF7F2] py-4 pb-4 sm:pt-6 sm:pb-4 px-4 sm:px-6 relative z-30">
      <div className="max-w-4xl mx-auto text-center">
        {/* 1. Branding: XmasDB.com Logo */}
        <div className="mb-3 sm:mb-4">
          <h1 className="m-0 leading-none">
            <a
              href="/"
              onClick={(e) => {
                e.preventDefault();
                onNavigate('/');
              }}
              className="inline-block transition-transform duration-150 hover:scale-[1.01] focus:outline-none"
              id="site-title-link"
              title="XmasDB.com — Home"
            >
              <img
                src="/logo.png"
                alt="XmasDB.com — A curated collection of Christmas movies"
                className="h-20 sm:h-28 md:h-36 lg:h-44 max-w-full w-auto object-contain mx-auto drop-shadow-xs"
                referrerPolicy="no-referrer"
              />
              <span className="sr-only">XmasDB.com — A curated collection of Christmas movies.</span>
            </a>
          </h1>
        </div>

        {/* 2. Network Navigation directly beneath branding with hand-drawn wavy dark-green squiggle */}
        <nav
          className="flex flex-wrap items-center justify-center gap-x-1 sm:gap-x-2 gap-y-1.5 text-sm sm:text-[17px] font-body font-medium mb-3 text-[#4A433B]"
          aria-label="Main Navigation"
        >
          {populatedBrands.map((brand, index) => {
            const isActive = isBrandActive(brand.slug);
            return (
              <React.Fragment key={brand.id}>
                {index > 0 && <span className="text-[#C8BFB3] select-none text-xs sm:text-sm px-1">|</span>}
                <a
                  href={getNetworkPath(brand.slug)}
                  onClick={(e) => {
                    e.preventDefault();
                    onNavigate(getNetworkPath(brand.slug));
                  }}
                  id={`nav-${brand.id}`}
                  className={`nav-link-item group transition-colors select-none ${
                    isActive
                      ? 'text-[#1A3D2F] font-semibold is-active'
                      : 'text-[#4A433B] hover:text-[#1A3D2F]'
                  }`}
                  aria-current={isActive ? 'page' : undefined}
                >
                  <span className="relative inline-block leading-normal">
                    {brand.shortName}
                    <NavSquiggle isActive={isActive} />
                  </span>
                </a>
              </React.Fragment>
            );
          })}

          <span className="text-[#C8BFB3] select-none text-xs sm:text-sm px-1">|</span>

          {/* All Movies */}
          <a
            href={getMoviesPath()}
            onClick={(e) => {
              e.preventDefault();
              onNavigate(getMoviesPath());
            }}
            id="nav-all"
            className={`nav-link-item group transition-colors select-none ${
              isAllActive()
                ? 'text-[#1A3D2F] font-semibold is-active'
                : 'text-[#4A433B] hover:text-[#1A3D2F]'
            }`}
            aria-current={isAllActive() ? 'page' : undefined}
          >
            <span className="relative inline-block leading-normal">
              All Movies
              <NavSquiggle isActive={isAllActive()} />
            </span>
          </a>

          <span className="text-[#C8BFB3] select-none text-xs sm:text-sm px-1">|</span>

          {/* Feeds */}
          <a
            href={getFeedsPath()}
            onClick={(e) => {
              e.preventDefault();
              onNavigate(getFeedsPath());
            }}
            id="nav-feeds"
            className={`nav-link-item group transition-colors select-none ${
              isFeedsActive()
                ? 'text-[#841818] font-semibold is-active'
                : 'text-[#4A433B] hover:text-[#841818]'
            }`}
            aria-current={isFeedsActive() ? 'page' : undefined}
          >
            <span className="relative inline-block leading-normal">
              Feeds
              <NavSquiggle isActive={isFeedsActive()} />
            </span>
          </a>
        </nav>

        {/* 3. Upgraded real-time search autocomplete directly beneath navigation */}
        <SearchAutocomplete
          searchQuery={searchQuery}
          onSearchChange={onSearchChange}
          onNavigate={onNavigate}
        />
      </div>
    </header>
  );
};
