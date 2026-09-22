import React, { useState, useMemo, useRef } from 'react';
import { ExternalLink, Instagram, Facebook } from 'lucide-react';
import type { ActorFilmographyItem } from '../api/types';
import { Actor } from '../types';
import { getMoviesPath, getMoviePath, getActorFeedPath } from '../utils/urls';
import { BackNavigation } from './BackNavigation';
import { NavigationLink, NavigationTab } from './NavigationLink';
import { getMoviePoster } from '../utils/posters';
import { getBrandById } from '../data/brands';
import { calculateAge, calculateAgeAtDeath, formatActorDate, isValidActorDate, sanitizeBiography } from '../utils/actor-dates';
import { ComingSoonPoster } from './ComingSoonPoster';

interface ActorDetailProps {
  actor: Actor;
  filmography: ActorFilmographyItem[];
  actingFilmography: ActorFilmographyItem[];
  directingFilmography: ActorFilmographyItem[];
  writingFilmography: ActorFilmographyItem[];
  backdropUrl: string | null;
  onNavigate: (path: string) => void;
  onSelectMovie: (slug: string, tmdbId?: number) => void;
}

function getSentencePreview(text: string): string {
  const targetLength = Math.min(850, text.length);
  const candidate = text.slice(0, targetLength);
  const boundary = Math.max(candidate.lastIndexOf('. '), candidate.lastIndexOf('! '), candidate.lastIndexOf('? '));
  if (boundary >= 240) return candidate.slice(0, boundary + 1).trim();
  const remainder = text.slice(targetLength).match(/[.!?](?:\s|$)/);
  return remainder ? text.slice(0, targetLength + (remainder.index || 0) + 1).trim() : candidate.trim();
}

