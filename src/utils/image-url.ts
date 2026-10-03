const DEFAULT_PUBLIC_IMAGE_BASE_URL = 'https://images.xmasdb.com';
const MANAGED_IMAGE_PATH = /^\/images\/(?:posters|backdrops|people|birthdays|optimized\/posters|optimized\/people)\//;

export function configuredPublicImageBaseUrl(): string {
  const serverBaseUrl = typeof process !== 'undefined' ? process.env?.R2_PUBLIC_BASE_URL : undefined;
  return (serverBaseUrl || DEFAULT_PUBLIC_IMAGE_BASE_URL).replace(/\/$/, '');
}

/** Converts canonical managed image paths to their public R2 URLs. */
export function resolveImageUrl(imageReference: string | undefined | null): string | undefined {
  if (!imageReference) return undefined;
  if (!MANAGED_IMAGE_PATH.test(imageReference)) return imageReference;
  return `${configuredPublicImageBaseUrl()}${imageReference.slice('/images'.length)}`;
}
