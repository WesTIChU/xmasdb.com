import React from 'react';
import type { MetaBrand } from '../api/types';
import { getMoviesPath, getFeedsPath } from '../utils/urls';
import { NavigationLink, NavSquiggle } from './NavigationLink';
import { HollyDivider } from './HollyDivider';

interface FooterProps {
  onNavigate: (path: string) => void;
  populatedBrands: MetaBrand[];
}

export const Footer: React.FC<FooterProps> = ({ onNavigate }) => {
  return (
    <footer className="border-t border-[#E7DFD5] bg-[#F7F2EB] py-10 px-4 mt-16 text-center text-sm text-[#736B63] font-body">
      <div className="max-w-4xl mx-auto space-y-4">
        <HollyDivider />

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
           <span className="text-[#C8BFB3] select-none">·</span>
           <NavigationLink href="/contact/" onNavigate={onNavigate} className="text-[#1A3D2F] hover:text-[#B8860B] transition-colors">Contact</NavigationLink>
        </nav>

        <p className="text-xs text-[#6F675E] font-sans-clean max-w-lg mx-auto">
           <strong className="font-semibold text-[#1A3D2F]">XmasDB.com</strong>. A curated collection of Christmas movies.
           Not affiliated with Hallmark Channel or Lifetime.
         </p>
         <p className="text-[11px] text-[#756B60] font-sans-clean">&copy; {new Date().getFullYear()} XmasDB.com</p>
      </div>

    </footer>
  );
};
