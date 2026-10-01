import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Search, X, Film, User } from 'lucide-react';
import type {
  SearchIndexPayload,
  SearchIngredientEntry,
  SearchMovieEntry,
  SearchPersonEntry,
} from '../api/types';
import { SEARCH_INDEX_URL, fetchSearchIndex, peekResolved } from '../api/client';
import { getBrandById } from '../data/brands';
import { FingerprintIcon } from './FingerprintIcon';
import { getMoviePath, getActorPath, getFingerprintPath } from '../utils/urls';
import { getMoviePoster } from '../utils/posters';
import { resolveImageUrl } from '../utils/image-url';
import {
  compareScoredResults,
  scoreActorSearchResult,
  scoreIngredientSearchResult,
  scoreMovieSearchEntry,
} from '../utils/search-relevance';

interface SearchAutocompleteProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onNavigate: (path: string) => void;
}

type AutocompleteItem =
  | { type: 'movie'; movie: SearchMovieEntry }
  | { type: 'actor'; actor: SearchPersonEntry; movieCount: number }
  | { type: 'ingredient'; ingredient: SearchIngredientEntry }
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
        index % 2 === 1 ? (
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
const movieThumbnailClass = 'w-10 aspect-[2/3] shrink-0 overflow-hidden rounded bg-[#EAE2D7] border border-[#DDD3C6] shadow-2xs';

const MoviePosterThumbnail: React.FC<{ movie: SearchMovieEntry; brandName?: string }> = ({
  movie,
  brandName,
}) => {
  const [imgError, setImgError] = useState(false);
  const poster = getMoviePoster(movie);

  if (imgError || !poster) {
    return (
      <div className={`${movieThumbnailClass} flex flex-col items-center justify-center p-0.5 text-center`}>
        <Film className="w-4 h-4 text-[#6F675E] opacity-70 mb-0.5" />
        <span className="min-w-0 max-w-full overflow-hidden text-ellipsis whitespace-nowrap text-[7px] font-sans-clean font-semibold uppercase tracking-[0.05em] text-[#736B63] leading-none">
          {brandName || 'Xmas'}
        </span>
      </div>
    );
  }

  return (
    <div className={movieThumbnailClass}>
      <img
        src={resolveImageUrl(poster)}
        alt={movie.title}
        width={500}
        height={750}
        loading="lazy"
        referrerPolicy="no-referrer"
        onError={() => setImgError(true)}
        className="w-full h-full object-cover object-center"
      />
    </div>
  );
};

// Fallback image item for actors with error handling
const ActorProfileThumbnail: React.FC<{ actor: SearchPersonEntry }> = ({ actor }) => {
  const [imgError, setImgError] = useState(false);
  const photo = actor.photoUrl;

  if (imgError || !photo) {
    return (
      <div className="w-10 h-[50px] shrink-0 rounded bg-[#EAE2D7] border border-[#DDD3C6] flex flex-col items-center justify-center text-center shadow-2xs">
        <User className="w-4 h-4 text-[#6F675E] opacity-70" />
      </div>
    );
  }

  return (
    <div className="w-10 h-[50px] shrink-0 rounded overflow-hidden bg-[#EAE2D7] border border-[#DDD3C6] shadow-2xs">
      <img
        src={resolveImageUrl(photo)}
        alt={actor.name}
        width={500}
        height={750}
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
  const [isFocused, setIsFocused] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [searchIndex, setSearchIndex] = useState<SearchIndexPayload | null>(
    () => peekResolved<SearchIndexPayload>(SEARCH_INDEX_URL) ?? null
  );
  const containerRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const isExpanded = isFocused || isOpen;

  // Filter movies and actors locally with instant response
  const query = searchQuery.trim().toLowerCase();
  const shouldSearch = query.length >= 2;
  const isLoadingIndex = shouldSearch && searchIndex === null;

  // Load the compact autocomplete index lazily — once, on first real search.
  useEffect(() => {
    if (!shouldSearch || searchIndex) return;
    let active = true;
    fetchSearchIndex()
      .then((index) => {
        if (active) setSearchIndex(index);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [shouldSearch, searchIndex]);

  const { matchingMovies, matchingActors, matchingIngredients } = useMemo(() => {
    if (!shouldSearch || !searchIndex) {
      return {
        matchingMovies: [] as SearchMovieEntry[],
        matchingActors: [] as SearchPersonEntry[],
        matchingIngredients: [] as SearchIngredientEntry[],
      };
    }

    const movies = searchIndex.movies
      .map((movie) => ({ item: movie, score: scoreMovieSearchEntry(movie, query) }))
      .filter((result) => result.score > 0)
      .sort(compareScoredResults)
      .map(({ item }) => item);

    const actors = searchIndex.people
      .map((actor) => ({ item: actor, score: scoreActorSearchResult(actor, query) }))
      .filter((result) => result.score > 0)
      .sort((a, b) => compareScoredResults(a, b) || b.item.movieCount - a.item.movieCount)
      .map(({ item }) => item);

    const ingredients = (searchIndex.ingredients ?? [])
      .map((ingredient) => ({ item: ingredient, score: scoreIngredientSearchResult(ingredient, query) }))
      .filter((result) => result.score > 0)
      .sort(compareScoredResults)
      .map(({ item }) => item);

    return {
      matchingMovies: movies,
      matchingActors: actors,
      matchingIngredients: ingredients,
    };
  }, [query, shouldSearch, searchIndex]);

  const displayedMovies = useMemo(() => matchingMovies.slice(0, 4), [matchingMovies]);
  const displayedActors = useMemo(() => matchingActors.slice(0, 4), [matchingActors]);
  const displayedIngredients = useMemo(() => matchingIngredients.slice(0, 4), [matchingIngredients]);

  const totalResultsCount = matchingMovies.length + matchingActors.length + matchingIngredients.length;

  // Flatten selectable items for clean keyboard navigation
  const selectableItems = useMemo<AutocompleteItem[]>(() => {
    if (!shouldSearch) return [];
    const items: AutocompleteItem[] = [];

    displayedMovies.forEach((movie) => items.push({ type: 'movie', movie }));
    displayedActors.forEach((actor) => items.push({ type: 'actor', actor, movieCount: actor.movieCount }));
    displayedIngredients.forEach((ingredient) => items.push({ type: 'ingredient', ingredient }));

    items.push({ type: 'view-all', total: totalResultsCount });

    return items;
  }, [
    shouldSearch,
    displayedMovies,
    displayedActors,
    displayedIngredients,
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
    } else if (item.type === 'ingredient') {
      setIsOpen(false);
      onNavigate(getFingerprintPath(item.ingredient.id));
    } else if (item.type === 'view-all') {
      setIsOpen(false);
      // App.tsx renders the full in-page search results when searchQuery is non-empty.
      window.requestAnimationFrame(() => {
        document.getElementById('search-results-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
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

  const renderMovieSection = (itemOffset: number) => displayedMovies.length > 0 ? (
    <div id="autocomplete-movies-section">
      <div className="px-3.5 pt-2 pb-1 text-[11px] font-sans-clean font-semibold uppercase tracking-wider text-[#736B63] bg-[#FAF7F2]/80 sticky top-0 z-10 border-b border-[#EFE8DD]">
        Movies
      </div>
      <div>
        {displayedMovies.map((movie, idx) => {
          const itemIndex = itemOffset + idx;
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
  ) : null;

  const renderActorSection = (itemOffset: number) => displayedActors.length > 0 ? (
    <div id="autocomplete-actors-section">
      <div className="px-3.5 pt-2 pb-1 text-[11px] font-sans-clean font-semibold uppercase tracking-wider text-[#736B63] bg-[#FAF7F2]/80 sticky top-0 z-10 border-b border-[#EFE8DD]">
        Actors
      </div>
      <div>
        {displayedActors.map((actor, idx) => {
          const itemIndex = itemOffset + idx;
          const isSelected = selectedIndex === itemIndex;
          const count = actor.movieCount;
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
                  {count} {count === 1 ? 'Christmas movie' : 'Christmas movies'}
                </div>
              </div>
            </a>
          );
        })}
      </div>
    </div>
  ) : null;

  const renderIngredientSection = (itemOffset: number) => displayedIngredients.length > 0 ? (
    <div id="autocomplete-ingredients-section">
      <div className="px-3.5 pt-2 pb-1 text-[11px] font-sans-clean font-semibold uppercase tracking-wider text-[#736B63] bg-[#FAF7F2]/80 border-b border-[#EFE8DD]">
        Christmas Ingredients
      </div>
      <div>
        {displayedIngredients.map((ingredient, idx) => {
          const itemIndex = itemOffset + idx;
          const isSelected = selectedIndex === itemIndex;
          const path = getFingerprintPath(ingredient.id);

          return (
            <a
              key={`ingredient-${ingredient.id}`}
              href={path}
              role="option"
              aria-selected={isSelected}
              id={`autocomplete-ingredient-${ingredient.id}`}
              onClick={(e) => {
                e.preventDefault();
                handleSelectItem({ type: 'ingredient', ingredient });
              }}
              onMouseEnter={() => setSelectedIndex(itemIndex)}
              className={`flex items-center gap-3 px-3.5 py-2 transition-colors cursor-pointer text-inherit no-underline ${
                isSelected ? 'bg-[#F2ECE3]' : 'hover:bg-[#F8F4EE]'
              }`}
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded bg-[#EAE2D7] border border-[#DDD3C6]">
                <FingerprintIcon />
              </div>
              <div className="min-w-0 flex-1">
                <div className="font-heading text-sm font-semibold text-[#1A3D2F] line-clamp-1 leading-snug">
                  {highlightMatch(ingredient.label, searchQuery)}
                </div>
                <div className="text-xs text-[#736B63] font-body mt-0.5">
                  {ingredient.category} · {ingredient.movieCount} {ingredient.movieCount === 1 ? 'Christmas movie' : 'Christmas movies'}
                </div>
              </div>
            </a>
          );
        })}
      </div>
    </div>
  ) : null;

  return (
    <div
      ref={containerRef}
      className={`relative mx-auto w-full max-w-md sm:transition-[max-width] sm:duration-200 sm:ease-out ${isExpanded ? 'sm:max-w-[800px]' : ''}`}
    >
      {/* Search Input Field */}
      <div className="relative flex items-center">
        <Search
          className="absolute left-3 w-4 h-4 text-[#6F675E] pointer-events-none"
          aria-hidden="true"
        />
        <input
          ref={inputRef}
          type="text"
          id="search-input"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          onFocus={() => {
            setIsFocused(true);
            if (searchQuery.trim().length >= 2) {
              setIsOpen(true);
            }
          }}
          onBlur={() => setIsFocused(false)}
          onKeyDown={handleKeyDown}
          placeholder="Search movies, people, or ingredients..."
          autoComplete="off"
          role="combobox"
          aria-expanded={isOpen}
          aria-autocomplete="list"
          aria-controls="search-autocomplete-listbox"
          className="w-full pl-9 pr-9 py-1.5 rounded bg-[#FFFDF9] border border-[#DCD3C7] text-[#23211E] placeholder-[#6F675E] text-sm focus:outline-none focus:ring-1 focus:ring-[#1A3D2F] focus:border-[#1A3D2F] shadow-2xs font-sans-clean transition-colors"
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
            className="absolute right-2.5 p-1 text-[#6F675E] hover:text-[#23211E] rounded transition-colors cursor-pointer"
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
          {isLoadingIndex ? (
            <div className="p-4 text-center text-xs sm:text-sm text-[#736B63] font-body">
              Searching&hellip;
            </div>
          ) : selectableItems.length === 0 ? (
            <div className="p-4 text-center text-xs sm:text-sm text-[#736B63] font-body">
              No movies, people, or Christmas Ingredients found matching &ldquo;{searchQuery}&rdquo;.
            </div>
          ) : (
            <div className="grid divide-y divide-[#EFE8DD] py-1 sm:grid-cols-[36fr_31fr_33fr] sm:divide-x sm:divide-y-0">
              {renderMovieSection(0)}
              {renderActorSection(displayedMovies.length)}
              {renderIngredientSection(displayedMovies.length + displayedActors.length)}

              {/* Keep the full search page one click away without expanding this compact list. */}
              {selectableItems.length > 0 && (
                <div className="p-1.5 bg-[#FAF7F2]/50 text-center sm:col-span-3">
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
                    <span>View all results for “{searchQuery}”</span>
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
