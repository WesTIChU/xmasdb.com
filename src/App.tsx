import { useState, useEffect, useMemo } from 'react';
import { Header } from './components/Header';
import { YearFilter } from './components/YearFilter';
import { MovieGrid } from './components/MovieGrid';
import { CatalogueControls } from './components/CatalogueControls';
import { CataloguePagination } from './components/CataloguePagination';
import { MovieDetail } from './components/MovieDetail';
import { ActorDetail } from './components/ActorDetail';
import { FeedsPage } from './components/FeedsPage';
import { HomePage } from './components/HomePage';
import { Footer } from './components/Footer';
import { SnowEffect } from './components/SnowEffect';
import { ScrollToTopButton } from './components/ScrollToTopButton';
import { CatalogueStatsStrip } from './components/CatalogueStatsStrip';
import { BrandPrefetch } from './components/BrandPrefetch';
import { NotFoundPage } from './components/NotFoundPage';
import type {
  ActorDetailPayload,
  CatalogueListing,
  CatalogueMeta,
  FeedsMetaPayload,
  HomePayload,
  MetaBrand,
  MovieDetailPayload,
  SearchResultsPayload,
} from './api/types';
import {
  ApiError,
  FEEDS_META_URL,
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
import {
  SITE_ORIGIN,
  getMoviePath,
  getActorPath,
  getNetworkPath,
  getYearPath,
  getMoviesPath,
  getFeedsPath,
} from './utils/urls';
import { updateSeoTags } from './utils/seo';
import { buildCatalogueUrl, parseCatalogueQuery } from './utils/catalogue-pagination';

/**
 * Route identity only — no catalogue data. Data is resolved separately from the
 * lightweight API so the full catalogue never ships in the browser bundle.
 */
type RouteDescriptor =
  | { type: 'home' }
  | { type: 'movies' }
  | { type: 'year-archive'; year: number }
  | { type: 'brand'; slug: string; year: number | null }
  | { type: 'movie'; identifier: string; slug?: string }
  | { type: 'actor'; identifier: string; slug?: string }
  | { type: 'feeds' }
  | { type: 'not-found' };

type ViewStatus = 'loading' | 'ready' | 'not-found' | 'error';

const EMPTY_BRANDS: MetaBrand[] = [];

function parseRoute(currentPath: string): RouteDescriptor {
  const rawPath = currentPath.split('?')[0].trim();
  const clean = rawPath.replace(/^\/+|\/+$/g, '');

  if (!clean) return { type: 'home' };
  if (clean === 'movies' || clean === 'all') return { type: 'movies' };
  if (clean === 'feeds') return { type: 'feeds' };

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
  if (brandParts.length === 1) return { type: 'brand', slug: brandParts[0], year: null };
  if (brandParts.length === 2) {
    if (!/^\d+$/.test(brandParts[1])) return { type: 'not-found' };
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
    case 'movie':
      return movieUrl(descriptor.slug ? [descriptor.identifier, descriptor.slug] : [descriptor.identifier]);
    case 'actor':
      return actorUrl(descriptor.slug ? [descriptor.identifier, descriptor.slug] : [descriptor.identifier]);
    case 'feeds':
      return FEEDS_META_URL;
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

  const descriptor = useMemo(() => parseRoute(currentPath), [currentPath]);
  const cataloguePathname = currentPath.split('?')[0] || '/';
  const catalogueSearch = currentPath.includes('?') ? currentPath.slice(currentPath.indexOf('?')) : '';
  const catalogueQuery = useMemo(() => parseCatalogueQuery(catalogueSearch), [catalogueSearch]);
  const requestUrl = useMemo(() => requestFor(descriptor, catalogueSearch), [descriptor, catalogueSearch]);

  // Resolve the current route's data from the shared client cache / API.
  const [view, setView] = useState<{ url: string; status: ViewStatus; payload: unknown }>(() => {
    if (!requestUrl) return { url: '', status: 'not-found', payload: undefined };
    const cached = peekResolved<unknown>(requestUrl);
    return cached !== undefined
      ? { url: requestUrl, status: 'ready', payload: cached }
      : { url: requestUrl, status: 'loading', payload: undefined };
  });

  useEffect(() => {
    if (!requestUrl) {
      setView({ url: '', status: 'not-found', payload: undefined });
      return;
    }

    const cached = peekResolved<unknown>(requestUrl);
    if (cached !== undefined) {
      setView({ url: requestUrl, status: 'ready', payload: cached });
      return;
    }

    let active = true;
    setView({ url: requestUrl, status: 'loading', payload: undefined });
    fetchUrl<unknown>(requestUrl)
      .then((payload) => {
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
  }, [requestUrl]);

  // Keep legacy movie/actor URLs canonical after the entity resolves.
  useEffect(() => {
    if (view.status !== 'ready' || typeof window === 'undefined') return;
    if (descriptor.type === 'movie') {
      const movie = (view.payload as Partial<MovieDetailPayload>).movie;
      if (!movie) return;
      const canonical = getMoviePath(movie.tmdbId, movie.slug);
      if (window.location.pathname !== canonical) window.history.replaceState({}, '', canonical);
    } else if (descriptor.type === 'actor') {
      const actor = (view.payload as Partial<ActorDetailPayload>).actor;
      if (!actor) return;
      const canonical = getActorPath(actor.tmdbPersonId, actor.slug);
      if (window.location.pathname !== canonical) window.history.replaceState({}, '', canonical);
    }
  }, [descriptor, view]);

  // Dynamic SEO and Structured Data updates on route change
  useEffect(() => {
    if (descriptor.type === 'not-found' || view.status === 'not-found') {
      updateSeoTags({
        title: 'Page Not Found | XmasDB',
        description: 'The Christmas movie page you are looking for could not be found on XmasDB.',
        noIndex: true,
      });
      return;
    }

    if (descriptor.type === 'home') {
      updateSeoTags({
        title: 'XmasDB.com — A curated collection of Christmas movies',
        description: 'A curated collection of Hallmark, Lifetime, and TV Christmas movies with cast, air dates, trailers, and data feeds.',
        canonicalPath: '/',
        schema: {
          '@context': 'https://schema.org',
          '@type': 'WebSite',
          name: 'XmasDB.com',
          url: `${SITE_ORIGIN}/`,
          description: 'A curated collection of Christmas movies.',
        },
      });
    } else if (descriptor.type === 'movies') {
      const total = meta?.totalMovies;
      updateSeoTags({
        title: 'All Christmas Movies — XmasDB.com',
        description: total
          ? `Explore all ${total} Christmas movies in the XmasDB archive across Hallmark, Lifetime, and holiday networks.`
          : 'Explore the XmasDB archive of Christmas movies across Hallmark, Lifetime, and holiday networks.',
        canonicalPath: getMoviesPath(),
        schema: {
          '@context': 'https://schema.org',
          '@type': 'CollectionPage',
          name: 'All Christmas Movies',
          url: `${SITE_ORIGIN}${getMoviesPath()}`,
          description: 'Complete catalogue of holiday films.',
        },
      });
    } else if (descriptor.type === 'year-archive') {
      updateSeoTags({
        title: `Christmas Movies Released in ${descriptor.year} — XmasDB.com`,
        description: `Discover all Hallmark, Lifetime, and TV Christmas movies released in ${descriptor.year}.`,
        canonicalPath: getYearPath(descriptor.year),
        schema: {
          '@context': 'https://schema.org',
          '@type': 'CollectionPage',
          name: `Christmas Movies of ${descriptor.year}`,
          url: `${SITE_ORIGIN}${getYearPath(descriptor.year)}`,
        },
      });
    } else if (descriptor.type === 'brand') {
      const brand = getBrandBySlug(descriptor.slug);
      if (!brand) return;
      const yearSuffix = descriptor.year ? ` (${descriptor.year})` : '';
      const canonical = getNetworkPath(brand.slug, descriptor.year);
      updateSeoTags({
        title: `${brand.name}${yearSuffix} — XmasDB.com`,
        description: `${brand.description}${descriptor.year ? ` Holiday lineup for ${descriptor.year}.` : ''}`,
        canonicalPath: canonical,
        schema: {
          '@context': 'https://schema.org',
          '@type': 'CollectionPage',
          name: `${brand.name}${yearSuffix}`,
          url: `${SITE_ORIGIN}${canonical}`,
        },
      });
    } else if (descriptor.type === 'movie') {
      if (view.status !== 'ready') return;
      const m = (view.payload as Partial<MovieDetailPayload>).movie;
      if (!m) return;
      const canonical = getMoviePath(m.tmdbId, m.slug);
      updateSeoTags({
        title: `${m.title} (${m.year}) — XmasDB.com`,
        description: m.synopsis,
        canonicalPath: canonical,
        image: m.posterUrl,
        schema: {
          '@context': 'https://schema.org',
          '@type': 'Movie',
          name: m.title,
          url: `${SITE_ORIGIN}${canonical}`,
          description: m.synopsis,
          image: m.posterUrl,
          datePublished: `${m.year}`,
          director: m.director ? { '@type': 'Person', name: m.director } : undefined,
          actor: m.cast.map((c) => ({
            '@type': 'Person',
            name: c.name,
            url: `${SITE_ORIGIN}${getActorPath(c.resolvedTmdbPersonId ?? c.tmdbPersonId ?? 0, c.slug)}`,
          })),
        },
      });
    } else if (descriptor.type === 'actor') {
      if (view.status !== 'ready') return;
      const a = (view.payload as Partial<ActorDetailPayload>).actor;
      if (!a) return;
      const canonical = getActorPath(a.tmdbPersonId, a.slug);
      updateSeoTags({
        title: `${a.name} Christmas Movies & Filmography — XmasDB.com`,
        description: `${a.name}'s complete holiday movie archive and credits on XmasDB.com. ${a.notableRoles || ''}`,
        canonicalPath: canonical,
        image: a.photoUrl,
        schema: {
          '@context': 'https://schema.org',
          '@type': 'Person',
          name: a.name,
          url: `${SITE_ORIGIN}${canonical}`,
          image: a.photoUrl,
          jobTitle: 'Actor',
        },
      });
    } else if (descriptor.type === 'feeds') {
      updateSeoTags({
        title: 'Radarr Feeds — XmasDB.com',
        description: 'Add XmasDB Christmas movie collections directly to Radarr with updated collection feeds.',
        canonicalPath: getFeedsPath(),
      });
    }
  }, [descriptor, view, meta]);

  // Correct out-of-range page / unsupported perPage values after the server resolves.
  const listingPayload =
    view.status === 'ready' &&
    (descriptor.type === 'movies' || descriptor.type === 'year-archive' || descriptor.type === 'brand')
      ? (view.payload as CatalogueListing)
      : null;

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

      <main className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6">
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

            {searchResults && searchResults.actors.length > 0 && (
              <div className="mb-8 p-4 rounded-lg bg-[#F5EFE6] border border-[#DDD4C6]">
                <h3 className="text-sm font-heading font-semibold text-[#1A3D2F] uppercase tracking-wider mb-2">
                  Actors
                </h3>
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
            )}

            {searchResults && (
              <MovieGrid
                movies={searchResults.movies}
                onSelectMovie={selectMovie}
                emptyMessage={`No movies found matching "${searchQuery}".`}
              />
            )}
          </div>
        ) : view.status === 'loading' ? (
          <div className="py-24 text-center text-[#736B63] font-body" aria-live="polite">
            Loading&hellip;
          </div>
        ) : view.status === 'error' ? (
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
        ) : view.status === 'not-found' || descriptor.type === 'not-found' ? (
          <NotFoundPage onNavigate={navigate} />
        ) : (
          <>
            {descriptor.type === 'home' && (
              <HomePage payload={view.payload as HomePayload} onNavigate={navigate} />
            )}

            {descriptor.type === 'movies' && listingPayload && (
              <div className="py-6 sm:py-8" id="all-movies-view">
                <div className="text-center mb-2">
                  <h2 className="text-2xl sm:text-3xl font-heading font-semibold text-[#1A3D2F]">
                    All Christmas Movies
                  </h2>
                </div>

                <YearFilter
                  years={listingPayload.years}
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
                <MovieGrid movies={listingPayload.movies} onSelectMovie={selectMovie} />
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
                  <h2 className="text-2xl sm:text-3xl font-heading font-semibold text-[#1A3D2F]">
                    Christmas Movies of {descriptor.year}
                  </h2>
                  <p className="text-sm text-[#736B63] font-body mt-1">
                    All holiday releases and TV premieres from {descriptor.year}.
                  </p>
                </div>

                <YearFilter
                  years={listingPayload.years}
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
                    <h2 className="text-2xl sm:text-3xl font-heading font-semibold text-[#1A3D2F]">
                      {brand.name} {descriptor.year ? `(${descriptor.year})` : ''}
                    </h2>
                    <p className="text-sm text-[#736B63] font-body mt-1">
                      {brand.description}
                    </p>
                  </div>

                  <YearFilter
                    years={listingPayload.years}
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

            {descriptor.type === 'movie' && view.status === 'ready' && (() => {
              const payload = view.payload as Partial<MovieDetailPayload>;
              if (!payload.movie) return <NotFoundPage onNavigate={navigate} />;
              return <MovieDetail movie={payload.movie} related={Array.isArray(payload.related) ? payload.related : []} onNavigate={navigate} />;
            })()}

            {descriptor.type === 'actor' && view.status === 'ready' && (() => {
              const payload = view.payload as Partial<ActorDetailPayload>;
              if (!payload.actor) return <NotFoundPage onNavigate={navigate} />;
              return (
                <ActorDetail
                  actor={payload.actor}
                  filmography={Array.isArray(payload.filmography) ? payload.filmography : []}
                  backdropUrl={payload.backdropUrl ?? null}
                  onNavigate={navigate}
                  onSelectMovie={selectMovie}
                />
              );
            })()}

            {descriptor.type === 'feeds' && view.status === 'ready' && (
              <FeedsPage meta={view.payload as FeedsMetaPayload} />
            )}
          </>
        )}
      </main>

      <Footer onNavigate={navigate} populatedBrands={populatedBrands} />
      <ScrollToTopButton />
    </div>
  );
}
