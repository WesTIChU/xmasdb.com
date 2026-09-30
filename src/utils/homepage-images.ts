import homepagePosterIds from '../data/homepage-poster-ids';
import { resolveImageUrl } from './image-url';

const optimizedHomepageActorIds = new Set([
  '22082',
  '218923',
  '589182',
  '134673',
  '62909',
  '122888',
  '1292329',
  '104646',
  '43265',
  '78501',
  '4568',
  '43426',
  '35472',
  '168750',
  '92856',
  '2120306',
  '31363',
  '169469',
  '151975',
  '82943',
  '1751311',
  '2081445',
  '1233560',
  '33669',
]);

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
  if (!match || !optimizedHomepageActorIds.has(match[1])) return undefined;
  return `${resolveImageUrl(`/images/optimized/people/${match[1]}-216.webp`)} 216w, ${resolveImageUrl(url)} 500w`;
}
