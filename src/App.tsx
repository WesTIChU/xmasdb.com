import { lazy, Suspense, useState, useEffect, useMemo, useRef } from 'react';
import { Header } from './components/Header';
import { YearFilter } from './components/YearFilter';
import { MovieGrid } from './components/MovieGrid';
import { CatalogueControls } from './components/CatalogueControls';
import { CataloguePagination } from './components/CataloguePagination';
import { HomePage } from './components/HomePage';
import { Footer } from './components/Footer';
import { SnowEffect } from './components/SnowEffect';
import { ScrollToTopButton } from './components/ScrollToTopButton';
import { CatalogueStatsStrip } from './components/CatalogueStatsStrip';
import { BrandPrefetch } from './components/BrandPrefetch';
import { NotFoundPage } from './components/NotFoundPage';
import { ContactPage } from './components/ContactPage';
import type {
  CatalogueMeta,
  MetaBrand,
  SearchResultsPayload,
} from './api/types';
import {
  isActorDetailPayload,
  isAboutPayload,
  isContactPayload,
  isCatalogueListingPayload,
  isFingerprintListingPayload,
  isFeedsMetaPayload,
  isHomePayload,
  isMovieDetailPayload,
  isPrivacyPayload,
} from './api/guards';
import {
  ApiError,
  FEEDS_META_URL,
  ABOUT_URL,
  PRIVACY_URL,
  actorUrl,
  catalogueUrl,
  fetchSearchResults,
  fetchUrl,
  getCatalogueMetaSnapshot,
  loadCatalogueMeta,
  movieUrl,
  peekResolved,
} from './api/client';
import { getBrandBySlug } from './data/brands';
import { getFingerprintById } from './data/fingerprints';
import { FingerprintChips } from './components/FingerprintChips';
import {
  getMoviePath,
  getActorPath,
  getNetworkPath,
  getYearPath,
  getMoviesPath,
  getFingerprintPath,
} from './utils/urls';
import {
  buildActorSeo,
  buildAboutSeo,
  buildContactSeo,
  buildPrivacySeo,
  buildBrandSeo,
  buildFeedsSeo,
  buildHomeSeo,
  buildMoviesSeo,
  buildMovieSeo,
  buildNotFoundSeo,
  buildYearSeo,
  updateSeoTags,
} from './utils/seo';
import { buildCatalogueUrl, parseCatalogueQuery } from './utils/catalogue-pagination';
import { scoreActorSearchResult, scoreListingMovieTitle } from './utils/search-relevance';
import { getGoatCounterPagePath, isGoatCounterRouteAllowed, trackGoatCounterPageView } from './utils/analytics';

/**
 * Route identity only — no catalogue data. Data is resolved separately from the
 * lightweight API so the full catalogue never ships in the browser bundle.
 */
type RouteDescriptor =
  | { type: 'home' }
  | { type: 'movies' }
  | { type: 'year-archive'; year: number }
  | { type: 'brand'; slug: string; year: number | null }
  | { type: 'fingerprint'; slug: string }
  | { type: 'movie'; identifier: string; slug?: string }
  | { type: 'actor'; identifier: string; slug?: string }
  | { type: 'feeds' }
  | { type: 'about' }
  | { type: 'privacy' }
  | { type: 'contact' }
  | { type: 'admin-login' }
  | { type: 'admin-submissions' }
  | { type: 'admin-feed-statistics' }
  | { type: 'admin-add-movies' }
  | { type: 'not-found' };

type ViewStatus = 'loading' | 'ready' | 'not-found' | 'error';

const EMPTY_BRANDS: MetaBrand[] = [];

const MovieDetail = lazy(() => import('./components/MovieDetail').then(({ MovieDetail: component }) => ({ default: component })));
const ActorDetail = lazy(() => import('./components/ActorDetail').then(({ ActorDetail: component }) => ({ default: component })));
const FeedsPage = lazy(() => import('./components/FeedsPage').then(({ FeedsPage: component }) => ({ default: component })));
const AboutPage = lazy(() => import('./components/AboutPage').then(({ AboutPage: component }) => ({ default: component })));
const PrivacyPage = lazy(() => import('./components/PrivacyPage').then(({ PrivacyPage: component }) => ({ default: component })));
const AdminLoginPage = lazy(() => import('./components/AdminLoginPage').then(({ AdminLoginPage: component }) => ({ default: component })));
const AdminSubmissionsPage = lazy(() => import('./components/AdminSubmissionsPage').then(({ AdminSubmissionsPage: component }) => ({ default: component })));
const AdminFeedStatisticsPage = lazy(() => import('./components/AdminFeedStatisticsPage').then(({ AdminFeedStatisticsPage: component }) => ({ default: component })));
const AdminAddMoviesPage = lazy(() => import('./components/AdminAddMoviesPage').then(({ AdminAddMoviesPage: component }) => ({ default: component })));

