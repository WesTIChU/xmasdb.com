import React, { useState } from 'react';
import type { PopularActorsGroup } from '../api/types';
import { getBrandById } from '../data/brands';
import { getActorPath } from '../utils/urls';
import { NavigationTab } from './NavigationLink';

interface PopularActorsSectionProps {
  groups: PopularActorsGroup[];
  onNavigate: (path: string) => void;
}

const ActorCircularPortrait: React.FC<{ actor: PopularActorsGroup['actors'][number] }> = ({ actor }) => {
  const [imgError, setImgError] = useState(false);
  const photo = actor.photoUrl;
  if (imgError || !photo) return <div className="w-[108px] h-[108px] xl:w-[96px] xl:h-[96px] rounded-full mx-auto flex items-center justify-center bg-[#EFE9DF] border border-[#DDD3C6] text-[#1A3D2F] font-heading text-3xl" aria-hidden="true">{actor.name.charAt(0)}</div>;
  return <div className="w-[108px] h-[108px] xl:w-[96px] xl:h-[96px] rounded-full mx-auto overflow-hidden bg-[#EFE9DF] border border-[#DDD3C6]"><img src={photo} alt={actor.name} loading="lazy" referrerPolicy="no-referrer" onError={() => setImgError(true)} className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-300" /></div>;
};

export const PopularActorsSection: React.FC<PopularActorsSectionProps> = ({ groups, onNavigate }) => {
  const availableBrands = groups
    .map((group) => ({ brand: getBrandById(group.brandId), actors: group.actors }))
    .filter((entry): entry is { brand: NonNullable<ReturnType<typeof getBrandById>>; actors: PopularActorsGroup['actors'] } => Boolean(entry.brand) && entry.actors.length > 0);

  const [selectedBrandId, setSelectedBrandId] = useState(availableBrands[0]?.brand.id || '');
  const selected = availableBrands.find(({ brand }) => brand.id === selectedBrandId) || availableBrands[0];
  if (!selected) return null;

  return (
    <section id="popular-christmas-stars-section" className="py-8 sm:py-10 border-b border-[#E7DFD5]" aria-labelledby="popular-christmas-stars-heading">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-6">
        <div>
          <p className="font-sans-clean text-xs font-semibold uppercase tracking-[0.18em] text-[#736B63]">The people behind the stories</p>
          <h2 id="popular-christmas-stars-heading" className="mt-1 font-heading text-xl sm:text-2xl font-semibold text-[#1A3D2F]">Popular Christmas Stars</h2>
        </div>
        <div className="flex flex-wrap gap-x-3 gap-y-1 text-sm font-body" role="tablist" aria-label="Popular stars by brand">
          {availableBrands.map(({ brand }, index) => (
            <React.Fragment key={brand.id}>
              {index > 0 && <span className="text-[#C8BFB3] select-none">·</span>}
              <NavigationTab role="tab" aria-selected={selected.brand.id === brand.id} isActive={selected.brand.id === brand.id} onClick={() => setSelectedBrandId(brand.id)} className={`cursor-pointer pb-1 transition-colors ${selected.brand.id === brand.id ? 'font-semibold' : 'text-[#8C8379] hover:text-[#1A3D2F]'}`}>
                {brand.shortName}
              </NavigationTab>
            </React.Fragment>
          ))}
        </div>
      </div>
      <div className="flex gap-4 sm:gap-5 overflow-x-auto pb-2 no-scrollbar -mx-4 px-4 sm:mx-0 sm:px-0 md:grid md:grid-cols-4 md:overflow-visible md:pb-0 xl:grid-cols-8 xl:gap-3">
        {selected.actors.map((actor) => {
          const actorPath = getActorPath(actor.tmdbPersonId, actor.slug);
          return <article key={actor.slug} className="w-[120px] shrink-0 text-center md:w-full"><a href={actorPath} onClick={(event) => { event.preventDefault(); onNavigate(actorPath); }} className="group block text-center">
            <ActorCircularPortrait actor={actor} />
            <h3 className="mt-3 font-heading text-sm text-[#1A3D2F] group-hover:text-[#841818] leading-snug">{actor.name}</h3>
            <p className="mt-1 text-xs text-[#736B63] font-body">{actor.movieCount} {actor.movieCount === 1 ? 'Christmas movie' : 'Christmas movies'}</p>
          </a></article>;
        })}
      </div>
    </section>
  );
};
