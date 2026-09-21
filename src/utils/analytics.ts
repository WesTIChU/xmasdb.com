const GOATCOUNTER_ENDPOINT = 'https://stats.xmasdb.com/count';
const GOATCOUNTER_SCRIPT = '//stats.xmasdb.com/count.js';

interface GoatCounterOptions {
  path?: string;
  title?: string;
}

interface GoatCounter {
  no_onload?: boolean;
  count?: (options?: GoatCounterOptions) => void;
}

declare global {
  interface Window {
    goatcounter?: GoatCounter;
  }
}

let goatCounterLoad: Promise<void> | null = null;

export function isGoatCounterRouteAllowed(routeType: string, pathname = ''): boolean {
  return !routeType.startsWith('admin-') && !/^\/admin(?:\/|$)/i.test(pathname);
}

export function getGoatCounterPagePath(pathname: string, search = ''): string {
  return `${pathname || '/'}${search}`;
}

function loadGoatCounter(): Promise<void> {
  if (typeof window === 'undefined' || typeof document === 'undefined') return Promise.resolve();
  if (window.goatcounter?.count) return Promise.resolve();
  if (goatCounterLoad) return goatCounterLoad;

  window.goatcounter = { no_onload: true };
  goatCounterLoad = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.async = true;
    script.src = GOATCOUNTER_SCRIPT;
    script.dataset.goatcounter = GOATCOUNTER_ENDPOINT;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('GoatCounter failed to load.'));
    document.head.appendChild(script);
  });
  return goatCounterLoad;
}

export async function trackGoatCounterPageView(path: string, title: string): Promise<void> {
  if (typeof window === 'undefined') return;
  try {
    await loadGoatCounter();
    window.goatcounter?.count?.({ path, title });
  } catch {
    // Analytics failures must never affect the application.
  }
}