function HomeLoadingSkeleton() {
  return (
    <div id="home-view-loading" className="pb-6 sm:pb-8" aria-busy="true" aria-label="Loading XmasDB homepage">
      <section className="h-[300px] border-b border-[#E7DFD5] py-8 sm:h-[290px] sm:py-10">
        <div className="mb-6 space-y-2">
          <div className="h-3 w-48 animate-pulse rounded bg-[#EFE8DD]" />
          <div className="h-7 w-64 animate-pulse rounded bg-[#EFE8DD]" />
        </div>
        <div className="flex gap-4 overflow-hidden">
          {Array.from({ length: 6 }, (_, index) => <div key={index} className="h-28 w-28 shrink-0 animate-pulse rounded-full bg-[#EFE8DD]" />)}
        </div>
      </section>
      {["coming-soon", "discovery"].map((section) => (
        <section key={section} className="h-[400px] border-b border-[#E7DFD5] py-7 sm:h-[360px] sm:py-9">
          <div className="mb-5 space-y-2">
            <div className="h-3 w-40 animate-pulse rounded bg-[#EFE8DD]" />
            <div className="h-7 w-72 animate-pulse rounded bg-[#EFE8DD]" />
          </div>
          <div className="flex gap-4 overflow-hidden sm:grid sm:grid-cols-6">
            {Array.from({ length: 6 }, (_, index) => <div key={index} className="h-64 w-[140px] shrink-0 animate-pulse rounded-md bg-[#EFE8DD] sm:h-56 sm:w-auto" />)}
          </div>
        </section>
      ))}
      <section className="h-[260px] py-7 sm:py-9">
        <div className="mb-5 space-y-2">
          <div className="h-3 w-40 animate-pulse rounded bg-[#EFE8DD]" />
          <div className="h-7 w-80 animate-pulse rounded bg-[#EFE8DD]" />
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-6">
          {Array.from({ length: 6 }, (_, index) => <div key={index} className="h-24 animate-pulse rounded-md bg-[#EFE8DD]" />)}
        </div>
      </section>
    </div>
  );
}

/** Rejects stale or malformed API/cache data before components render it. */
function isRoutePayloadValid(descriptor: RouteDescriptor, payload: unknown): boolean {
  switch (descriptor.type) {
    case 'home':
      return isHomePayload(payload);
    case 'movies':
    case 'year-archive':
    case 'brand':
      return isCatalogueListingPayload(payload);
    case 'fingerprint':
      return isFingerprintListingPayload(payload);
    case 'movie':
      return isMovieDetailPayload(payload);
    case 'actor':
      return isActorDetailPayload(payload);
    case 'feeds':
      return isFeedsMetaPayload(payload);
    case 'about':
      return isAboutPayload(payload);
    case 'privacy':
      return isPrivacyPayload(payload);
    case 'contact':
      return isContactPayload(payload);
    default:
      return false;
  }
}

