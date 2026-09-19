import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Search, X, Film, User } from 'lucide-react';
import { MOVIES } from '../data/movies';
import { getAllActors } from '../data/actors';
import { getBrandById } from '../data/brands';
import { getMoviePath, getActorPath } from '../utils/urls';
import { Movie, Actor } from '../types';
import { getMoviePoster } from '../utils/posters';

interface SearchAutocompleteProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onNavigate: (path: string) => void;
}

type AutocompleteItem =
  | { type: 'movie'; movie: Movie }
  | { type: 'actor'; actor: Actor; movieCount: number }
  | { type: 'view-all'; total: number };

// Helper to subtly highlight matched query substring
function highlightMatch(text: string, query: string) {
  if (!query || !query.trim()) return <>{text}</>;
  const trimmed = query.trim();
  const escaped = trimmed.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`(${escaped})`, 'gi');
  const parts = text.split(regex);

  return (
    <>
      {parts.map((part, index) =>
        regex.test(part) ? (
          <span
            key={index}
            className="font-bold text-[#841818] underline decoration-[#841818]/30 decoration-1"
          >
            {part}
          </span>
        ) : (
          part
        )
      )}
    </>
  );
}

// Fallback image item for movies with error handling
const MoviePosterThumbnail: React.FC<{ movie: Movie; brandName?: string }> = ({
  movie,
  brandName,
}) => {
  const [imgError, setImgError] = useState(false);
  const poster = getMoviePoster(movie);

  if (imgError || !poster) {
    return (
      <div className="w-10 h-[60px] shrink-0 rounded bg-[#EAE2D7] border border-[#DDD3C6] flex flex-col items-center justify-center p-1 text-center shadow-2xs">
        <Film className="w-4 h-4 text-[#8C8379] opacity-70 mb-0.5" />
        <span className="text-[9px] font-sans-clean font-semibold uppercase tracking-wider text-[#736B63] line-clamp-1 leading-none">
          {brandName || 'Xmas'}
        </span>
      </div>
    );
  }

  return (
    <div className="w-10 h-[60px] shrink-0 rounded overflow-hidden bg-[#EAE2D7] border border-[#DDD3C6] shadow-2xs">
      <img
        src={poster}
        alt={movie.title}
        loading="lazy"
        referrerPolicy="no-referrer"
        onError={() => setImgError(true)}
        className="w-full h-full object-cover object-center"
      />
    </div>
  );
};

// Fallback image item for actors with error handling
const ActorProfileThumbnail: React.FC<{ actor: Actor }> = ({ actor }) => {
  const [imgError, setImgError] = useState(false);
  const photo = actor.profileUrl || actor.photoUrl;

  if (imgError || !photo) {
    return (
      <div className="w-10 h-[50px] shrink-0 rounded bg-[#EAE2D7] border border-[#DDD3C6] flex flex-col items-center justify-center text-center shadow-2xs">
        <User className="w-4 h-4 text-[#8C8379] opacity-70" />
      </div>
    );
  }

  return (
    <div className="w-10 h-[50px] shrink-0 rounded overflow-hidden bg-[#EAE2D7] border border-[#DDD3C6] shadow-2xs">
      <img
        src={photo}
        alt={actor.name}
        loading="lazy"
        referrerPolicy="no-referrer"
        onError={() => setImgError(true)}
        className="w-full h-full object-cover object-center"
      />
    </div>
  );
};

