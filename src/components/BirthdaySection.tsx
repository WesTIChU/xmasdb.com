import React, { useState } from 'react';
import type { BirthdayActor } from '../api/types';
import { getActorPath } from '../utils/urls';
import { getHomepageActorSrcSet } from '../utils/homepage-images';
import { resolveImageUrl } from '../utils/image-url';
import { ageOnBirthday, birthdayDistance, parseBirthday } from '../utils/birthdays';
import { NavigationLink } from './NavigationLink';
import { HollyDivider } from './HollyDivider';

export const BirthdayPortrait: React.FC<{ actor: BirthdayActor }> = ({ actor }) => {
  const [failed, setFailed] = useState(false);
  const image = actor.photoUrl && !failed ? resolveImageUrl(actor.photoUrl) : undefined;
  return <div className="mx-auto h-[100px] w-[100px] overflow-hidden rounded-full border border-[#DDD3C6] bg-[#EFE9DF] transition-transform group-hover:-translate-y-0.5 group-hover:border-[#B8860B]">
    {image ? <img src={image} srcSet={actor.photoUrl ? getHomepageActorSrcSet(actor.photoUrl) : undefined} sizes="100px" alt={actor.name} loading="lazy" decoding="async" className="h-full w-full object-cover" onError={() => setFailed(true)} /> : <div className="flex h-full items-center justify-center font-heading text-2xl text-[#1A3D2F]">{actor.name.charAt(0)}</div>}
  </div>;
};

export const BirthdayCard: React.FC<{ actor: BirthdayActor; onNavigate: (path: string) => void; compact?: boolean }> = ({ actor, onNavigate, compact = false }) => {
  const date = parseBirthday(actor.birthday);
  const path = getActorPath(actor.tmdbPersonId, actor.slug);
  const formatted = date ? new Intl.DateTimeFormat('en-US', { month: 'long', day: 'numeric' }).format(new Date(2000, date.month - 1, date.day)) : actor.birthday;
  const age = ageOnBirthday(actor.birthday);
  const pattern = actor.tmdbPersonId % 3;
  return <a href={path} onClick={(event) => { event.preventDefault(); onNavigate(path); }} className={`group block text-center ${compact ? '' : `birthday-card birthday-card--${pattern} rounded border border-[#E4DACE] px-3 py-4`}`}>
    <BirthdayPortrait actor={actor} />
    <h3 className="mt-3 font-heading text-sm leading-snug text-[#1A3D2F] group-hover:text-[#841818]">{actor.name}</h3>
    <p className="mt-1 font-body text-xs text-[#736B63]">{formatted}{age !== null && <> · Turns {age}</>}</p>
  </a>;
};

export const BirthdaySection: React.FC<{ actors: BirthdayActor[]; onNavigate: (path: string) => void }> = ({ actors, onNavigate }) => {
  const upcoming = actors.slice(0, 10);
  if (upcoming.length === 0) return null;
  const today = upcoming.filter((actor) => birthdayDistance(actor.birthday) === 0);
  const tomorrow = upcoming.filter((actor) => birthdayDistance(actor.birthday) === 1);
  const later = upcoming.filter((actor) => { const distance = birthdayDistance(actor.birthday); return distance !== null && distance > 1; });
  const linkActor = (actor: BirthdayActor) => {
    const path = getActorPath(actor.tmdbPersonId, actor.slug);
    return <a href={path} onClick={(event) => { event.preventDefault(); onNavigate(path); }} className="font-semibold text-[#1A3D2F] underline decoration-[#B8860B]/50 underline-offset-2 hover:text-[#841818]">{actor.name}</a>;
  };
  const dateLabel = (actor: BirthdayActor) => {
    const date = parseBirthday(actor.birthday);
    return date ? new Intl.DateTimeFormat('en-US', { month: 'long', day: 'numeric' }).format(new Date(2000, date.month - 1, date.day)) : actor.birthday;
  };
  const actorDetail = (actor: BirthdayActor) => <div key={actor.slug} className="font-body text-sm leading-relaxed"><span>{linkActor(actor)}</span>{ageOnBirthday(actor.birthday) !== null && <span className="ml-1 text-[#736B63]">· Turns {ageOnBirthday(actor.birthday)}</span>}</div>;
  const group = (label: string, entries: BirthdayActor[], withIndividualDates = false, className = '') => <div className={className}><h3 className="font-sans-clean text-[10px] font-semibold uppercase tracking-[0.18em] text-[#8A6800]">{label}</h3>{entries.length > 0 && <div className="mt-2 space-y-1.5">{withIndividualDates ? entries.map((actor) => <div key={actor.slug}><p className="font-body text-xs font-semibold text-[#8A6800]">{dateLabel(actor)}</p>{actorDetail(actor)}</div>) : <><p className="font-body text-xs font-semibold text-[#8A6800]">{dateLabel(entries[0])}</p>{entries.map(actorDetail)}</>}</div>}</div>;
  return <section className="py-7 sm:py-9" aria-labelledby="birthdays-heading">
    <div className="mb-4 flex items-end justify-between gap-4">
      <div><p className="font-sans-clean text-xs font-semibold uppercase tracking-[0.18em] text-[#8A6800]">A little celebration</p><h2 id="birthdays-heading" className="mt-1 font-heading text-xl font-semibold text-[#1A3D2F] sm:text-2xl">Christmas Star Birthdays</h2></div>
      <NavigationLink href="/birthdays/" onNavigate={onNavigate} className="shrink-0 text-xs font-sans-clean font-medium text-[#1A3D2F] hover:text-[#841818] sm:text-sm">View all birthdays <span className="xmas-nav-arrow">→</span></NavigationLink>
    </div>
    <div className="grid gap-5 border-y border-[#E7DFD5] py-4 md:grid-cols-3 md:gap-0">
      {group('Today', today, false, 'md:pr-6')}
      {group('Tomorrow', tomorrow, false, 'border-t border-[#E7DFD5] pt-4 md:border-l md:border-t-0 md:px-6 md:pt-0')}
      {group('Coming up', later, true, 'border-t border-[#E7DFD5] pt-4 md:border-l md:border-t-0 md:pl-6 md:pt-0')}
    </div>
    <HollyDivider className="homepage-holly-divider" lineClassName="w-6 sm:w-8" ornamentClassName="h-4 w-12 sm:h-5 sm:w-14" />
  </section>;
};