export function parseRoute(currentPath: string): RouteDescriptor {
  const rawPath = currentPath.split('?')[0].trim();
  const clean = rawPath.replace(/^\/+|\/+$/g, '');

  if (!clean) return { type: 'home' };
  if (clean === 'movies' || clean === 'all') return { type: 'movies' };
  if (clean === 'feeds') return { type: 'feeds' };
  if (clean === 'about') return { type: 'about' };
  if (clean === 'privacy') return { type: 'privacy' };
  if (clean === 'contact') return { type: 'contact' };
  if (clean === 'admin/login') return { type: 'admin-login' };
  if (clean === 'admin/submissions') return { type: 'admin-submissions' };
  if (clean === 'admin/feed-statistics') return { type: 'admin-feed-statistics' };
  if (clean === 'admin/movies/add') return { type: 'admin-add-movies' };

  const fingerprintMatch = clean.match(/^fingerprint\/([^/]+)$/i);
  if (fingerprintMatch) {
    return getFingerprintById(fingerprintMatch[1]) ? { type: 'fingerprint', slug: fingerprintMatch[1] } : { type: 'not-found' };
  }

  const yearArchiveMatch = clean.match(/^year\/(\d+)$/i);
  if (yearArchiveMatch) {
    return { type: 'year-archive', year: parseInt(yearArchiveMatch[1], 10) };
  }

  const movieMatch = clean.match(/^movie\/(.+)$/i);
  if (movieMatch) {
    const parts = movieMatch[1].split('/').filter(Boolean);
    if (parts.length === 2) return { type: 'movie', identifier: parts[0], slug: parts[1] };
    if (parts.length === 1) return { type: 'movie', identifier: parts[0] };
    return { type: 'not-found' };
  }

  const actorMatch = clean.match(/^actor\/(.+)$/i);
  if (actorMatch) {
    const parts = actorMatch[1].split('/').filter(Boolean);
    if (parts.length === 2) return { type: 'actor', identifier: parts[0], slug: parts[1] };
    if (parts.length === 1) return { type: 'actor', identifier: parts[0] };
    return { type: 'not-found' };
  }

  const brandParts = clean.split('/').filter(Boolean);
  if (brandParts.length === 1) {
    return getBrandBySlug(brandParts[0])
      ? { type: 'brand', slug: brandParts[0], year: null }
      : { type: 'not-found' };
  }
  if (brandParts.length === 2) {
    if (!getBrandBySlug(brandParts[0]) || !/^\d+$/.test(brandParts[1])) return { type: 'not-found' };
    return { type: 'brand', slug: brandParts[0], year: parseInt(brandParts[1], 10) };
  }

  return { type: 'not-found' };
}

/** Adds locked brand/year params to the current listing query string. */
function buildListingSearch(baseSearch: string, extra: Record<string, string>): string {
  const params = new URLSearchParams(baseSearch);
  for (const [key, value] of Object.entries(extra)) params.set(key, value);
  return `?${params.toString()}`;
}

function requestFor(descriptor: RouteDescriptor, catalogueSearch: string): string | null {
  switch (descriptor.type) {
    case 'home':
      return '/api/home';
    case 'movies':
      return catalogueUrl(catalogueSearch);
    case 'year-archive':
      return catalogueUrl(buildListingSearch(catalogueSearch, { year: String(descriptor.year) }));
    case 'brand': {
      const extra: Record<string, string> = { brand: descriptor.slug };
      if (descriptor.year) extra.year = String(descriptor.year);
      return catalogueUrl(buildListingSearch(catalogueSearch, extra));
    }
    case 'fingerprint':
      return `/api/fingerprint/${encodeURIComponent(descriptor.slug)}${catalogueSearch}`;
    case 'movie':
      return movieUrl(descriptor.slug ? [descriptor.identifier, descriptor.slug] : [descriptor.identifier]);
    case 'actor':
      return actorUrl(descriptor.slug ? [descriptor.identifier, descriptor.slug] : [descriptor.identifier]);
    case 'feeds':
      return FEEDS_META_URL;
    case 'about':
      return ABOUT_URL;
    case 'privacy':
      return PRIVACY_URL;
    case 'contact':
      return null;
    case 'admin-login':
    case 'admin-submissions':
    case 'admin-feed-statistics':
    case 'admin-add-movies':
      return null;
    default:
      return null;
  }
}

