import React, { useMemo, useState } from 'react';
import type { CalendarMovie, CalendarPayload } from '../api/types';
import { getMoviePath } from '../utils/urls';
import { HollyDivider } from './HollyDivider';

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
    <span className="flex h-[22px] w-[104px] shrink-0 items-center justify-end sm:w-[112px]" role="img" aria-label={`${fullName} logo`} title={fullName}>
      <svg viewBox="0 0 140 24" className="h-[22px] max-w-full" aria-hidden="true" focusable="false">
        <title>{fullName}</title>
        {networkId === 'hallmark' && <text x="140" y="18" textAnchor="end" fill="#841818" fontFamily="Georgia, serif" fontSize="19" fontStyle="italic" fontWeight="bold">Hallmark</text>}
        {networkId === 'lifetime' && <text x="140" y="17" textAnchor="end" fill="#841818" fontFamily="Arial, sans-serif" fontSize="17" fontWeight="bold" letterSpacing="0.3">LIFETIME</text>}
        {networkId === 'gaf' && <><text x="140" y="14" textAnchor="end" fill="#1A3D2F" fontFamily="Georgia, serif" fontSize="17" fontWeight="bold">GAF</text><text x="140" y="22" textAnchor="end" fill="#B8860B" fontFamily="Arial, sans-serif" fontSize="5.5" fontWeight="bold" letterSpacing="0.7">GREAT AMERICAN FAMILY</text></>}
        {networkId === 'uptv' && <text x="140" y="18" textAnchor="end" fill="#1A3D2F" fontFamily="Arial, sans-serif" fontSize="19" fontWeight="bold">UPtv</text>}
      </svg>
    </span>
  );
};

export const CalendarPage: React.FC<{ payload: CalendarPayload; onNavigate: (path: string) => void }> = ({ payload, onNavigate }) => {
  const [year, setYear] = useState(payload.activeYear);
  const [network, setNetwork] = useState('all');
  const filtered = useMemo(() => payload.movies.filter((movie) => {
    const inYear = movie.dateKey ? Number(movie.dateKey.slice(0, 4)) === year : movie.year === year;
    return inYear && (network === 'all' || movie.brandId === network);
  }), [network, payload.movies, year]);
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
        <a href={pdfUrl} className="border border-[#841818] px-4 py-1.5 font-sans-clean text-xs font-semibold tracking-wide text-[#841818] hover:bg-[#F7EDEA]">Download PDF</a>
      </section>

      <div className="mx-auto mt-8 max-w-3xl">
        <p className="mb-3 font-sans-clean text-xs leading-5 text-[#8A8177]">Premiere dates can change. This calendar is kept up to date with the latest information in XmasDB.</p>
        <div className="mb-5 flex items-baseline gap-2"><h2 className="font-heading text-xl font-semibold text-[#1A3D2F]">{year} Season</h2><span className="font-sans-clean text-xs tracking-[0.08em] text-[#8A8177]">·</span><p className="font-sans-clean text-xs uppercase tracking-[0.08em] text-[#736B63]">{dated.length + tba.length} {dated.length + tba.length === 1 ? 'Movie' : 'Movies'}</p></div>
        {dated.length === 0 && tba.length === 0 && <p className="border-y border-[#E7DFD5] py-8 text-center font-body text-[#736B63]">No calendar entries match these filters.</p>}
        <div className="space-y-5">
          {[...groups.entries()].map(([dateKey, movies]) => <section key={dateKey} className="calendar-date-group" aria-labelledby={`date-${dateKey}`}>
            <div className="border-b border-[#B8860B]/80 pb-2"><div className="flex items-center gap-3"><h3 id={`date-${dateKey}`} className="font-heading text-sm font-semibold tracking-[0.08em] text-[#841818]">{dateLabel(dateKey)}</h3><span className="font-sans-clean text-[9px] uppercase tracking-[0.12em] text-[#8A8177]">{isPast(dateKey) ? 'Premiered' : 'Upcoming'}</span></div></div>
            <ul className="divide-y divide-[#E7DFD5]">{movies.map((movie) => <li key={movie.tmdbId} className="flex items-baseline justify-between gap-4 py-[13px]"><a href={getMoviePath(movie.tmdbId, movie.slug)} onClick={(event) => { event.preventDefault(); onNavigate(getMoviePath(movie.tmdbId, movie.slug)); }} className="min-w-0 font-body text-[15px] text-[#1A3D2F] underline decoration-[#B8860B]/60 underline-offset-2 hover:text-[#841818]">{movie.title}</a><span className="flex h-[22px] shrink-0 items-center border-l border-[#B8860B]/50 pl-2"><NetworkLogo networkId={movie.brandId} /></span></li>)}</ul>
          </section>)}
        </div>
        {tba.length > 0 && <section className="mt-9 border-t-2 border-[#DCD3C7] pt-4" aria-labelledby="calendar-tba-heading"><h3 id="calendar-tba-heading" className="font-heading text-sm font-semibold tracking-[0.08em] text-[#1A3D2F]">DATE TBA</h3><ul className="divide-y divide-[#E7DFD5]">{tba.map((movie) => <li key={movie.tmdbId} className="flex items-baseline justify-between gap-4 py-[13px]"><a href={getMoviePath(movie.tmdbId, movie.slug)} onClick={(event) => { event.preventDefault(); onNavigate(getMoviePath(movie.tmdbId, movie.slug)); }} className="min-w-0 font-body text-[15px] text-[#1A3D2F] underline decoration-[#B8860B]/60 underline-offset-2 hover:text-[#841818]">{movie.title}</a><span className="flex h-[22px] shrink-0 items-center border-l border-[#B8860B]/50 pl-2"><NetworkLogo networkId={movie.brandId} /></span></li>)}</ul></section>}
        <p className="mt-8 border-t border-[#E7DFD5] pt-4 font-sans-clean text-xs leading-5 text-[#8A8177]">Past premieres remain listed so this calendar can serve as a season schedule and watchlist. Times are shown only when reliable structured data is available.</p>
      </div>
    </article>
  );
};
