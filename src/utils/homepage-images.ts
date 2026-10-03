import homepagePosterIds from '../data/homepage-poster-ids';
import birthdayActorIds from '../data/birthday-actor-ids';
import optimizedActorIds from '../data/optimized-actor-ids';
import { resolveImageUrl } from './image-url';

export function getHomepageManifestIds(currentIds: Iterable<string>, previouslyPublishedIds: Set<string>, publishR2: boolean): string[] {
  const ids = [...currentIds];
  return (publishR2 ? ids : ids.filter((id) => previouslyPublishedIds.has(id))).sort((left, right) => Number(left) - Number(right));
}

export function getHomepagePosterSrcSet(url: string): string | undefined {
  const match = url.match(/^\/images\/posters\/(\d+)(?:-[^/]+)?\.jpg$/);
  if (!match || !homepagePosterIds.has(match[1])) return undefined;
  return `${resolveImageUrl(`/images/optimized/posters/${match[1]}-320.webp`)} 320w, ${resolveImageUrl(url)} 500w`;
}

export function getHomepageActorSrcSet(url: string): string | undefined {
  const match = url.match(/^\/images\/people\/(\d+)\.webp$/);
  if (!match || !optimizedActorIds.has(match[1])) return undefined;
  return `${resolveImageUrl(`/images/optimized/people/${match[1]}-216.webp`)} 216w, ${resolveImageUrl(url)} 500w`;
}

export function getBirthdayActorSrcSet(url: string): string | undefined {
  const match = url.match(/^\/images\/people\/(\d+)\.webp$/);
  if (!match || !birthdayActorIds.has(match[1])) return undefined;
  return `${resolveImageUrl(`/images/birthdays/${match[1]}-216.webp`)} 216w, ${resolveImageUrl(url)} 500w`;
}
