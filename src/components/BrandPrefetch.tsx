import React, { useEffect } from 'react';
import type { MetaBrand } from '../api/types';
import { catalogueUrl, fetchCatalogue } from '../api/client';

interface BrandPrefetchProps {
  /** Populated brands from catalogue metadata. */
  brands: MetaBrand[];
  /** Brand currently on screen; its posters are already loading, so skip it. */
  activeBrandId: string | null;
}

/** How many above-the-fold posters to warm for each other brand. */
const PREFETCH_PER_BRAND = 4;

const warmPosters = new Set<string>();

/**
 * After the initial page is idle, warm the other brand listings and their
 * first visible posters so switching Hallmark/Lifetime/GAF renders from the
 * shared client cache instead of waiting on the network. Rendering is never
 * blocked: the work is deferred to requestIdleCallback (with a timeout
 * fallback) and each image is low priority.
 */
export const BrandPrefetch: React.FC<BrandPrefetchProps> = ({ brands, activeBrandId }) => {
  useEffect(() => {
    let cancelled = false;

    const warm = () => {
      if (cancelled || typeof window === 'undefined') return;
      for (const brand of brands) {
        if (brand.id === activeBrandId) continue;
        fetchCatalogue(catalogueUrl(`?brand=${brand.slug}`))
          .then((listing) => {
            if (cancelled) return;
            const posters = listing.movies
              .slice(0, PREFETCH_PER_BRAND)
              .map((movie) => movie.posterUrl)
              .filter(
                (url): url is string =>
                  Boolean(url) && !url!.toLowerCase().includes('placeholder')
              );
            for (const url of posters) {
              if (warmPosters.has(url)) continue;
              warmPosters.add(url);
              const image = new Image();
              image.decoding = 'async';
              image.src = url;
            }
          })
          .catch(() => undefined);
      }
    };

    type IdleWindow = Window & {
      requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number;
      cancelIdleCallback?: (handle: number) => void;
    };
    const idleWindow = window as IdleWindow;

    if (typeof idleWindow.requestIdleCallback === 'function') {
      const handle = idleWindow.requestIdleCallback(warm, { timeout: 3000 });
      return () => {
        cancelled = true;
        idleWindow.cancelIdleCallback?.(handle);
      };
    }

    const timer = window.setTimeout(warm, 1500);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [brands, activeBrandId]);

  return null;
};
