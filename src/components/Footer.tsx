import React from 'react';
import type { MetaBrand } from '../api/types';
import { getNetworkPath, getMoviesPath, getFeedsPath } from '../utils/urls';
import { NavigationLink, NavSquiggle } from './NavigationLink';

interface FooterProps {
  onNavigate: (path: string) => void;
  populatedBrands: MetaBrand[];
}

export const Footer: React.FC<FooterProps> = ({ onNavigate, populatedBrands }) => {
  return (
    <footer className="border-t border-[#E7DFD5] bg-[#F7F2EB] py-10 px-4 mt-16 text-center text-sm text-[#736B63] font-body">
      <div className="max-w-4xl mx-auto space-y-4">
        {/* Small holly divider */}
        <div className="flex items-center justify-center gap-2 text-[#1A3D2F]" aria-hidden="true">
          <span className="h-px w-8 bg-[#B8860B]/60" />
          <svg className="h-5 w-14" viewBox="0 0 56 20" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M2 14C10 12 13 7 19 5M54 14C46 12 43 7 37 5" stroke="#1A3D2F" strokeWidth="1.2" strokeLinecap="round" />
            <path d="M11 11C14 9 17 9 20 10M45 11C42 9 39 9 36 10M15 8C17 6 19 5 22 5M41 8C39 6 37 5 34 5" stroke="#1A3D2F" strokeWidth="1" strokeLinecap="round" />
            <circle cx="25" cy="10" r="2" fill="#841818" />
            <circle cx="31" cy="10" r="2" fill="#841818" />
            <path d="M27.8 3L28.5 5.1L30.7 5.1L28.9 6.4L29.6 8.5L27.8 7.2L26 8.5L26.7 6.4L24.9 5.1L27.1 5.1L27.8 3Z" fill="#B8860B" />
          </svg>
          <span className="h-px w-8 bg-[#B8860B]/60" />
        </div>

        <nav
          className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-sm text-[#1A3D2F]"
          aria-label="Footer Links"
        >
           <NavigationLink href="/" onNavigate={onNavigate} className="text-[#1A3D2F] hover:text-[#B8860B] transition-colors">Home</NavigationLink>
           <span className="text-[#C8BFB3] select-none">·</span>
           <NavigationLink href="/about/" onNavigate={onNavigate} className="text-[#1A3D2F] hover:text-[#B8860B] transition-colors">About</NavigationLink>
           <span className="text-[#C8BFB3] select-none">·</span>
           <NavigationLink href={getMoviesPath()} onNavigate={onNavigate} className="text-[#1A3D2F] hover:text-[#B8860B] transition-colors">All Movies</NavigationLink>
          <span className="text-[#C8BFB3] select-none">·</span>
          {populatedBrands.map((b) => (
            <React.Fragment key={b.id}>
              <NavigationLink href={getNetworkPath(b.slug)} onNavigate={onNavigate} className="text-[#1A3D2F] hover:text-[#B8860B] transition-colors">
                {b.shortName}
              </NavigationLink>
              <span className="text-[#C8BFB3] select-none">·</span>
            </React.Fragment>
          ))}
          <NavigationLink href={getFeedsPath()} onNavigate={onNavigate} className="text-[#1A3D2F] hover:text-[#B8860B] transition-colors">Feeds &amp; Radarr</NavigationLink>
          <span className="text-[#C8BFB3] select-none">·</span>
          <a
            href="/sitemap.xml"
            target="_blank"
            rel="noopener noreferrer"
            className="xmas-nav-link text-[#1A3D2F] hover:text-[#B8860B] transition-colors text-xs font-sans-clean"
          >
            <span className="relative inline-block leading-normal">Sitemap<NavSquiggle /></span>
          </a>
          <span className="text-[#C8BFB3] select-none">·</span>
           <NavigationLink href="/privacy/" onNavigate={onNavigate} className="text-[#1A3D2F] hover:text-[#B8860B] transition-colors">Privacy &amp; AI</NavigationLink>
        </nav>

        <p className="text-xs text-[#6F675E] font-sans-clean max-w-lg mx-auto">
          <strong className="font-semibold text-[#1A3D2F]">XmasDB.com</strong> — A curated collection of Christmas movies.
          Posters and metadata sourced from TMDB. Not affiliated with Hallmark Channel or Lifetime.
        </p>
        <p className="text-[11px] text-[#756B60] font-sans-clean">&copy; {new Date().getFullYear()} XmasDB.com</p>
      </div>

    </footer>
  );
};
