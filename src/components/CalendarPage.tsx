import React, { useMemo, useState } from 'react';
import type { CalendarMovie, CalendarPayload } from '../api/types';
import { getMoviePath, getNetworkPath } from '../utils/urls';
import { HollyDivider } from './HollyDivider';
import { NavSquiggle } from './NavigationLink';
import { getCalendarAlternativeTitle } from '../utils/calendar';

const NETWORKS = [
  { id: 'hallmark', label: 'Hallmark' },
  { id: 'lifetime', label: 'Lifetime' },
  { id: 'gaf', label: 'GAF' },
  { id: 'uptv', label: 'UPtv' },
];

function dateLabel(dateKey: string): string {
  const [year, month, day] = dateKey.split('-').map(Number);
  return new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'long', day: 'numeric', timeZone: 'UTC' })
    .format(new Date(Date.UTC(year, month - 1, day))).toUpperCase();
}

function isPast(dateKey: string): boolean {
  const now = new Date();
  const today = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}-${String(now.getUTCDate()).padStart(2, '0')}`;
  return dateKey < today;
}

function networkLabel(id: string): string {
  return NETWORKS.find((network) => network.id === id)?.label || id;
}

function networkFullName(id: string): string {
  return id === 'gaf' ? 'Great American Family' : networkLabel(id);
}

const NetworkLogo: React.FC<{ networkId: string }> = ({ networkId }) => {
  const fullName = networkFullName(networkId);
  return (
    <span className="relative flex h-[42px] w-[170px] shrink-0 cursor-pointer items-center justify-center rounded-md border border-[#B8860B]/35 bg-[#FFFDF9]/85 px-1.5 py-0 transition-colors duration-150 group-hover:border-[#B8860B]/65 group-hover:bg-[#FFFDF9] group-focus-visible:border-[#B8860B] group-focus-visible:bg-[#FFF8E8] group-focus-visible:outline group-focus-visible:outline-2 group-focus-visible:outline-offset-2 group-focus-visible:outline-[#B8860B] before:absolute before:left-1 before:top-1 before:h-1 before:w-1 before:border-l before:border-t before:border-[#B8860B]/45 after:absolute after:bottom-1 after:right-1 after:h-1 after:w-1 after:border-b after:border-r after:border-[#B8860B]/45 sm:w-[180px]" role="img" aria-label={`${fullName} logo`} title={fullName}>
      <svg viewBox="0 0 140 24" className="h-[36px] max-w-full" aria-hidden="true" focusable="false">
        <title>{fullName}</title>
        {networkId === 'hallmark' && <text x="70" y="18" textAnchor="middle" fill="#841818" fontFamily="Georgia, serif" fontSize="19" fontStyle="italic" fontWeight="bold">Hallmark</text>}
        {networkId === 'lifetime' && <text x="70" y="17" textAnchor="middle" fill="#841818" fontFamily="Arial, sans-serif" fontSize="17" fontWeight="bold" letterSpacing="0.3">LIFETIME</text>}
        {networkId === 'gaf' && <><text x="70" y="14" textAnchor="middle" fill="#1A3D2F" fontFamily="Georgia, serif" fontSize="17" fontWeight="bold">GAF</text><text x="70" y="22" textAnchor="middle" fill="#B8860B" fontFamily="Arial, sans-serif" fontSize="5.5" fontWeight="bold" letterSpacing="0.7">GREAT AMERICAN FAMILY</text></>}
        {networkId === 'uptv' && <text x="70" y="18" textAnchor="middle" fill="#1A3D2F" fontFamily="Arial, sans-serif" fontSize="19" fontWeight="bold">UPtv</text>}
      </svg>
    </span>
  );
};

const NetworkLogoLink: React.FC<{ networkId: string; onNavigate: (path: string) => void }> = ({ networkId, onNavigate }) => {
  const fullName = networkFullName(networkId);
  const path = getNetworkPath(networkId);
  return <a href={path} onClick={(event) => { event.preventDefault(); onNavigate(path); }} aria-label={`View ${fullName} Christmas movies`} className="group inline-flex focus-visible:outline-none"><NetworkLogo networkId={networkId} /></a>;
};

export const CalendarPage: React.FC<{ payload: CalendarPayload; onNavigate: (path: string) => void }> = ({ payload, onNavigate }) => {
  const [year, setYear] = useState(payload.activeYear);
  const [network, setNetwork] = useState('all');
  const [showPremiered, setShowPremiered] = useState(false);
  const filtered = useMemo(() => payload.movies.filter((movie) => {
    const inYear = movie.dateKey ? Number(movie.dateKey.slice(0, 4)) === year : movie.year === year;
    const isPremiered = movie.dateKey ? isPast(movie.dateKey) : false;
    return inYear && (network === 'all' || movie.brandId === network) && (showPremiered || !isPremiered);
  }), [network, payload.movies, showPremiered, year]);
  const dated = useMemo(() => filtered.filter((movie): movie is CalendarMovie & { dateKey: string } => Boolean(movie.dateKey)).sort((a, b) => a.dateKey.localeCompare(b.dateKey) || a.title.localeCompare(b.title)), [filtered]);
  const tba = filtered.filter((movie) => !movie.dateKey);
  const groups = useMemo(() => {
    const result = new Map<string, typeof dated>();
    dated.forEach((movie) => result.set(movie.dateKey, [...(result.get(movie.dateKey) || []), movie]));
    return result;
  }, [dated]);
  const pdfUrl = `/calendar.pdf?year=${year}${network === 'all' ? '' : `&network=${encodeURIComponent(network)}`}`;

  return (
    <article className="calendar-page py-8 sm:py-12" aria-labelledby="calendar-heading">
      <header className="mx-auto max-w-3xl text-center">
        <p className="font-sans-clean text-xs font-semibold tracking-[0.22em] text-[#841818]">XMASDB · SEASON GUIDE</p>
        <h1 id="calendar-heading" className="mt-3 font-heading text-2xl font-semibold tracking-wide text-[#1A3D2F] sm:text-4xl">CHRISTMAS MOVIE RELEASE CALENDAR</h1>
        <p className="mx-auto mt-4 max-w-2xl font-body text-sm leading-6 text-[#736B63] sm:text-base">Keep track of the Christmas movies coming to Hallmark, Lifetime, Great American Family and UPtv.</p>
        <div className="mt-6"><HollyDivider /></div>
      </header>

      <section className="calendar-controls mx-auto mt-7 flex max-w-3xl flex-wrap items-center justify-center gap-3 border-y border-[#E7DFD5] py-4 print:hidden" aria-label="Calendar filters">
        <label className="font-sans-clean text-sm text-[#403A34]">Season <select value={year} onChange={(event) => setYear(Number(event.target.value))} className="ml-1 rounded border border-[#DCD3C7] bg-[#FFFDF9] px-2 py-1.5 text-[#1A3D2F]">{payload.years.map((option) => <option key={option} value={option}>{option}</option>)}</select></label>
         <div className="flex flex-wrap justify-center gap-1.5" role="group" aria-label="Network filter">
           {['all', ...NETWORKS.map((item) => item.id)].map((id) => <button key={id} type="button" onClick={() => setNetwork(id)} className={`border px-3 py-1.5 font-sans-clean text-xs transition-colors ${network === id ? 'border-[#1A3D2F] bg-[#1A3D2F] text-[#FFFDF9]' : 'border-[#DCD3C7] bg-[#FFFDF9] text-[#4A433B] hover:border-[#1A3D2F]'}`}>{id === 'all' ? 'All' : networkLabel(id)}</button>)}
         </div>
         <label className="flex items-center gap-1.5 font-sans-clean text-sm text-[#403A34]"><input type="checkbox" checked={showPremiered} onChange={(event) => setShowPremiered(event.target.checked)} /> Show premiered</label>
         <a href={pdfUrl} className="border border-[#841818] px-4 py-1.5 font-sans-clean text-xs font-semibold tracking-wide text-[#841818] hover:bg-[#F7EDEA]">Download PDF</a>
      </section>

      <div className="mx-auto mt-8 max-w-3xl">
        <p className="mb-3 font-sans-clean text-xs leading-5 text-[#8A8177]">Premiere dates can change. This calendar is kept up to date with the latest information in XmasDB.</p>
        <div className="mb-5 flex items-baseline gap-2"><h2 className="font-heading text-xl font-semibold text-[#1A3D2F]">{year} Season</h2><span className="font-sans-clean text-xs tracking-[0.08em] text-[#8A8177]">·</span><p className="font-sans-clean text-xs uppercase tracking-[0.08em] text-[#736B63]">{dated.length + tba.length} {dated.length + tba.length === 1 ? 'Movie' : 'Movies'}</p></div>
        {dated.length === 0 && tba.length === 0 && <p className="border-y border-[#E7DFD5] py-8 text-center font-body text-[#736B63]">No calendar entries match these filters.</p>}
        <div className="space-y-5">
          {[...groups.entries()].map(([dateKey, movies]) => <section key={dateKey} className="calendar-date-group" aria-labelledby={`date-${dateKey}`}>
            <div className="border-b border-[#B8860B]/80 pb-2"><div className="flex items-center gap-3"><h3 id={`date-${dateKey}`} className="font-heading text-sm font-semibold tracking-[0.08em] text-[#841818]">{dateLabel(dateKey)}</h3><span className="font-sans-clean text-[9px] font-bold uppercase tracking-[0.12em] text-[#8A8177]">{isPast(dateKey) ? 'Premiered' : 'Upcoming'}</span></div></div>
            <ul className="divide-y divide-[#E7DFD5]">{movies.map((movie) => <li key={movie.tmdbId} className="flex items-center justify-between gap-4 py-[13px]"><a href={getMoviePath(movie.tmdbId, movie.slug)} onClick={(event) => { event.preventDefault(); onNavigate(getMoviePath(movie.tmdbId, movie.slug)); }} className="calendar-movie-link group min-w-0 font-body text-[15px] leading-tight text-[#1A3D2F] no-underline focus-visible:underline focus-visible:underline-offset-2 hover:text-[#841818]"><span className="relative inline-block sm:text-base"><span>{movie.title}</span><NavSquiggle /></span>{getCalendarAlternativeTitle(movie) && <span className="mt-1 block font-body text-xs italic leading-snug text-[#736B63] no-underline sm:text-[13px]"><span>Also known as: </span><span className="font-medium text-[#59524A]">{getCalendarAlternativeTitle(movie)}</span></span>}</a><span className="flex h-[34px] shrink-0 items-center border-l border-[#B8860B]/50 pl-2"><NetworkLogoLink networkId={movie.brandId} onNavigate={onNavigate} /></span></li>)}</ul>
          </section>)}
        </div>
         {tba.length > 0 && <section className="mt-9 border-t-2 border-[#DCD3C7] pt-4" aria-labelledby="calendar-tba-heading"><h3 id="calendar-tba-heading" className="font-heading text-sm font-semibold tracking-[0.08em] text-[#1A3D2F]">DATE TBA</h3><ul className="divide-y divide-[#E7DFD5]">{tba.map((movie) => <li key={movie.tmdbId} className="flex items-center justify-between gap-4 py-[13px]"><a href={getMoviePath(movie.tmdbId, movie.slug)} onClick={(event) => { event.preventDefault(); onNavigate(getMoviePath(movie.tmdbId, movie.slug)); }} className="min-w-0 font-body text-[15px] text-[#1A3D2F] underline decoration-[#B8860B]/60 underline-offset-2 hover:text-[#841818]">{movie.title}</a><span className="flex h-[42px] shrink-0 items-center border-l border-[#B8860B]/50 pl-2"><NetworkLogoLink networkId={movie.brandId} onNavigate={onNavigate} /></span></li>)}</ul></section>}
        <p className="mt-8 border-t border-[#E7DFD5] pt-4 font-sans-clean text-xs leading-5 text-[#8A8177]">Past premieres remain listed so this calendar can serve as a season schedule and watchlist. Times are shown only when reliable structured data is available.</p>
      </div>
    </article>
  );
};