export const SearchAutocomplete: React.FC<SearchAutocompleteProps> = ({
  searchQuery,
  onSearchChange,
  onNavigate,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Precompute actor Christmas movie counts in XmasDB
  const actorMovieCounts = useMemo(() => {
    const map = new Map<string, number>();
    for (const movie of MOVIES) {
      for (const member of movie.cast) {
        const slug = member.slug.toLowerCase().trim();
        map.set(slug, (map.get(slug) || 0) + 1);
      }
    }
    return map;
  }, []);

  const allActors = useMemo(() => getAllActors(), []);

  // Filter movies and actors locally with instant response
  const query = searchQuery.trim().toLowerCase();
  const shouldSearch = query.length >= 2;

  const { matchingMovies, matchingActors } = useMemo(() => {
    if (!shouldSearch) {
      return { matchingMovies: [], matchingActors: [] };
    }

    // Match movies: title matches take priority, then synopsis and cast
    const movies = MOVIES.filter((m) => {
      const titleMatch = m.title.toLowerCase().includes(query);
      const castMatch = m.cast.some((c) => c.name.toLowerCase().includes(query));
      return titleMatch || castMatch;
    }).sort((a, b) => {
      const aTitleMatch = a.title.toLowerCase().includes(query);
      const bTitleMatch = b.title.toLowerCase().includes(query);
      if (aTitleMatch && !bTitleMatch) return -1;
      if (!aTitleMatch && bTitleMatch) return 1;
      return b.year - a.year;
    });

    // Match actors: name matches
    const actors = allActors.filter((a) => a.name.toLowerCase().includes(query));

    return {
      matchingMovies: movies,
      matchingActors: actors,
    };
  }, [query, shouldSearch, allActors]);

  const displayedMovies = useMemo(() => matchingMovies.slice(0, 5), [matchingMovies]);
  const displayedActors = useMemo(() => matchingActors.slice(0, 5), [matchingActors]);

  const hasAdditionalResults =
    matchingMovies.length > displayedMovies.length ||
    matchingActors.length > displayedActors.length;

  const totalResultsCount = matchingMovies.length + matchingActors.length;

  // Flatten selectable items for clean keyboard navigation
  const selectableItems = useMemo<AutocompleteItem[]>(() => {
    if (!shouldSearch) return [];
    const items: AutocompleteItem[] = [];

    displayedMovies.forEach((movie) => {
      items.push({ type: 'movie', movie });
    });

    displayedActors.forEach((actor) => {
      const count = actorMovieCounts.get(actor.slug.toLowerCase()) || 0;
      items.push({ type: 'actor', actor, movieCount: count });
    });

    if (hasAdditionalResults) {
      items.push({ type: 'view-all', total: totalResultsCount });
    }

    return items;
  }, [
    shouldSearch,
    displayedMovies,
    displayedActors,
    actorMovieCounts,
    hasAdditionalResults,
    totalResultsCount,
  ]);

  // Reset selectedIndex whenever suggestions change
  useEffect(() => {
    setSelectedIndex(-1);
  }, [searchQuery]);

  // Show dropdown when query length >= 2
  useEffect(() => {
    if (shouldSearch) {
      setIsOpen(true);
    } else {
      setIsOpen(false);
    }
  }, [shouldSearch]);

  // Click outside listener to close dropdown
  useEffect(() => {
    const handleDocumentClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleDocumentClick);
    return () => {
      document.removeEventListener('mousedown', handleDocumentClick);
    };
  }, []);

  const handleSelectItem = (item: AutocompleteItem) => {
    if (item.type === 'movie') {
      const path = getMoviePath(item.movie.tmdbId, item.movie.slug);
      setIsOpen(false);
      onNavigate(path);
    } else if (item.type === 'actor') {
      const path = getActorPath(item.actor.tmdbPersonId, item.actor.slug);
      setIsOpen(false);
      onNavigate(path);
    } else if (item.type === 'view-all') {
      setIsOpen(false);
      // App.tsx renders the in-page search results when searchQuery is non-empty
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen || selectableItems.length === 0) {
      if (e.key === 'Enter') {
        // Submit full search if pressed without open autocomplete
        setIsOpen(false);
      }
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev < selectableItems.length - 1 ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : selectableItems.length - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (selectedIndex >= 0 && selectedIndex < selectableItems.length) {
        handleSelectItem(selectableItems[selectedIndex]);
      } else {
        setIsOpen(false);
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setIsOpen(false);
      inputRef.current?.blur();
    }
  };

  return (
    <div ref={containerRef} className="max-w-md mx-auto relative w-full">
      {/* Search Input Field */}
      <div className="relative flex items-center">
        <Search
          className="absolute left-3 w-4 h-4 text-[#8C8379] pointer-events-none"
          aria-hidden="true"
        />
        <input
          ref={inputRef}
          type="text"
          id="search-input"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          onFocus={() => {
            if (searchQuery.trim().length >= 2) {
              setIsOpen(true);
            }
          }}
          onKeyDown={handleKeyDown}
          placeholder="Search movies or actors..."
          autoComplete="off"
          role="combobox"
          aria-expanded={isOpen}
          aria-autocomplete="list"
          aria-controls="search-autocomplete-listbox"
          className="w-full pl-9 pr-9 py-1.5 rounded bg-[#FFFDF9] border border-[#DCD3C7] text-[#23211E] placeholder-[#8C8379] text-sm focus:outline-none focus:ring-1 focus:ring-[#1A3D2F] focus:border-[#1A3D2F] shadow-2xs font-sans-clean transition-colors"
        />
        {searchQuery && (
          <button
            type="button"
            id="search-clear-btn"
            onClick={() => {
              onSearchChange('');
              setIsOpen(false);
              inputRef.current?.focus();
            }}
            className="absolute right-2.5 p-1 text-[#8C8379] hover:text-[#23211E] rounded transition-colors cursor-pointer"
            title="Clear search"
            aria-label="Clear search"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Autocomplete Dropdown */}
      {isOpen && shouldSearch && (
        <div
          id="search-autocomplete-listbox"
          role="listbox"
          className="absolute top-full left-0 right-0 mt-1.5 z-50 bg-[#FFFDF9] border border-[#DCD3C7] rounded-lg shadow-lg overflow-hidden max-h-[72vh] overflow-y-auto text-left"
        >
          {selectableItems.length === 0 ? (
            <div className="p-4 text-center text-xs sm:text-sm text-[#736B63] font-body">
              No Christmas movies or actors found matching &ldquo;{searchQuery}&rdquo;.
            </div>
          ) : (
            <div className="py-1 divide-y divide-[#EFE8DD]">
              {/* MOVIES SECTION */}
              {displayedMovies.length > 0 && (
                <div id="autocomplete-movies-section">
                  <div className="px-3.5 pt-2 pb-1 text-[11px] font-sans-clean font-semibold uppercase tracking-wider text-[#736B63] bg-[#FAF7F2]/80 sticky top-0 z-10 border-b border-[#EFE8DD]">
                    Movies
                  </div>
                  <div>
                    {displayedMovies.map((movie, idx) => {
                      const itemIndex = idx;
                      const isSelected = selectedIndex === itemIndex;
                      const brand = getBrandById(movie.brandId);
                      const brandName = brand ? brand.shortName : movie.brandId.toUpperCase();
                      const path = getMoviePath(movie.tmdbId, movie.slug);

                      return (
                        <a
                          key={`movie-${movie.id}`}
                          href={path}
                          role="option"
                          aria-selected={isSelected}
                          id={`autocomplete-movie-${movie.slug}`}
                          onClick={(e) => {
                            e.preventDefault();
                            handleSelectItem({ type: 'movie', movie });
                          }}
                          onMouseEnter={() => setSelectedIndex(itemIndex)}
                          className={`flex items-center gap-3 px-3.5 py-2 transition-colors cursor-pointer text-inherit no-underline ${
                            isSelected ? 'bg-[#F2ECE3]' : 'hover:bg-[#F8F4EE]'
                          }`}
                        >
                          <MoviePosterThumbnail movie={movie} brandName={brandName} />
                          <div className="min-w-0 flex-1">
                            <div className="font-heading text-sm font-semibold text-[#1A3D2F] line-clamp-1 leading-snug">
                              {highlightMatch(movie.title, searchQuery)}
                            </div>
                            <div className="text-xs text-[#736B63] font-body mt-0.5 flex items-center gap-1">
                              <span>{movie.year}</span>
                              <span className="text-[#C4BCB1]">·</span>
                              <span className="text-[#59524A] font-medium">{brandName}</span>
                            </div>
                          </div>
                        </a>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* ACTORS SECTION */}
              {displayedActors.length > 0 && (
                <div id="autocomplete-actors-section">
                  <div className="px-3.5 pt-2 pb-1 text-[11px] font-sans-clean font-semibold uppercase tracking-wider text-[#736B63] bg-[#FAF7F2]/80 sticky top-0 z-10 border-b border-[#EFE8DD]">
                    Actors
                  </div>
                  <div>
                    {displayedActors.map((actor, idx) => {
                      const itemIndex = displayedMovies.length + idx;
                      const isSelected = selectedIndex === itemIndex;
                      const count = actorMovieCounts.get(actor.slug.toLowerCase()) || 0;
                      const movieCountText = `${count} ${count === 1 ? 'Christmas movie' : 'Christmas movies'}`;
                      const path = getActorPath(actor.tmdbPersonId, actor.slug);

                      return (
                        <a
                          key={`actor-${actor.slug}`}
                          href={path}
                          role="option"
                          aria-selected={isSelected}
                          id={`autocomplete-actor-${actor.slug}`}
                          onClick={(e) => {
                            e.preventDefault();
                            handleSelectItem({ type: 'actor', actor, movieCount: count });
                          }}
                          onMouseEnter={() => setSelectedIndex(itemIndex)}
                          className={`flex items-center gap-3 px-3.5 py-2 transition-colors cursor-pointer text-inherit no-underline ${
                            isSelected ? 'bg-[#F2ECE3]' : 'hover:bg-[#F8F4EE]'
                          }`}
                        >
                          <ActorProfileThumbnail actor={actor} />
                          <div className="min-w-0 flex-1">
                            <div className="font-heading text-sm font-semibold text-[#1A3D2F] line-clamp-1 leading-snug">
                              {highlightMatch(actor.name, searchQuery)}
                            </div>
                            <div className="text-xs text-[#841818] font-body mt-0.5">
                              {movieCountText}
                            </div>
                          </div>
                        </a>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* VIEW ALL RESULTS OPTION (if additional results exist) */}
              {hasAdditionalResults && (
                <div className="p-1.5 bg-[#FAF7F2]/50 text-center">
                  <button
                    type="button"
                    id="autocomplete-view-all-btn"
                    onClick={() => {
                      handleSelectItem({ type: 'view-all', total: totalResultsCount });
                    }}
                    onMouseEnter={() => setSelectedIndex(selectableItems.length - 1)}
                    className={`w-full py-1.5 px-3 rounded text-xs font-sans-clean font-medium text-[#1A3D2F] hover:text-[#841818] transition-colors cursor-pointer flex items-center justify-center gap-1 ${
                      selectedIndex === selectableItems.length - 1 ? 'bg-[#F2ECE3]' : ''
                    }`}
                  >
                    <span>View all {totalResultsCount} results</span>
                    <span aria-hidden="true">&rarr;</span>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
