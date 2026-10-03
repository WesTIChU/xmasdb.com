import React, { useEffect, useMemo, useState } from 'react';
import type { BirthdaysPayload } from '../api/types';
import { BirthdayCard } from './BirthdaySection';
import { birthdayDistance, parseBirthday, sortBirthdays } from '../utils/birthdays';

const MONTHS = Array.from({ length: 12 }, (_, index) => new Intl.DateTimeFormat('en-US', { month: 'long' }).format(new Date(2000, index, 1)));
const MONTH_SHORT = MONTHS.map((month) => month.slice(0, 3));

export const BirthdaysPage: React.FC<{ payload: BirthdaysPayload; onNavigate: (path: string) => void; search?: string }> = ({ payload, onNavigate, search = '' }) => {
  const actors = useMemo(() => sortBirthdays(payload.actors), [payload.actors]);
  const { today, week } = useMemo(() => ({
    today: actors.filter((actor) => birthdayDistance(actor.birthday) === 0),
    week: actors.filter((actor) => { const distance = birthdayDistance(actor.birthday); return distance !== null && distance > 0 && distance <= 7; }),
  }), [actors]);
  const params = new URLSearchParams(search);
  const requestedMonth = params.get('month');
  const initialMonth = requestedMonth === 'all' ? 'all' : Number(requestedMonth);
  const activeMonth: number | 'all' = Number.isInteger(initialMonth) && typeof initialMonth === 'number' && initialMonth >= 1 && initialMonth <= 12 ? initialMonth : (requestedMonth === 'all' ? 'all' : new Date().getMonth() + 1);
  const initialQuery = params.get('q') || '';
  const initialSort: 'popular' | 'date' | 'name' = params.get('sort') === 'date' || params.get('sort') === 'name' ? params.get('sort') as 'date' | 'name' : 'popular';
  const [query, setQuery] = useState(initialQuery);
  const [sort, setSort] = useState<'popular' | 'date' | 'name'>(initialSort);
  const [weekExpanded, setWeekExpanded] = useState(false);
  const [visibleCount, setVisibleCount] = useState(24);
  useEffect(() => {
    setQuery(initialQuery);
    setSort(initialSort);
  }, [initialQuery, initialSort]);
  useEffect(() => {
    setVisibleCount(24);
  }, [activeMonth, query, sort]);

  const updateFilters = (changes: Record<string, string | undefined>) => {
    const next = new URLSearchParams(search);
    for (const [key, value] of Object.entries(changes)) {
      if (value) next.set(key, value); else next.delete(key);
    }
    onNavigate(`/birthdays/?${next.toString()}`);
  };

  const filteredActors = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase();
    return actors
      .filter((actor) => activeMonth === 'all' || parseBirthday(actor.birthday)?.month === activeMonth)
      .filter((actor) => !normalizedQuery || actor.name.toLocaleLowerCase().includes(normalizedQuery))
      .sort((left, right) => {
        if (sort === 'popular') return right.popularity - left.popularity || left.name.localeCompare(right.name);
        if (sort === 'name') return left.name.localeCompare(right.name);
        const leftDate = parseBirthday(left.birthday); const rightDate = parseBirthday(right.birthday);
        return (leftDate && rightDate ? leftDate.month - rightDate.month || leftDate.day - rightDate.day : 0) || left.name.localeCompare(right.name);
      });
  }, [actors, activeMonth, query, sort]);
  const visibleActors = filteredActors.slice(0, visibleCount);
  const highlight = (title: string, entries: typeof actors) => <section aria-labelledby={`${title.replaceAll(' ', '-').toLowerCase()}-heading`}><h2 id={`${title.replaceAll(' ', '-').toLowerCase()}-heading`} className="mb-4 font-heading text-lg font-semibold text-[#1A3D2F]">{title}</h2><div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">{entries.map((actor) => <BirthdayCard key={actor.slug} actor={actor} onNavigate={onNavigate} />)}</div></section>;
  return <div className="py-7 sm:py-10"><header className="mb-9 text-center"><p className="font-sans-clean text-xs font-semibold uppercase tracking-[0.18em] text-[#8A6800]">The people behind the Christmas magic</p><h1 className="mt-1 font-heading text-2xl font-semibold text-[#1A3D2F] sm:text-3xl">Christmas Star Birthdays</h1><p className="mx-auto mt-2 max-w-xl font-body text-sm text-[#736B63]">Celebrate the Christmas actors in our local catalogue, with birthdays arranged by the calendar rather than by birth year.</p></header>
    <div className="space-y-9 border-b border-[#E7DFD5] pb-9">{highlight('Birthdays Today', today)}<section aria-labelledby="coming-up-this-week-heading"><h2 id="coming-up-this-week-heading" className="mb-4 font-heading text-lg font-semibold text-[#1A3D2F]">Coming Up This Week</h2><div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">{(weekExpanded ? week : week.slice(0, 6)).map((actor) => <BirthdayCard key={actor.slug} actor={actor} onNavigate={onNavigate} />)}</div>{week.length > 6 && <button type="button" onClick={() => setWeekExpanded((expanded) => !expanded)} className="mt-4 font-sans-clean text-xs font-medium text-[#1A3D2F] hover:text-[#841818]">{weekExpanded ? 'Show fewer birthdays' : `View all ${week.length - 6} birthdays this week`} <span aria-hidden="true">{weekExpanded ? '↑' : '→'}</span></button>}</section></div>
    <section className="mt-9" aria-labelledby="birthday-browser-heading"><div className="mb-5 flex flex-wrap items-end justify-between gap-3"><div><h2 id="birthday-browser-heading" className="font-heading text-xl font-semibold text-[#1A3D2F] sm:text-2xl">Browse Birthdays</h2><p className="mt-1 font-body text-xs text-[#736B63]">{filteredActors.length} {filteredActors.length === 1 ? 'birthday' : 'birthdays'}</p></div><label className="w-full sm:w-64"><span className="sr-only">Search birthdays</span><input value={query} onChange={(event) => { setQuery(event.target.value); updateFilters({ q: event.target.value || undefined }); }} placeholder="Search birthdays..." className="w-full rounded border border-[#DCD3C7] bg-[#FFFDF9] px-3 py-2 font-body text-sm text-[#1A3D2F] outline-none placeholder:text-[#9A9188] focus:border-[#B8860B]" /></label></div>
      <div className="mb-5 flex flex-wrap items-center gap-x-3 gap-y-2 border-y border-[#E7DFD5] py-3"><div className="flex min-w-0 flex-1 flex-wrap gap-x-2 gap-y-1 font-sans-clean text-xs"><button type="button" onClick={() => updateFilters({ month: 'all' })} className={`rounded px-1.5 py-1 ${activeMonth === 'all' ? 'font-semibold text-[#841818]' : 'text-[#6F675E] hover:text-[#1A3D2F]'}`}>All</button>{MONTH_SHORT.map((label, index) => <button type="button" key={label} onClick={() => updateFilters({ month: String(index + 1) })} className={`rounded px-1.5 py-1 ${activeMonth === index + 1 ? 'font-semibold text-[#841818]' : 'text-[#6F675E] hover:text-[#1A3D2F]'}`}>{label}</button>)}</div><label className="flex shrink-0 items-center gap-2 font-sans-clean text-xs text-[#736B63]">Sort<select value={sort} onChange={(event) => { const nextSort = event.target.value as 'popular' | 'date' | 'name'; setSort(nextSort); updateFilters({ sort: nextSort === 'popular' ? undefined : nextSort }); }} className="rounded border border-[#DCD3C7] bg-[#FFFDF9] px-2 py-1 text-[#1A3D2F] outline-none focus:border-[#B8860B]"><option value="popular">Most Movies</option><option value="date">Date</option><option value="name">Name</option></select></label></div>
      {filteredActors.length === 0 ? <p className="py-12 text-center font-body text-sm text-[#736B63]">No birthdays found.</p> : <><div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">{visibleActors.map((actor) => <BirthdayCard key={actor.slug} actor={actor} onNavigate={onNavigate} />)}</div>{visibleCount < filteredActors.length && <button type="button" onClick={() => setVisibleCount((count) => count + 24)} className="mx-auto mt-7 block rounded border border-[#DCD3C7] bg-[#FFFDF9] px-4 py-2 font-sans-clean text-xs font-medium text-[#1A3D2F] transition-colors hover:border-[#B8860B] hover:text-[#841818]">Show more birthdays</button>}</>}
    </section>
  </div>;
};
