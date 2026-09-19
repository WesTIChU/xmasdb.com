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
import { NotFoundPage } from './components/NotFoundPage';
import {
  MOVIES,
  getMovieBySlug,
  getMovieByTmdbId,
  getMovieByTmdbIdAndSlug,
  getAllYearsForBrand,
} from './data/movies';
import { getBrandBySlug, getPopulatedBrands } from './data/brands';
import {
  getActorBySlug,
  getActorByTmdbId,
  getAllActors,
  getTmdbPersonIdForSlug,
} from './data/actors';
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
import { Movie, Actor, Brand } from './types';
import { buildCatalogueUrl, getCataloguePage, parseCatalogueQuery } from './utils/catalogue-pagination';

type RouteState =
  | { type: 'home' }
  | { type: 'movies' }
  | { type: 'year-archive'; year: number }
  | { type: 'brand'; brand: Brand; year?: number | null }
  | { type: 'movie'; movie: Movie }
  | { type: 'actor'; actor: Actor }
  | { type: 'not-found' }
  | { type: 'feeds' };

export default function App() {
  const [currentPath, setCurrentPath] = useState<string>(() => {
    if (typeof window !== 'undefined') {
       return `${window.location.pathname || '/'}${window.location.search}`;
    }
    return '/';
  });

  const [searchQuery, setSearchQuery] = useState<string>('');

  // Sync state with browser popstate
  useEffect(() => {
    const handlePopState = () => {
      setCurrentPath(`${window.location.pathname || '/'}${window.location.search}`);
      setSearchQuery('');
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Navigation helper
  const navigate = (path: string) => {
    const currentUrl = `${window.location.pathname}${window.location.search}`;
    if (currentUrl !== path) {
      window.history.pushState({}, '', path);
    }
    setCurrentPath(path);
    setSearchQuery('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Route matching with canonical resolution
  const route: RouteState = useMemo(() => {
    const rawPath = currentPath.split('?')[0].trim();
    // Normalize path for matching (strip leading/trailing slashes for parsing segments)
    const clean = rawPath.replace(/^\/+|\/+$/g, '');

    // 1. Home / Landing page
    if (!clean) {
      return { type: 'home' };
    }

    // 2. All movies catalogue (/movies/ or legacy /all/)
    if (clean === 'movies' || clean === 'all') {
      return { type: 'movies' };
    }

    // 3. Human-facing feeds page (/feeds/)
    if (clean === 'feeds') {
      return { type: 'feeds' };
    }

    // 4. All-network year archive (/year/{year}/)
    const yearArchiveMatch = clean.match(/^year\/(\d+)$/i);
    if (yearArchiveMatch) {
      const year = parseInt(yearArchiveMatch[1], 10);
      return { type: 'year-archive', year };
    }

    // 5. Individual movie canonical URL: /movie/{tmdbId}/{slug}/ (or legacy /movie/{slug})
    const movieMatch = clean.match(/^movie\/(.+)$/i);
    if (movieMatch) {
      const parts = movieMatch[1].split('/').filter(Boolean);
      let foundMovie: Movie | undefined;

      if (parts.length === 2) {
        // Form: /movie/{tmdbId}/{slug}
        const tmdbIdNum = parseInt(parts[0], 10);
        if (!isNaN(tmdbIdNum)) {
          foundMovie = getMovieByTmdbIdAndSlug(tmdbIdNum, parts[1]);
        }
      } else if (parts.length === 1) {
        // Form: /movie/{identifier} (could be TMDB ID or legacy slug)
        const idNum = parseInt(parts[0], 10);
        if (!isNaN(idNum)) {
          foundMovie = getMovieByTmdbId(idNum);
        }
        if (!foundMovie) {
          foundMovie = getMovieBySlug(parts[0]);
        }
      }

      if (foundMovie) {
        // Canonicalize URL in browser history if it deviates from canonical
        const canonical = getMoviePath(foundMovie.tmdbId, foundMovie.slug);
        if (typeof window !== 'undefined' && window.location.pathname !== canonical) {
          window.history.replaceState({}, '', canonical);
        }
        return { type: 'movie', movie: foundMovie };
      }

      return { type: 'not-found' };
    }

    // 6. Individual actor canonical URL: /actor/{tmdbPersonId}/{slug}/ (or legacy /actor/{slug})
    const actorMatch = clean.match(/^actor\/(.+)$/i);
    if (actorMatch) {
      const parts = actorMatch[1].split('/').filter(Boolean);
      let foundActor: Actor | undefined;

      if (parts.length === 2) {
        // Form: /actor/{tmdbPersonId}/{slug}
        const personIdNum = parseInt(parts[0], 10);
        if (!isNaN(personIdNum)) {
          foundActor = getActorByTmdbId(personIdNum);
        }
        if (!foundActor) {
          foundActor = getActorBySlug(parts[1]);
        }
      } else if (parts.length === 1) {
        // Form: /actor/{identifier}
        const idNum = parseInt(parts[0], 10);
        if (!isNaN(idNum)) {
          foundActor = getActorByTmdbId(idNum);
        }
        if (!foundActor) {
          foundActor = getActorBySlug(parts[0]);
        }
      }

      if (foundActor) {
        const canonical = getActorPath(foundActor.tmdbPersonId, foundActor.slug);
        if (typeof window !== 'undefined' && window.location.pathname !== canonical) {
          window.history.replaceState({}, '', canonical);
        }
        return { type: 'actor', actor: foundActor };
      }

      return { type: 'not-found' };
    }

    // 7. Network / Brand routes: /{brand}/ or /{brand}/{year}/
    const brandParts = clean.split('/').filter(Boolean);
    if (brandParts.length === 1 || brandParts.length === 2) {
        const brand = getBrandBySlug(brandParts[0]);
        const isPopulatedBrand = brand ? getPopulatedBrands(MOVIES).some((populatedBrand) => populatedBrand.id === brand.id) : false;
        if (brand && isPopulatedBrand) {
          let year: number | null = null;
          if (brandParts.length === 2) {
            const yr = parseInt(brandParts[1], 10);
            if (isNaN(yr) || !/^\d+$/.test(brandParts[1])) return { type: 'not-found' };
            year = yr;
          }
        return { type: 'brand', brand, year };
      }
    }

    return { type: 'not-found' };
  }, [currentPath]);

  // Dynamic SEO and Structured Data updates on route change
  useEffect(() => {
    if (route.type === 'home') {
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
    } else if (route.type === 'movies') {
      updateSeoTags({
        title: 'All Christmas Movies — XmasDB.com',
        description: `Explore all ${MOVIES.length} Christmas movies in the XmasDB archive across Hallmark, Lifetime, and holiday networks.`,
        canonicalPath: getMoviesPath(),
        schema: {
          '@context': 'https://schema.org',
          '@type': 'CollectionPage',
          name: 'All Christmas Movies',
          url: `${SITE_ORIGIN}${getMoviesPath()}`,
          description: 'Complete catalogue of holiday films.',
        },
      });
    } else if (route.type === 'year-archive') {
      updateSeoTags({
        title: `Christmas Movies Released in ${route.year} — XmasDB.com`,
        description: `Discover all Hallmark, Lifetime, and TV Christmas movies released in ${route.year}.`,
        canonicalPath: getYearPath(route.year),
        schema: {
          '@context': 'https://schema.org',
          '@type': 'CollectionPage',
          name: `Christmas Movies of ${route.year}`,
          url: `${SITE_ORIGIN}${getYearPath(route.year)}`,
        },
      });
    } else if (route.type === 'brand') {
      const yearSuffix = route.year ? ` (${route.year})` : '';
      const canonical = getNetworkPath(route.brand.slug, route.year);
      updateSeoTags({
        title: `${route.brand.name}${yearSuffix} — XmasDB.com`,
        description: `${route.brand.description}${route.year ? ` Holiday lineup for ${route.year}.` : ''}`,
        canonicalPath: canonical,
        schema: {
          '@context': 'https://schema.org',
          '@type': 'CollectionPage',
          name: `${route.brand.name}${yearSuffix}`,
          url: `${SITE_ORIGIN}${canonical}`,
        },
      });
    } else if (route.type === 'movie') {
      const m = route.movie;
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
            url: `${SITE_ORIGIN}${getActorPath(c.tmdbPersonId || getTmdbPersonIdForSlug(c.slug), c.slug)}`,
          })),
        },
      });
    } else if (route.type === 'actor') {
      const a = route.actor;
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
    } else if (route.type === 'feeds') {
      updateSeoTags({
        title: 'Radarr Feeds — XmasDB.com',
        description: 'Add XmasDB Christmas movie collections directly to Radarr with updated collection feeds.',
        canonicalPath: getFeedsPath(),
      });
    } else if (route.type === 'not-found') {
      updateSeoTags({
        title: 'Page Not Found | XmasDB',
        description: 'The Christmas movie page you are looking for could not be found on XmasDB.',
        noIndex: true,
      });
    }
  }, [route]);

  const cataloguePathname = currentPath.split('?')[0] || '/';
  const catalogueSearch = currentPath.includes('?') ? currentPath.slice(currentPath.indexOf('?')) : '';
  const catalogueQuery = useMemo(() => parseCatalogueQuery(catalogueSearch), [catalogueSearch]);
  const allMoviesPage = useMemo(() => getCataloguePage(MOVIES, catalogueQuery), [catalogueQuery]);
  const yearMoviesPage = route.type === 'year-archive'
    ? getCataloguePage(MOVIES, catalogueQuery, undefined, route.year)
    : null;
  const brandMoviesPage = route.type === 'brand'
    ? getCataloguePage(MOVIES, catalogueQuery, route.brand.id, route.year || undefined)
    : null;
  const activeCataloguePage = route.type === 'movies' ? allMoviesPage : yearMoviesPage || brandMoviesPage;

  useEffect(() => {
    if (!activeCataloguePage || typeof window === 'undefined') return;
    const params = new URLSearchParams(catalogueSearch);
    const requestedPage = Number(params.get('page'));
    const requestedPerPage = Number(params.get('perPage'));
    const changes: Record<string, string | number | undefined> = {};
    if (params.has('page') && (!Number.isInteger(requestedPage) || requestedPage < 1 || requestedPage !== activeCataloguePage.page)) {
      changes.page = activeCataloguePage.page;
    }
    if (params.has('perPage') && ![24, 48, 96].includes(requestedPerPage)) changes.perPage = 24;
    if (Object.keys(changes).length > 0) {
      const corrected = buildCatalogueUrl(cataloguePathname, catalogueSearch, changes, false);
      window.history.replaceState({}, '', corrected);
      setCurrentPath(corrected);
    }
  }, [activeCataloguePage, cataloguePathname, catalogueSearch]);

  // Search filtering logic (searches across both movies and actors)
  const searchResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return null;

    const matchedMovies = MOVIES.filter(
      (m) =>
        m.title.toLowerCase().includes(q) ||
        m.synopsis.toLowerCase().includes(q) ||
        m.cast.some((c) => c.name.toLowerCase().includes(q))
    );

    const allActors = getAllActors();
    const matchedActors = allActors.filter((a) =>
      a.name.toLowerCase().includes(q)
    );

    return {
      movies: matchedMovies,
      actors: matchedActors,
    };
  }, [searchQuery]);

  return (
      <div className="min-h-screen flex flex-col bg-[#FAF7F2] text-[#23211E] relative">
      <SnowEffect />
      <CatalogueStatsStrip onNavigate={navigate} />
      <Header
        currentPath={currentPath}
        onNavigate={navigate}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
      />

      <main className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6">
        {/* Search Results View */}
        {searchResults ? (
          <div className="py-6 sm:py-8" id="search-results-section">
            <div className="border-b border-[#E7DFD5] pb-4 mb-6">
              <h2 className="text-xl sm:text-2xl font-heading font-semibold text-[#1A3D2F]">
                Search results for &ldquo;{searchQuery}&rdquo;
              </h2>
              <p className="text-sm text-[#736B63] font-body mt-1">
                Found {searchResults.movies.length} {searchResults.movies.length === 1 ? 'movie' : 'movies'}
                {searchResults.actors.length > 0 && ` and ${searchResults.actors.length} ${searchResults.actors.length === 1 ? 'actor' : 'actors'}`}.
              </p>
            </div>

            {/* Matched Actors */}
            {searchResults.actors.length > 0 && (
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

            {/* Matched Movies */}
            <MovieGrid
              movies={searchResults.movies}
              onSelectMovie={(slug, tmdbId) => {
                const target = tmdbId ? getMovieByTmdbId(tmdbId) : getMovieBySlug(slug);
                if (target) {
                  navigate(getMoviePath(target.tmdbId, target.slug));
                } else {
                  navigate(`/movie/${tmdbId || slug}/`);
                }
              }}
              emptyMessage={`No movies found matching "${searchQuery}".`}
            />
          </div>
        ) : (
          /* Canonical Routes */
          <>
            {/* 1. HOMEPAGE (/) */}
            {route.type === 'home' && (
              <HomePage onNavigate={navigate} />
            )}

            {/* 2. ALL MOVIES (/movies/) */}
            {route.type === 'movies' && (
              <div className="py-6 sm:py-8" id="all-movies-view">
                <div className="text-center mb-2">
                  <h2 className="text-2xl sm:text-3xl font-heading font-semibold text-[#1A3D2F]">
                    All Christmas Movies
                  </h2>
                </div>

                <YearFilter
                  years={getAllYearsForBrand()}
                  selectedYear={null}
                  onSelectYear={(year) => {
                    if (year) {
                      navigate(getYearPath(year));
                    } else {
                      navigate(getMoviesPath());
                    }
                  }}
                />

                <CatalogueControls
                  pathname={cataloguePathname}
                  search={catalogueSearch}
                  query={catalogueQuery}
                  total={allMoviesPage.total}
                  page={allMoviesPage.page}
                  onNavigate={navigate}
                />
                <MovieGrid
                  movies={allMoviesPage.movies}
                  onSelectMovie={(slug, tmdbId) => {
                    const target = tmdbId ? getMovieByTmdbId(tmdbId) : getMovieBySlug(slug);
                    if (target) {
                      navigate(getMoviePath(target.tmdbId, target.slug));
                    }
                  }}
                />
                <CataloguePagination
                  pathname={cataloguePathname}
                  search={catalogueSearch}
                  page={allMoviesPage.page}
                  totalPages={allMoviesPage.totalPages}
                  onNavigate={navigate}
                />
              </div>
            )}

            {/* 3. ALL-NETWORK YEAR ARCHIVE (/year/{year}/) */}
            {route.type === 'year-archive' && (
              <div className="py-6 sm:py-8" id={`year-view-${route.year}`}>
                <div className="text-center mb-2">
                  <h2 className="text-2xl sm:text-3xl font-heading font-semibold text-[#1A3D2F]">
                    Christmas Movies of {route.year}
                  </h2>
                  <p className="text-sm text-[#736B63] font-body mt-1">
                    All holiday releases and TV premieres from {route.year}.
                  </p>
                </div>

                <YearFilter
                  years={getAllYearsForBrand()}
                  selectedYear={route.year}
                  onSelectYear={(year) => {
                    if (year) {
                      navigate(getYearPath(year));
                    } else {
                      navigate(getMoviesPath());
                    }
                  }}
                />

                {yearMoviesPage && <CatalogueControls pathname={cataloguePathname} search={catalogueSearch} query={catalogueQuery} total={yearMoviesPage.total} page={yearMoviesPage.page} onNavigate={navigate} />}
                <MovieGrid
                  movies={yearMoviesPage?.movies || []}
                  onSelectMovie={(slug, tmdbId) => {
                    const target = tmdbId ? getMovieByTmdbId(tmdbId) : getMovieBySlug(slug);
                    if (target) {
                      navigate(getMoviePath(target.tmdbId, target.slug));
                    }
                  }}
                  emptyMessage={`No Christmas movies listed for ${route.year}.`}
                />
                {yearMoviesPage && (
                  <>
                    <CataloguePagination pathname={cataloguePathname} search={catalogueSearch} page={yearMoviesPage.page} totalPages={yearMoviesPage.totalPages} onNavigate={navigate} />
                  </>
                )}
              </div>
            )}

            {/* 4. NETWORK ARCHIVE & NETWORK YEAR ARCHIVE (/{brand}/ or /{brand}/{year}/) */}
            {route.type === 'brand' && (
              <div className="py-6 sm:py-8" id={`brand-view-${route.brand.slug}`}>
                <div className="text-center mb-2">
                  <h2 className="text-2xl sm:text-3xl font-heading font-semibold text-[#1A3D2F]">
                    {route.brand.name} {route.year ? `(${route.year})` : ''}
                  </h2>
                  <p className="text-sm text-[#736B63] font-body mt-1">
                    {route.brand.description}
                  </p>
                </div>

                {/* Network-specific Year Filter */}
                <YearFilter
                  years={getAllYearsForBrand(route.brand.id)}
                  selectedYear={route.year || null}
                  brandSlug={route.brand.slug}
                  onSelectYear={(year) => {
                    navigate(getNetworkPath(route.brand.slug, year));
                  }}
                />

                {brandMoviesPage && <CatalogueControls pathname={cataloguePathname} search={catalogueSearch} query={catalogueQuery} total={brandMoviesPage.total} page={brandMoviesPage.page} onNavigate={navigate} />}
                <MovieGrid
                  movies={brandMoviesPage?.movies || []}
                  onSelectMovie={(slug, tmdbId) => {
                    const target = tmdbId ? getMovieByTmdbId(tmdbId) : getMovieBySlug(slug);
                    if (target) {
                      navigate(getMoviePath(target.tmdbId, target.slug));
                    }
                  }}
                  emptyMessage={
                    route.year
                      ? `No ${route.brand.shortName} Christmas movies listed for ${route.year}.`
                      : `No movies found for ${route.brand.shortName}.`
                  }
                />
                {brandMoviesPage && (
                  <>
                    <CataloguePagination pathname={cataloguePathname} search={catalogueSearch} page={brandMoviesPage.page} totalPages={brandMoviesPage.totalPages} onNavigate={navigate} />
                  </>
                )}
              </div>
            )}

            {/* 5. MOVIE DETAIL (/movie/{tmdbId}/{slug}/) */}
            {route.type === 'movie' && (
              <MovieDetail movie={route.movie} onNavigate={navigate} />
            )}

            {/* 6. ACTOR DETAIL (/actor/{tmdbPersonId}/{slug}/) */}
            {route.type === 'actor' && (
              <ActorDetail
                actor={route.actor}
                movies={MOVIES.filter((movie) => movie.cast.some((cast) => cast.tmdbPersonId === route.actor.tmdbPersonId))}
                onNavigate={navigate}
                onSelectMovie={(slug, tmdbId) => {
                  const target = tmdbId ? getMovieByTmdbId(tmdbId) : getMovieBySlug(slug);
                  if (target) {
                    navigate(getMoviePath(target.tmdbId, target.slug));
                  }
                }}
              />
            )}

            {/* 7. FEEDS PAGE (/feeds/) */}
            {route.type === 'feeds' && <FeedsPage />}

            {route.type === 'not-found' && <NotFoundPage onNavigate={navigate} />}
          </>
        )}
      </main>

      <Footer onNavigate={navigate} />
      <ScrollToTopButton />
    </div>
  );
}