export const ActorDetail: React.FC<ActorDetailProps> = ({
  actor,
  filmography,
  actingFilmography,
  directingFilmography,
  writingFilmography,
  backdropUrl,
  onNavigate,
  onSelectMovie,
}) => {
  const safeFilmography = Array.isArray(filmography) ? filmography : [];
  const safeActingFilmography = Array.isArray(actingFilmography) ? actingFilmography : safeFilmography.filter((movie) => !movie.crewJobs?.length);
  const safeDirectingFilmography = Array.isArray(directingFilmography) ? directingFilmography : [];
  const safeWritingFilmography = Array.isArray(writingFilmography) ? writingFilmography : [];
  const [selectedBrandFilter, setSelectedBrandFilter] = useState<string>('all');
  const [imageError, setImageError] = useState<boolean>(false);
  const [backdropError, setBackdropError] = useState<boolean>(false);
  const [biographyExpanded, setBiographyExpanded] = useState(false);
  const biographyRef = useRef<HTMLDivElement>(null);
  const actorBackdrop = useMemo(
    () => (backdropUrl ? { url: backdropUrl } : null),
    [backdropUrl]
  );

  // Derive unique brands in this actor's XmasDB filmography
  const brandStats = useMemo(() => {
    const map = new Map<string, number>();
    for (const m of safeFilmography) {
      map.set(m.brandId, (map.get(m.brandId) || 0) + 1);
    }
    return Array.from(map.entries()).map(([brandId, count]) => {
      const brand = getBrandById(brandId);
      return {
        brandId,
        name: brand ? brand.name : brandId.toUpperCase(),
        shortName: brand ? brand.shortName : brandId.toUpperCase(),
        count,
      };
    });
  }, [safeFilmography]);

  // Age calculations
  const isDeceased = isValidActorDate(actor.deathday);
  const currentAge = !isDeceased && actor.birthday ? calculateAge(actor.birthday) : null;
  const ageAtDeath = isDeceased && actor.birthday && actor.deathday
    ? calculateAgeAtDeath(actor.birthday, actor.deathday)
    : null;

  const formattedBirthday = formatActorDate(actor.birthday);
  const formattedDeathday = isDeceased ? formatActorDate(actor.deathday) : null;
  const biography = sanitizeBiography(actor.biography);
  const biographyParagraphs = biography?.split(/\n\s*\n/).map((paragraph) => paragraph.trim()).filter(Boolean) || [];
  const shouldCollapseBiography = Boolean(biography && (biographyParagraphs.length > 3 || biography.length > 1000));
  const biographyPreview = biographyParagraphs.length > 3
    ? biographyParagraphs.slice(0, 3).join('\n\n')
    : biography ? getSentencePreview(biography) : null;
  const displayedBiography = biographyExpanded || !shouldCollapseBiography ? biography : biographyPreview;

  // Photo URL (with fallback to profileUrl or photoUrl)
  const portraitUrl = actor.profileUrl || actor.photoUrl;

  const renderFilmographyGrid = (movies: ActorFilmographyItem[]) => {
    const selectedMovies = selectedBrandFilter === 'all'
      ? movies
      : movies.filter((m) => m.brandId === selectedBrandFilter);
    if (selectedMovies.length === 0) return <div className="text-center py-8 text-[#736B63] font-body">No holiday movies found for this filter.</div>;
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-x-4 gap-y-8 sm:gap-x-5 sm:gap-y-10">
        {selectedMovies.map((movie) => {
          const brand = getBrandById(movie.brandId);
          const canonicalPath = getMoviePath(movie.tmdbId, movie.slug);
          const poster = getMoviePoster(movie);
          return (
            <article key={`${movie.id}-${movie.crewJobs?.join('-') || 'acting'}`} id={`actor-movie-${movie.slug}`}>
              <a href={canonicalPath} onClick={(e) => { e.preventDefault(); onSelectMovie(movie.slug, movie.tmdbId); }} className="group flex flex-col transition-all duration-200 block text-inherit no-underline">
                <div className="relative aspect-2/3 w-full overflow-hidden rounded-sm bg-[#EBE4DA] border border-[#E0D7CC] group-hover:border-[#B8860B]/50 transition-colors">
                  {!poster ? <ComingSoonPoster year={movie.year} networkName={brand ? brand.shortName : undefined} /> : (
                    <img src={poster} alt={movie.title} width={500} height={750} loading="lazy" referrerPolicy="no-referrer" className="h-full w-full object-cover object-center group-hover:scale-101 transition-transform duration-300" />
                  )}
                </div>
                <div className="pt-2.5 pb-1 text-center">
                  <h3 className="font-heading text-sm sm:text-base font-semibold text-[#1A3D2F] group-hover:text-[#841818] transition-colors leading-snug line-clamp-2" title={movie.title}>{movie.title}</h3>
                  <p className="text-xs text-[#736B63] mt-0.5 font-body">{movie.year}{brand && <span className="text-[#756B60] font-sans-clean ml-1.5">· {brand.shortName}</span>}</p>
                  {movie.character && <p className="text-[11px] text-[#841818] font-sans-clean mt-0.5 truncate italic">as {movie.character}</p>}
                  {movie.crewJobs && movie.crewJobs.length > 0 && <p className="text-[11px] text-[#841818] font-sans-clean mt-0.5 truncate">{movie.crewJobs.join(' · ')}</p>}
                </div>
              </a>
            </article>
          );
        })}
      </div>
    );
  };

  return (
    <div id={`actor-detail-${actor.slug}`} className="py-6 sm:py-10 max-w-5xl mx-auto px-4 sm:px-6">
      {/* Back to Catalogue Navigation */}
      <div className="mb-5 sm:mb-6">
        <BackNavigation href={getMoviesPath()} id="back-from-actor-btn" label="Back to All Movies" title="Back to All Movies" onNavigate={onNavigate} />
      </div>

      {actorBackdrop && !backdropError && (
        <div className="relative w-full h-36 sm:h-52 rounded-lg overflow-hidden mb-6 border border-[#E7DFD5] bg-[#EBE4DA]">
           <img
            src={actorBackdrop.url}
            alt=""
            width={1280}
            height={360}
            className="w-full h-full object-cover object-center"
            onError={() => setBackdropError(true)}
          />
        </div>
      )}
      {/* Main Profile Header */}
      <header
        id="actor-profile-header"
        className="mb-8 sm:mb-10"
      >
        <div className="flex flex-col md:flex-row items-center md:items-start gap-6 sm:gap-8">
          {/* Left Column: Actor Portrait and External Links */}
          <div className="w-40 sm:w-48 md:w-52 shrink-0 flex flex-col items-center">
            <div className="actor-portrait-frame w-full aspect-3/4 rounded-xl overflow-visible border border-[#DCD3C7] bg-[#EAE2D7] shadow-xs relative">
              <div className="w-full h-full rounded-xl overflow-hidden">
              {portraitUrl && !imageError ? (
                <img
                  src={portraitUrl}
                  alt={actor.name}
                  width={500}
                  height={750}
                  referrerPolicy="no-referrer"
                  fetchPriority="high"
                  className="w-full h-full object-cover object-center"
                  onError={() => setImageError(true)}
                />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center bg-[#EFE9DF] text-[#1A3D2F]">
                  <span className="font-serif text-5xl font-normal opacity-40">
                    {actor.name.charAt(0)}
                  </span>
                  <span className="text-xs font-sans-clean uppercase tracking-wider text-[#736B63] mt-2">
                    No Portrait
                  </span>
                </div>
              )}
              </div>
            </div>

            {(actor.imdbPersonId || actor.tmdbPersonId || actor.instagramId || actor.twitterId || actor.facebookId) && (
              <div id="actor-external-links" className="mt-3 w-full flex flex-col items-stretch gap-2">
                {(actor.imdbPersonId || actor.tmdbPersonId) && (
                  <div className="flex w-full items-center gap-2">
                {actor.imdbPersonId && (
                  <a href={`https://www.imdb.com/name/${encodeURIComponent(actor.imdbPersonId)}/`} target="_blank" rel="noopener noreferrer" id="actor-imdb-link" className="flex-1 justify-center py-1.5 px-2.5 rounded bg-[#FAF7F2] hover:bg-[#EFE8DD] border border-[#DDD4C6] hover:border-[#1A3D2F] text-[#1A3D2F] text-xs font-sans-clean font-medium inline-flex items-center gap-1.5 transition-colors shadow-2xs group" title={`View ${actor.name} on IMDb`}>
                    <span>IMDb</span><ExternalLink className="w-3 h-3 text-[#1A3D2F] group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                  </a>
                )}
                 {actor.tmdbPersonId && (
                  <a href={`https://www.themoviedb.org/person/${actor.tmdbPersonId}`} target="_blank" rel="noopener noreferrer" id="actor-tmdb-link" className="flex-1 justify-center py-1.5 px-2.5 rounded bg-[#FAF7F2] hover:bg-[#EFE8DD] border border-[#DDD4C6] hover:border-[#1A3D2F] text-[#1A3D2F] text-xs font-sans-clean font-medium inline-flex items-center gap-1.5 transition-colors shadow-2xs group" title={`View ${actor.name} on TMDb`}>
                    <span>TMDb</span><ExternalLink className="w-3 h-3 text-[#1A3D2F] group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                   </a>
                  )}
                  </div>
                )}
                {(actor.instagramId || actor.facebookId || actor.twitterId) && (
                  <div className="flex items-center gap-3">
                    {actor.instagramId && <a href={`https://www.instagram.com/${encodeURIComponent(actor.instagramId)}/`} target="_blank" rel="noopener noreferrer" className="text-[#1A3D2F] hover:text-[#841818]" aria-label={`${actor.name} on Instagram`}><Instagram className="h-[18px] w-[18px]" /></a>}
                    {actor.twitterId && <a href={`https://twitter.com/${encodeURIComponent(actor.twitterId)}`} target="_blank" rel="noopener noreferrer" className="text-[#1A3D2F] hover:text-[#841818]" aria-label={`${actor.name} on Twitter`}><span className="text-[18px] font-semibold leading-none">X</span></a>}
                    {actor.facebookId && <a href={`https://www.facebook.com/${encodeURIComponent(actor.facebookId)}`} target="_blank" rel="noopener noreferrer" className="text-[#1A3D2F] hover:text-[#841818]" aria-label={`${actor.name} on Facebook`}><Facebook className="w-3.5 h-3.5" /></a>}
                  </div>
                )}
              </div>
            )}

          </div>

          {/* Actor Editorial Information */}
          <div className="flex-1 text-center md:text-left">
            <h1
              id="actor-name-title"
              className="text-3xl sm:text-4xl md:text-5xl font-serif font-normal text-[#1A3D2F] tracking-tight leading-tight"
            >
              {actor.name}
            </h1>

            {/* XmasDB Catalogue Summary */}
            <div className="mt-2 text-sm font-medium text-[#1A3D2F] tracking-wide">
              {safeFilmography.length} {safeFilmography.length === 1 ? 'Christmas Movie' : 'Christmas Movies'} in XmasDB
            </div>

            {/* Brand Breakdown */}
            {brandStats.length > 0 && (
              <div
                id="actor-brand-breakdown"
                className="flex flex-wrap items-center justify-center md:justify-start gap-x-3 gap-y-1 mt-2.5 text-sm font-body text-[#59524A]"
              >
                {brandStats.map((b) => (
                  <span
                    key={b.brandId}
                    className="inline-flex items-center"
                  >
                    <span className="font-semibold text-[#1A3D2F] mr-1">{b.shortName} ·</span> {b.count}
                  </span>
                ))}
              </div>
            )}

            {/* Key TMDB Metadata (Omitted if missing) */}
            {(formattedBirthday || (!isDeceased && currentAge !== null) || (isDeceased && formattedDeathday) || actor.placeOfBirth || actor.knownForDepartment || actor.gender || actor.knownCredits !== undefined || actor.alsoKnownAs?.length) && (
              <div
                id="actor-metadata-grid"
                className="mt-5 pt-5 border-t border-[#E7DFD5] grid grid-cols-1 sm:grid-cols-2 gap-y-2.5 gap-x-6 text-sm text-[#59524A]"
              >
                {/* Born / Birthday */}
                {formattedBirthday && (
                  <div id="actor-meta-birthday">
                    <span className="font-semibold text-[#1A3D2F]">Born:</span>{' '}
                    <span>{formattedBirthday}</span>
                  </div>
                )}

                {/* Age (Living actors only; omitted for deceased) */}
                {!isDeceased && currentAge !== null && (
                  <div id="actor-meta-age">
                    <span className="font-semibold text-[#1A3D2F]">Age:</span>{' '}
                    <span>{currentAge}</span>
                  </div>
                )}

                {/* Died / Deathday (Deceased actors only) */}
                {isDeceased && formattedDeathday && (
                  <div id="actor-meta-deathday">
                    <span className="font-semibold text-[#1A3D2F]">Died:</span>{' '}
                    <span>{formattedDeathday}</span>
                  </div>
                )}

                {isDeceased && ageAtDeath !== null && (
                  <div id="actor-meta-age-at-death">
                    <span className="font-semibold text-[#1A3D2F]">Age at death:</span>{' '}
                    <span>{ageAtDeath}</span>
                  </div>
                )}

                {/* Place of Birth */}
                {actor.placeOfBirth && (
                  <div id="actor-meta-pob">
                    <span className="font-semibold text-[#1A3D2F]">Birthplace:</span>{' '}
                    <span>{actor.placeOfBirth}</span>
                  </div>
                )}
                {actor.knownForDepartment && <div id="actor-meta-known-for"><span className="font-semibold text-[#1A3D2F]">Known for:</span>{' '}<span>{actor.knownForDepartment}</span></div>}
                {actor.gender && <div id="actor-meta-gender"><span className="font-semibold text-[#1A3D2F]">Gender:</span>{' '}<span>{actor.gender}</span></div>}
                {actor.knownCredits !== undefined && <div id="actor-meta-known-credits"><span className="font-semibold text-[#1A3D2F]">Known credits:</span>{' '}<span>{actor.knownCredits}</span></div>}
                {actor.alsoKnownAs && actor.alsoKnownAs.length > 0 && <div id="actor-meta-aliases" className="sm:col-span-2"><span className="font-semibold text-[#1A3D2F]">Also known as:</span>{' '}<span>{actor.alsoKnownAs.join(', ')}</span></div>}
              </div>
            )}

            {/* TMDB Biography (ABOUT Section) - Omitted if not available */}
             {biography && (
              <div id="actor-biography-section" ref={biographyRef} className="mt-6 pt-5 border-t border-[#E7DFD5]">
                <h3 className="text-xs font-sans-clean font-semibold uppercase tracking-widest text-[#736B63] mb-2">
                  About
                </h3>
                <p className="font-body text-[#3F3A34] text-sm sm:text-base leading-relaxed max-w-3xl whitespace-pre-line">
                  {displayedBiography}
                </p>
                {shouldCollapseBiography && (
                  <button
                    type="button"
                    className="mt-3 text-sm font-sans-clean font-medium text-[#1A3D2F] hover:text-[#841818] hover:underline underline-offset-4 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1A3D2F]/40 rounded-sm"
                    aria-expanded={biographyExpanded}
                    onClick={() => {
                      const nextExpanded = !biographyExpanded;
                      setBiographyExpanded(nextExpanded);
                      if (!nextExpanded) {
                        requestAnimationFrame(() => biographyRef.current?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' }));
                      }
                    }}
                  >
                    {biographyExpanded ? 'Show less ↑' : 'Read more ↓'}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Holiday Filmography Section */}
      <section id="actor-filmography-section" className="mt-8 sm:mt-10">
        <div className="bg-[#EEF4EE] border-y border-[#C9D8CB] px-4 sm:px-5 py-5 sm:py-6 mb-6">
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
          <div>
            <h2 className="text-xs sm:text-sm font-sans-clean font-semibold uppercase tracking-[0.18em] text-[#1A3D2F]">
              Holiday Filmography
            </h2>
            <p className="text-sm sm:text-base text-[#736B63] font-body mt-1">
              {safeActingFilmography.length} {safeActingFilmography.length === 1 ? 'Christmas movie' : 'Christmas movies'} featuring {actor.name} in XmasDB
            </p>
          </div>

          <div className="flex flex-col items-start lg:items-end gap-2 self-start lg:self-auto">
            <NavigationLink
              href={getActorFeedPath(actor.tmdbPersonId)}
              className="text-xs sm:text-sm font-sans-clean font-medium text-[#1A3D2F] hover:text-[#143626]"
              title="XmasDB actor feed for Radarr and compatible tools"
            >
              JSON Feed <span className="xmas-nav-arrow">↗</span>
            </NavigationLink>

            {/* Dynamic Brand Filter (Only shown if movies span 2 or more brands) */}
            {brandStats.length > 1 && (
              <div
                id="actor-filmography-filter"
                className="flex items-center flex-wrap gap-x-3 gap-y-1 text-sm font-body"
              >
                <span className="text-[#6F675E] select-none">Filter:</span>
                <NavigationTab
                  id="filter-brand-all"
                  onClick={() => setSelectedBrandFilter('all')}
                  isActive={selectedBrandFilter === 'all'}
                  className={`py-1 text-sm transition-colors cursor-pointer ${
                    selectedBrandFilter === 'all'
                      ? 'font-semibold'
                      : 'text-[#59524A] hover:text-[#1A3D2F]'
                  }`}
                >
                  All
                </NavigationTab>
                {brandStats.map((b) => (
                  <React.Fragment key={b.brandId}>
                    <span className="text-[#C8BFB3] select-none">·</span>
                    <NavigationTab id={`filter-brand-${b.brandId}`} onClick={() => setSelectedBrandFilter(b.brandId)} isActive={selectedBrandFilter === b.brandId} className={`py-1 text-sm transition-colors cursor-pointer ${selectedBrandFilter === b.brandId ? 'font-semibold' : 'text-[#59524A] hover:text-[#1A3D2F]'}`}>
                      {b.shortName}
                    </NavigationTab>
                  </React.Fragment>
                ))}
              </div>
            )}
          </div>
        </div>
        </div>

        {safeActingFilmography.length > 0 && <section aria-labelledby="acting-heading"><h3 id="acting-heading" className="mb-4 text-base font-heading font-semibold text-[#1A3D2F]">Acting</h3>{renderFilmographyGrid(safeActingFilmography)}</section>}
        {safeDirectingFilmography.length > 0 && <section className="mt-10" aria-labelledby="directing-heading"><h3 id="directing-heading" className="mb-4 text-base font-heading font-semibold text-[#1A3D2F]">Directing</h3>{renderFilmographyGrid(safeDirectingFilmography)}</section>}
        {safeWritingFilmography.length > 0 && <section className="mt-10" aria-labelledby="writing-heading"><h3 id="writing-heading" className="mb-4 text-base font-heading font-semibold text-[#1A3D2F]">Writing</h3>{renderFilmographyGrid(safeWritingFilmography)}</section>}
      </section>
    </div>
  );
};
