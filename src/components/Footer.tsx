import React, { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { getPopulatedBrands } from '../data/brands';
import { MOVIES } from '../data/movies';
import { getNetworkPath, getMoviesPath, getFeedsPath } from '../utils/urls';
import { NavigationLink, NavSquiggle } from './NavigationLink';

interface FooterProps {
  onNavigate: (path: string) => void;
}

export const Footer: React.FC<FooterProps> = ({ onNavigate }) => {
  const [isPrivacyOpen, setIsPrivacyOpen] = useState(false);
  const privacyTriggerRef = useRef<HTMLButtonElement | null>(null);
  const privacyCloseRef = useRef<HTMLButtonElement | null>(null);
  const privacyDialogRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isPrivacyOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const focusFrame = window.requestAnimationFrame(() => privacyCloseRef.current?.focus());

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setIsPrivacyOpen(false);
        privacyTriggerRef.current?.focus();
        return;
      }

      if (event.key !== 'Tab' || !privacyDialogRef.current) return;
      const focusable = Array.from(
        privacyDialogRef.current.querySelectorAll<HTMLElement>(
          'button, a, input, select, textarea, [tabindex]:not([tabindex="-1"])'
        )
      ).filter((element) => !element.hasAttribute('disabled'));
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      window.cancelAnimationFrame(focusFrame);
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isPrivacyOpen]);

  const closePrivacy = () => {
    setIsPrivacyOpen(false);
    window.requestAnimationFrame(() => privacyTriggerRef.current?.focus());
  };

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
          <NavigationLink href={getMoviesPath()} onNavigate={onNavigate} className="text-[#1A3D2F] hover:text-[#B8860B] transition-colors">All Movies</NavigationLink>
          <span className="text-[#C8BFB3] select-none">·</span>
          {getPopulatedBrands(MOVIES).map((b) => (
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
          <button
            ref={privacyTriggerRef}
            type="button"
            onClick={() => setIsPrivacyOpen(true)}
            className="xmas-nav-link text-xs font-sans-clean text-[#1A3D2F] hover:text-[#B8860B] transition-colors cursor-pointer"
            aria-haspopup="dialog"
            aria-expanded={isPrivacyOpen}
          >
            <span className="relative inline-block leading-normal">Privacy &amp; Site Notes<NavSquiggle /></span>
          </button>
        </nav>

        <p className="text-xs text-[#8C8379] font-sans-clean max-w-lg mx-auto">
          <strong className="font-semibold text-[#1A3D2F]">XmasDB.com</strong> — A curated collection of Christmas movies.
          Posters and metadata sourced from TMDB. Not affiliated with Hallmark Channel or Lifetime.
        </p>
        <p className="text-[11px] text-[#A3998D] font-sans-clean">&copy; {new Date().getFullYear()} XmasDB.com</p>
      </div>

      {isPrivacyOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#18231F]/60 px-4 py-6"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closePrivacy();
          }}
        >
          <div
            ref={privacyDialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="privacy-site-notes-heading"
            className="relative w-full max-w-[520px] max-h-[calc(100vh-3rem)] overflow-y-auto rounded-xl border border-[#E0D5C7] bg-[#FFFDF9] p-6 sm:p-8 text-left shadow-xl"
          >
            <button
              ref={privacyCloseRef}
              type="button"
              onClick={closePrivacy}
              className="absolute right-4 top-4 inline-flex h-8 w-8 items-center justify-center rounded-full text-[#736B63] hover:bg-[#F5EFE6] hover:text-[#1A3D2F] transition-colors cursor-pointer"
               aria-label="Close Privacy & Site Notes dialog"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>

              <div className="pr-8">
                <p className="font-sans-clean text-[10px] font-semibold uppercase tracking-[0.2em] text-[#B8860B]">XmasDB</p>
                <h2 id="privacy-site-notes-heading" className="mt-1 font-heading text-2xl font-semibold text-[#1A3D2F]">Privacy &amp; Site Notes</h2>
              </div>

              <div className="mt-5 space-y-5 font-body text-sm leading-relaxed text-[#4A433B]">
                <section>
                  <h3 className="font-heading text-base font-semibold text-[#1A3D2F]">Your privacy</h3>
                  <p className="mt-1.5">XmasDB does not use advertising, analytics or visitor tracking. We don&apos;t build profiles of visitors or sell personal information. Like most websites, basic technical request information may be processed by the server or hosting provider to deliver the site and keep it running.</p>
                </section>
                <section>
                  <h3 className="font-heading text-base font-semibold text-[#1A3D2F]">The movie collection is curated</h3>
                  <p className="mt-1.5">The XmasDB catalogue has taken considerable time to research, compile and verify. Movies are gathered and checked from multiple sources.</p>
                  <p className="mt-2">Movie information, artwork and identifiers may come from third-party sources such as TMDB, while XmasDB&apos;s selection, organisation and brand classification are maintained as part of the site&apos;s curated catalogue.</p>
                </section>
              </div>
          </div>
        </div>
      )}
    </footer>
  );
};