export default function App() {
  const [currentPath, setCurrentPath] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return `${window.location.pathname || '/'}${window.location.search}`;
    }
    return '/';
  });

  const [searchQuery, setSearchQuery] = useState<string>('');
  const [meta, setMeta] = useState<CatalogueMeta | null>(() => getCatalogueMetaSnapshot());
  const lastAnalyticsRoute = useRef<string | null>(null);

  // Sync state with browser popstate
  useEffect(() => {
    const handlePopState = () => {
      setCurrentPath(`${window.location.pathname || '/'}${window.location.search}`);
      setSearchQuery('');
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Bootstrap metadata (injected synchronously in production, fetched otherwise).
  useEffect(() => {
    let active = true;
    loadCatalogueMeta()
      .then((value) => {
        if (active) setMeta(value);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);

  // Navigation helper
  const navigate = (path: string) => {
    const currentUrl = `${window.location.pathname}${window.location.search}`;
    if (currentUrl !== path) {
      window.history.pushState({}, '', path);
    }
    setCurrentPath(path);
    setSearchQuery('');
    window.scrollTo(0, 0);
  };

  const focusSearch = () => {
    document.getElementById('search-input')?.focus();
  };

  const descriptor = useMemo(() => parseRoute(currentPath), [currentPath]);
  const cataloguePathname = currentPath.split('?')[0] || '/';
  const catalogueSearch = currentPath.includes('?') ? currentPath.slice(currentPath.indexOf('?')) : '';
  const catalogueQuery = useMemo(() => parseCatalogueQuery(catalogueSearch), [catalogueSearch]);
  const requestUrl = useMemo(() => requestFor(descriptor, catalogueSearch), [descriptor, catalogueSearch]);
  const isStaticRoute = descriptor.type === 'contact' || descriptor.type === 'admin-login' || descriptor.type === 'admin-submissions' || descriptor.type === 'admin-feed-statistics' || descriptor.type === 'admin-add-movies';

  // Resolve the current route's data from the shared client cache / API.
  const [view, setView] = useState<{ url: string; status: ViewStatus; payload: unknown }>(() => {
    if (isStaticRoute) return { url: '', status: 'ready', payload: {} };
    if (!requestUrl) return { url: '', status: 'not-found', payload: undefined };
    const cached = peekResolved<unknown>(requestUrl);
    return cached !== undefined && isRoutePayloadValid(descriptor, cached)
      ? { url: requestUrl, status: 'ready', payload: cached }
      : { url: requestUrl, status: 'loading', payload: undefined };
  });

  useEffect(() => {
    if (!requestUrl) {
      setView({ url: '', status: isStaticRoute ? 'ready' : 'not-found', payload: isStaticRoute ? {} : undefined });
      return;
    }

    const cached = peekResolved<unknown>(requestUrl);
    if (cached !== undefined && isRoutePayloadValid(descriptor, cached)) {
      setView({
        url: requestUrl,
        status: 'ready',
        payload: cached,
      });
      return;
    }

    let active = true;
    setView({ url: requestUrl, status: 'loading', payload: undefined });
    fetchUrl<unknown>(requestUrl)
      .then((payload) => {
        if (!isRoutePayloadValid(descriptor, payload)) {
          throw new Error(`Invalid API payload for ${requestUrl}`);
        }
        if (active) setView({ url: requestUrl, status: 'ready', payload });
      })
      .catch((error) => {
        if (!active) return;
        const notFound = error instanceof ApiError && error.status === 404;
        setView({ url: requestUrl, status: notFound ? 'not-found' : 'error', payload: undefined });
      });

    return () => {
      active = false;
    };
  }, [requestUrl, isStaticRoute]);

  // A navigation changes requestUrl before the loading effect runs. Do not
  // render the previous route's ready payload as the new route's data.
  const isCurrentView = requestUrl === null
    ? view.url === ''
    : view.url === requestUrl;
  const currentViewStatus: ViewStatus = isCurrentView ? view.status : 'loading';

  // Keep legacy movie/actor URLs canonical after the entity resolves.
  useEffect(() => {
    if (!isCurrentView || view.status !== 'ready' || typeof window === 'undefined') return;
    if (descriptor.type === 'movie') {
      if (!isMovieDetailPayload(view.payload)) return;
      const movie = view.payload.movie;
      const canonical = getMoviePath(movie.tmdbId, movie.slug);
      if (window.location.pathname !== canonical) window.history.replaceState({}, '', canonical);
    } else if (descriptor.type === 'actor') {
      if (!isActorDetailPayload(view.payload)) return;
      const actor = view.payload.actor;
      const canonical = getActorPath(actor.tmdbPersonId, actor.slug);
      if (window.location.pathname !== canonical) window.history.replaceState({}, '', canonical);
    }
  }, [descriptor, view, isCurrentView]);

  // Dynamic SEO and Structured Data updates on route change
  useEffect(() => {
    if (!isCurrentView) return;
    if (descriptor.type === 'not-found' || view.status === 'not-found') {
      updateSeoTags(buildNotFoundSeo());
      return;
    }

    if (descriptor.type === 'home') {
      updateSeoTags(buildHomeSeo(meta?.totalMovies));
    } else if (descriptor.type === 'movies') {
      updateSeoTags({ ...buildMoviesSeo(meta?.totalMovies), noIndex: Boolean(catalogueSearch) });
    } else if (descriptor.type === 'year-archive') {
      if (!isCatalogueListingPayload(view.payload)) return;
      updateSeoTags({ ...buildYearSeo(descriptor.year, view.payload.total), noIndex: Boolean(catalogueSearch) });
    } else if (descriptor.type === 'brand') {
      const brand = getBrandBySlug(descriptor.slug);
      if (!brand) return;
      if (!isCatalogueListingPayload(view.payload)) return;
      updateSeoTags({ ...buildBrandSeo(brand, descriptor.year, view.payload.total), noIndex: Boolean(catalogueSearch) });
    } else if (descriptor.type === 'movie') {
      if (view.status !== 'ready') return;
      if (!isMovieDetailPayload(view.payload)) return;
      updateSeoTags(buildMovieSeo(view.payload.movie));
    } else if (descriptor.type === 'actor') {
      if (view.status !== 'ready') return;
      if (!isActorDetailPayload(view.payload)) return;
      updateSeoTags(buildActorSeo(view.payload.actor, view.payload.filmography, view.payload.titleDisambiguator));
    } else if (descriptor.type === 'feeds') {
      updateSeoTags(buildFeedsSeo());
    } else if (descriptor.type === 'about') {
      updateSeoTags(buildAboutSeo());
    } else if (descriptor.type === 'privacy') {
      updateSeoTags(buildPrivacySeo());
    } else if (descriptor.type === 'contact') {
      updateSeoTags(buildContactSeo());
    } else if (descriptor.type === 'admin-login' || descriptor.type === 'admin-submissions' || descriptor.type === 'admin-feed-statistics' || descriptor.type === 'admin-add-movies') {
      updateSeoTags({
        title: 'Admin | XmasDB',
        description: 'Private XmasDB administration.',
        canonicalPath: descriptor.type === 'admin-login' ? '/admin/login/' : descriptor.type === 'admin-submissions' ? '/admin/submissions/' : descriptor.type === 'admin-feed-statistics' ? '/admin/feed-statistics/' : '/admin/movies/add/',
        noIndex: true,
      });
    }
  }, [descriptor, view, meta, isCurrentView]);

  // GoatCounter is loaded only for resolved public routes; its initial automatic
  // count is disabled so this effect owns both the first view and SPA navigations.
  useEffect(() => {
    if (typeof window === 'undefined' || !isCurrentView) return;
    if (!isGoatCounterRouteAllowed(descriptor.type, window.location.pathname)) {
      lastAnalyticsRoute.current = null;
      return;
    }
    if (view.status !== 'ready' && view.status !== 'not-found') return;
    const path = getGoatCounterPagePath(window.location.pathname, window.location.search);
    if (lastAnalyticsRoute.current === currentPath) return;
    lastAnalyticsRoute.current = currentPath;
    void trackGoatCounterPageView(path, document.title);
  }, [currentPath, descriptor, view.status, isCurrentView]);

  // Correct out-of-range page / unsupported perPage values after the server resolves.
  const listingPayload = (() => {
    if (!isCurrentView || view.status !== 'ready') return null;
    if (descriptor.type === 'fingerprint') return isFingerprintListingPayload(view.payload) ? view.payload : null;
    if (descriptor.type === 'movies' || descriptor.type === 'year-archive' || descriptor.type === 'brand') {
      return isCatalogueListingPayload(view.payload) ? view.payload : null;
    }
    return null;
  })();

  useEffect(() => {
    if (!listingPayload || typeof window === 'undefined') return;
    const params = new URLSearchParams(catalogueSearch);
    const requestedPage = Number(params.get('page'));
    const requestedPerPage = Number(params.get('perPage'));
    const changes: Record<string, string | number | undefined> = {};
    if (params.has('page') && (!Number.isInteger(requestedPage) || requestedPage < 1 || requestedPage !== listingPayload.page)) {
      changes.page = listingPayload.page;
    }
    if (params.has('perPage') && ![24, 48, 96].includes(requestedPerPage)) changes.perPage = 24;
    if (Object.keys(changes).length > 0) {
      const corrected = buildCatalogueUrl(cataloguePathname, catalogueSearch, changes, false);
      window.history.replaceState({}, '', corrected);
      setCurrentPath(corrected);
    }
  }, [listingPayload, cataloguePathname, catalogueSearch]);

  // Full search results (kept out of autocomplete; preserves synopsis matching).
  const [searchResults, setSearchResults] = useState<SearchResultsPayload | null>(null);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    const q = searchQuery.trim();
    if (!q) {
      setSearchResults(null);
      setSearching(false);
      return;
    }

    let active = true;
    setSearchResults(null);
    setSearching(true);
    const handle = window.setTimeout(() => {
      fetchSearchResults(q)
        .then((results) => {
          if (active) {
            setSearchResults(results);
            setSearching(false);
          }
        })
        .catch(() => {
          if (active) {
            setSearchResults({ movies: [], actors: [] });
            setSearching(false);
          }
        });
    }, 120);

    return () => {
      active = false;
      window.clearTimeout(handle);
    };
  }, [searchQuery]);

  const hasSearchQuery = searchQuery.trim().length > 0;
  const populatedBrands = meta?.populatedBrands ?? EMPTY_BRANDS;
  const activeBrandId = descriptor.type === 'brand' ? getBrandBySlug(descriptor.slug)?.id ?? null : null;

  const selectMovie = (slug: string, tmdbId?: number) => {
    navigate(tmdbId ? getMoviePath(tmdbId, slug) : `/movie/${slug}/`);
  };

  const searchActorsFirst = Boolean(
    searchResults?.actors.length
      && (!searchResults.movies.length
        || scoreActorSearchResult(searchResults.actors[0], searchQuery) > scoreListingMovieTitle(searchResults.movies[0], searchQuery))
  );
  const actorSearchSection = searchResults && searchResults.actors.length > 0 ? (
    <div className="mb-8 p-4 rounded-lg bg-[#F5EFE6] border border-[#DDD4C6]">
      <h3 className="text-sm font-heading font-semibold text-[#1A3D2F] uppercase tracking-wider mb-2">Actors</h3>
      <div className="flex flex-wrap gap-2">
        {searchResults.actors.map((actor) => (
          <a
            key={actor.slug}
            href={getActorPath(actor.tmdbPersonId, actor.slug)}
            onClick={(e) => {
              e.preventDefault();
              navigate(getActorPath(actor.tmdbPersonId, actor.slug));
            }}
            className="cursor-pointer px-3 py-1 rounded bg-[#FFFDF9] hover:bg-[#FAF7F2] text-[#841818] font-body text-sm border border-[#DCD3C7] transition-colors"
          >
            {actor.name}
          </a>
        ))}
      </div>
    </div>
  ) : null;
  const movieSearchSection = searchResults ? (
    <section aria-labelledby="search-movies-heading" className="mb-8">
      <h3 id="search-movies-heading" className="mb-2 text-sm font-heading font-semibold text-[#1A3D2F] uppercase tracking-wider">Movies</h3>
      <MovieGrid
        movies={searchResults.movies}
        onSelectMovie={selectMovie}
        naturalTitleHeight
        emptyMessage={`No movies found matching "${searchQuery}".`}
      />
    </section>
  ) : null;

  return (
    <div className="min-h-screen flex flex-col bg-[#FAF7F2] text-[#23211E] relative">
      <SnowEffect />
      <BrandPrefetch brands={populatedBrands} activeBrandId={activeBrandId} />
      <CatalogueStatsStrip meta={meta} onNavigate={navigate} />
      <Header
        currentPath={currentPath}
        onNavigate={navigate}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        populatedBrands={populatedBrands}
      />

      <main className={`flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 ${descriptor.type === 'home' && !hasSearchQuery ? 'min-h-[1300px]' : ''}`}>
        {hasSearchQuery ? (
          <div className="py-6 sm:py-8" id="search-results-section">
            <div className="border-b border-[#E7DFD5] pb-4 mb-6">
              <h2 className="text-xl sm:text-2xl font-heading font-semibold text-[#1A3D2F]">
                Search results for &ldquo;{searchQuery}&rdquo;
              </h2>
              <p className="text-sm text-[#736B63] font-body mt-1">
                {searching || !searchResults ? (
                  <>Searching&hellip;</>
                ) : (
                  <>
                    Found {searchResults.movies.length} {searchResults.movies.length === 1 ? 'movie' : 'movies'}
                    {searchResults.actors.length > 0 && ` and ${searchResults.actors.length} ${searchResults.actors.length === 1 ? 'actor' : 'actors'}`}.
                  </>
                )}
              </p>
            </div>

            {searchActorsFirst ? <>{actorSearchSection}{movieSearchSection}</> : <>{movieSearchSection}{actorSearchSection}</>}
          </div>
          ) : currentViewStatus === 'loading' ? (
          descriptor.type === 'home' ? <HomeLoadingSkeleton /> : (
            <div className="py-24 text-center text-[#736B63] font-body" aria-live="polite">
              Loading&hellip;
            </div>
          )
        ) : currentViewStatus === 'error' ? (
          <div className="py-24 text-center font-body text-[#736B63]">
            <p className="mb-3">Something went wrong loading this page.</p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="cursor-pointer rounded border border-[#DCD3C7] bg-[#FAF7F2] px-4 py-2 text-sm text-[#1A3D2F] hover:bg-[#EFE8DD]"
            >
              Reload
            </button>
          </div>
        ) : currentViewStatus === 'not-found' || descriptor.type === 'not-found' ? (
           <NotFoundPage onNavigate={navigate} onSearch={focusSearch} />
        ) : (
          <Suspense fallback={<div className="py-24 text-center text-[#736B63] font-body" aria-live="polite">Loading&hellip;</div>}>
            <>
            {descriptor.type === 'home' && isHomePayload(view.payload) && (
              <HomePage payload={view.payload} onNavigate={navigate} />
            )}

            {descriptor.type === 'about' && isAboutPayload(view.payload) && <AboutPage payload={view.payload} onNavigate={navigate} />}

            {descriptor.type === 'privacy' && isPrivacyPayload(view.payload) && <PrivacyPage />}

            {descriptor.type === 'contact' && isContactPayload(view.payload) && <ContactPage />}

            {descriptor.type === 'admin-login' && <AdminLoginPage onAuthenticated={() => navigate('/admin/submissions/')} />}

            {descriptor.type === 'admin-submissions' && <AdminSubmissionsPage onNavigate={navigate} />}

            {descriptor.type === 'admin-feed-statistics' && <AdminFeedStatisticsPage onNavigate={navigate} />}

            {descriptor.type === 'admin-add-movies' && <AdminAddMoviesPage onNavigate={navigate} />}

            {descriptor.type === 'movies' && listingPayload && (
              <div className="py-6 sm:py-8" id="all-movies-view">
                <div className="text-center mb-2">
                  <h1 className="text-2xl sm:text-3xl font-heading font-semibold text-[#1A3D2F]">
                    All Christmas Movies
                  </h1>
                </div>

                <YearFilter
                  years={listingPayload.years ?? []}
                  selectedYear={null}
                  onSelectYear={(year) => navigate(year ? getYearPath(year) : getMoviesPath())}
                />

                <CatalogueControls
                  pathname={cataloguePathname}
                  search={catalogueSearch}
                  query={catalogueQuery}
                  total={listingPayload.total}
                  page={listingPayload.page}
                  onNavigate={navigate}
                />
                <MovieGrid movies={listingPayload.movies} onSelectMovie={selectMovie} naturalTitleHeight />
                <CataloguePagination
                  pathname={cataloguePathname}
                  search={catalogueSearch}
                  page={listingPayload.page}
                  totalPages={listingPayload.totalPages}
                  onNavigate={navigate}
                />
              </div>
            )}

            {descriptor.type === 'year-archive' && listingPayload && (
              <div className="py-6 sm:py-8" id={`year-view-${descriptor.year}`}>
                <div className="text-center mb-2">
                  <h1 className="text-2xl sm:text-3xl font-heading font-semibold text-[#1A3D2F]">
                    Christmas Movies of {descriptor.year}
                  </h1>
                  <p className="text-sm text-[#736B63] font-body mt-1">
                    All holiday releases and TV premieres from {descriptor.year}.
                  </p>
                </div>

                <YearFilter
                  years={listingPayload.years ?? []}
                  selectedYear={descriptor.year}
                  onSelectYear={(year) => navigate(year ? getYearPath(year) : getMoviesPath())}
                />

                <CatalogueControls
                  pathname={cataloguePathname}
                  search={catalogueSearch}
                  query={catalogueQuery}
                  total={listingPayload.total}
                  page={listingPayload.page}
                  onNavigate={navigate}
                />
                <MovieGrid
                  movies={listingPayload.movies}
                  onSelectMovie={selectMovie}
                  naturalTitleHeight
                  emptyMessage={`No Christmas movies listed for ${descriptor.year}.`}
                />
                <CataloguePagination
                  pathname={cataloguePathname}
                  search={catalogueSearch}
                  page={listingPayload.page}
                  totalPages={listingPayload.totalPages}
                  onNavigate={navigate}
                />
              </div>
            )}

            {descriptor.type === 'brand' && listingPayload && (() => {
              const brand = getBrandBySlug(descriptor.slug);
              if (!brand) return null;
              return (
                <div className="py-6 sm:py-8" id={`brand-view-${brand.slug}`}>
                  <div className="text-center mb-2">
                    <h1 className="text-2xl sm:text-3xl font-heading font-semibold text-[#1A3D2F]">
                      {brand.name} {descriptor.year ? `(${descriptor.year})` : ''}
                    </h1>
                    <p className="text-sm text-[#736B63] font-body mt-1">
                      {brand.description}
                    </p>
                  </div>

                  <YearFilter
                    years={listingPayload.years ?? []}
                    selectedYear={descriptor.year}
                    brandSlug={brand.slug}
                    onSelectYear={(year) => navigate(getNetworkPath(brand.slug, year))}
                  />

                  <CatalogueControls
                    pathname={cataloguePathname}
                    search={catalogueSearch}
                    query={catalogueQuery}
                    total={listingPayload.total}
                    page={listingPayload.page}
                    onNavigate={navigate}
                  />
                  <MovieGrid
                    movies={listingPayload.movies}
                    onSelectMovie={selectMovie}
                    naturalTitleHeight
                    emptyMessage={
                      descriptor.year
                        ? `No ${brand.shortName} Christmas movies listed for ${descriptor.year}.`
                        : `No movies found for ${brand.shortName}.`
                    }
                  />
                  <CataloguePagination
                    pathname={cataloguePathname}
                    search={catalogueSearch}
                    page={listingPayload.page}
                    totalPages={listingPayload.totalPages}
                    onNavigate={navigate}
                  />
                </div>
              );
            })()}

            {descriptor.type === 'fingerprint' && listingPayload && (() => {
              const fingerprint = getFingerprintById(descriptor.slug);
              if (!fingerprint) return <NotFoundPage onNavigate={navigate} onSearch={focusSearch} />;
              const relatedFingerprints = isFingerprintListingPayload(listingPayload) ? listingPayload.relatedFingerprints : [];
              return (
                <div className="py-6 sm:py-8" id={`fingerprint-view-${fingerprint.id}`}>
                  <div className="mb-8 text-center">
                    <p className="text-xs font-sans-clean font-semibold uppercase tracking-widest text-[#841818]">Christmas Ingredient</p>
                    <h1 className="mt-1 text-2xl sm:text-3xl font-heading font-semibold text-[#1A3D2F]">Christmas movies with: {fingerprint.label}</h1>
                    <p className="text-sm text-[#736B63] font-body mt-1">{listingPayload.total} matching {listingPayload.total === 1 ? 'movie' : 'movies'}.</p>
                  </div>
                  <CatalogueControls
                    pathname={cataloguePathname}
                    search={catalogueSearch}
                    query={catalogueQuery}
                    total={listingPayload.total}
                    page={listingPayload.page}
                    onNavigate={navigate}
                    showPerPage={listingPayload.totalPages > 1}
                  />
                  <MovieGrid movies={listingPayload.movies} onSelectMovie={selectMovie} naturalTitleHeight emptyMessage={`No movies found with the Christmas ingredient “${fingerprint.label}”.`} />
                  {listingPayload.totalPages > 1 && <CataloguePagination
                    pathname={cataloguePathname}
                    search={catalogueSearch}
                    page={listingPayload.page}
                    totalPages={listingPayload.totalPages}
                    onNavigate={navigate}
                  />}
                  {relatedFingerprints.length > 0 && (
                    <section className="mt-10 border-t border-[#E7DFD5] pt-7" aria-labelledby="related-ingredients-heading">
                      <h2 id="related-ingredients-heading" className="text-base font-heading font-semibold text-[#1A3D2F]">Explore related Christmas ingredients</h2>
                      <div className="mt-3"><FingerprintChips fingerprints={relatedFingerprints} onNavigate={navigate} /></div>
                    </section>
                  )}
                </div>
              );
            })()}

            {descriptor.type === 'movie' && currentViewStatus === 'ready' && (() => {
              if (!isMovieDetailPayload(view.payload)) return <NotFoundPage onNavigate={navigate} onSearch={focusSearch} />;
              return <MovieDetail movie={view.payload.movie} related={view.payload.related} onNavigate={navigate} />;
            })()}

            {descriptor.type === 'actor' && currentViewStatus === 'ready' && (() => {
              if (!isActorDetailPayload(view.payload)) return <NotFoundPage onNavigate={navigate} onSearch={focusSearch} />;
              return (
                <ActorDetail
                  actor={view.payload.actor}
                  filmography={view.payload.filmography}
                  actingFilmography={view.payload.actingFilmography}
                  directingFilmography={view.payload.directingFilmography}
                  writingFilmography={view.payload.writingFilmography}
                  backdropUrl={view.payload.backdropUrl}
                  onNavigate={navigate}
                  onSelectMovie={selectMovie}
                />
              );
            })()}

            {descriptor.type === 'feeds' && currentViewStatus === 'ready' && isFeedsMetaPayload(view.payload) && (
              <FeedsPage meta={view.payload} />
            )}
            </>
          </Suspense>
        )}
      </main>

      <Footer onNavigate={navigate} populatedBrands={populatedBrands} />
      <ScrollToTopButton />
    </div>
  );
}
