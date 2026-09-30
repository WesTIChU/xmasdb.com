import React, { useState } from 'react';
import type { PopularActorsGroup } from '../api/types';
import { getBrandById } from '../data/brands';
import { getActorPath } from '../utils/urls';
import { NavigationTab } from './NavigationLink';
import { getHomepageActorSrcSet } from '../utils/homepage-images';
import { HollyDivider } from './HollyDivider';
import { resolveImageUrl } from '../utils/image-url';

interface PopularActorsSectionProps {
  groups: PopularActorsGroup[];
  onNavigate: (path: string) => void;
}

const ACTOR_SNOW_PARTICLES = ['❄', '·', '·', '❄', '·', '·', '❄', '·'];

const ActorCircularPortrait: React.FC<{
  actor: PopularActorsGroup['actors'][number];
  accentColor: string;
}> = ({ actor, accentColor }) => {
  const [imgError, setImgError] = useState(false);
  const photo = actor.photoUrl;
  const portraitPhoto = photo && !imgError ? resolveImageUrl(photo) : null;

  return (
    <div
      className="popular-actor-portrait relative mx-auto h-[108px] w-[108px] rounded-full border border-[#DDD3C6] bg-[#EFE9DF] xl:h-[96px] xl:w-[96px]"
      style={{ '--popular-actor-accent': accentColor } as React.CSSProperties}
    >
      <div className="relative z-0 h-full w-full overflow-hidden rounded-full">
        {portraitPhoto ? (
         <img src={portraitPhoto} srcSet={photo ? getHomepageActorSrcSet(photo) : undefined} sizes="(min-width: 1280px) 96px, 108px" alt={actor.name} loading="lazy" decoding="async" width={216} height={216} referrerPolicy="no-referrer" onError={() => setImgError(true)} className="h-full w-full object-cover object-center group-hover:scale-105 transition-transform duration-300" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-3xl font-heading text-[#1A3D2F]" aria-hidden="true">{actor.name.charAt(0)}</div>
        )}
      </div>
      <span className="popular-actor-snow" aria-hidden="true">
        {ACTOR_SNOW_PARTICLES.map((particle, index) => <span key={index}>{particle}</span>)}
      </span>
    </div>
  );
};

export const PopularActorsSection: React.FC<PopularActorsSectionProps> = ({ groups, onNavigate }) => {
  const availableBrands = groups
    .map((group) => ({ brand: getBrandById(group.brandId), actors: group.actors }))
    .filter((entry): entry is { brand: NonNullable<ReturnType<typeof getBrandById>>; actors: PopularActorsGroup['actors'] } => Boolean(entry.brand) && entry.actors.length > 0);

  const [selectedBrandId, setSelectedBrandId] = useState(availableBrands[0]?.brand.id || '');
  const selected = availableBrands.find(({ brand }) => brand.id === selectedBrandId) || availableBrands[0];
  if (!selected) return null;

  return (
    <section id="popular-christmas-stars-section" className="py-8 sm:py-10" aria-labelledby="popular-christmas-stars-heading">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-6">
        <div>
          <h2 id="popular-christmas-stars-heading" className="mt-1 font-heading text-xl sm:text-2xl font-semibold text-[#1A3D2F]">Popular Christmas Stars</h2>
        </div>
        <div className="flex flex-wrap gap-x-3 gap-y-1 text-sm font-body" role="tablist" aria-label="Popular stars by brand">
          {availableBrands.map(({ brand }, index) => (
            <React.Fragment key={brand.id}>
              {index > 0 && <span className="text-[#C8BFB3] select-none">·</span>}
              <NavigationTab role="tab" aria-selected={selected.brand.id === brand.id} isActive={selected.brand.id === brand.id} onClick={() => setSelectedBrandId(brand.id)} className={`cursor-pointer pb-1 transition-colors ${selected.brand.id === brand.id ? 'font-semibold' : 'text-[#6F675E] hover:text-[#1A3D2F]'}`}>
                {brand.shortName}
              </NavigationTab>
            </React.Fragment>
          ))}
        </div>
      </div>
      <div className="flex gap-4 sm:gap-5 overflow-x-auto pb-2 no-scrollbar -mx-4 px-4 sm:mx-0 sm:px-0 md:grid md:grid-cols-4 md:overflow-visible md:pb-0 xl:grid-cols-8 xl:gap-2 xl:px-2">
        {selected.actors.map((actor) => {
          const actorPath = getActorPath(actor.tmdbPersonId, actor.slug);
          return <article key={actor.slug} className="w-[120px] shrink-0 text-center md:w-full"><a href={actorPath} onClick={(event) => { event.preventDefault(); onNavigate(actorPath); }} className="group block text-center">
            <ActorCircularPortrait actor={actor} accentColor={selected.brand.accentColor || '#B8860B'} />
            <h3 className="mt-3 font-heading text-sm text-[#1A3D2F] group-hover:text-[#841818] leading-snug">{actor.name}</h3>
            <p className="mt-1 text-xs text-[#736B63] font-body">{actor.movieCount} {actor.movieCount === 1 ? 'movie' : 'movies'}</p>
          </a></article>;
        })}
      </div>
      <HollyDivider className="mt-4 -mb-4 sm:mt-5 sm:-mb-5" lineClassName="w-6 sm:w-8" ornamentClassName="h-4 w-12 sm:h-5 sm:w-14" />
    </section>
  );
};
