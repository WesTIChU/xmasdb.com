/**
 * XmasDB.com
 * Client Application Logic
 * 
 * - Reads `movies.json`, `cast.json`, and `upcoming.json`
 * - Dynamically derives years and builds filter buttons (ALL, newest first)
 * - Two-row navigation: full-width year filters on row 1, Per-Page & Sort controls on row 2
 * - Pagination on main movie grid (active when "ALL" years selected, default 24 per page)
 * - Popular Actors list and Search autocomplete using unified `showActor(personId)`
 * - Rich Active Actor Profile Banner with photo, name, dynamic age, and collection count
 * - Supports combined actor + year filtering, sorting, and pagination
 * - Synchronizes state to URL query parameters (?year=YYYY&actor=ID&page=N)
 * - Updates JSON LIST links dynamically (/movies.json vs /json/YYYY.json)
 */

import { calculateActorAge, getActorProfileImageUrl } from './actor-utils.js';
import { getActorUrl, getMovieUrl } from './movie-url.js';
import { getPublicMovies } from './public-movies.js';
import { CARD_GENERIC_POSTER, getPosterFallback } from './poster-utils.js';

document.addEventListener('DOMContentLoaded', () => {
  const moviesGrid = document.getElementById('movies-grid');
  const yearFiltersContainer = document.getElementById('year-filters');
  const sortSelect = document.getElementById('sort-select');
  const ratingFilterSelect = document.getElementById('rating-filter-select');
  const perPageSelect = document.getElementById('per-page-select');
  const paginationControls = document.getElementById('pagination-controls');

  // Popular Actors & Active Actor Profile Banner Elements
  const popularActorsSection = document.getElementById('popular-actors-section');
  const popularActorsList = document.getElementById('popular-actors-list');
  const activeActorBanner = document.getElementById('active-actor-banner');
  const activeActorAvatar = document.getElementById('active-actor-avatar');
  const activeActorText = document.getElementById('active-actor-text');
  const activeActorCountBadge = document.getElementById('active-actor-count-badge');
  const activeActorMeta = document.getElementById('active-actor-meta');
  const btnClearActor = document.getElementById('btn-clear-actor');

  // Upcoming Section Elements
  const upcomingSection = document.getElementById('upcoming-section');
  const upcomingGrid = document.getElementById('upcoming-grid');
  const upcomingToggleBtn = document.getElementById('upcoming-toggle-btn');
  const upcomingPanel = document.getElementById('upcoming-panel');
  const upcomingCountText = document.getElementById('upcoming-count-text');
  const upcomingToggleArrow = document.getElementById('upcoming-toggle-arrow');
  let isUpcomingPanelOpen = false;

  // Header & Footer Elements
  const headerMovieCount = document.getElementById('header-movie-count');
  const footerMovieCount = document.getElementById('footer-movie-count');
  const footerCopyrightYear = document.getElementById('footer-copyright-year');
  const footerJsonLink = document.getElementById('footer-json-link');
  const footerAllLink = document.getElementById('footer-all-link');

  let allMovies = [];
  let castData = null;
  let upcomingMovies = [];

  // State
  let currentYearFilter = 'ALL';
  let currentActorFilter = null;
  let currentSortOption = 'newest';
  let minimumRating = 0;
  let currentPerPage = localStorage.getItem('hallmarkMoviesPerPage') || '24';
  let currentPage = 1;
  let showAllActors = false;

  // Set copyright year automatically
  if (footerCopyrightYear) {
    footerCopyrightYear.textContent = new Date().getFullYear().toString();
  }

  // Initialize Per-Page dropdown
  if (perPageSelect) {
    if (['12', '24', '48', 'all'].includes(currentPerPage)) {
      perPageSelect.value = currentPerPage;
    } else {
      currentPerPage = '24';
      perPageSelect.value = '24';
    }

    perPageSelect.addEventListener('change', (e) => {
      currentPerPage = e.target.value;
      localStorage.setItem('hallmarkMoviesPerPage', currentPerPage);
      currentPage = 1;
      syncUrlParams();
      applyFiltersAndSort();
    });
  }

  // Initialize Sort dropdown
  if (sortSelect) {
    sortSelect.addEventListener('change', (e) => {
      currentSortOption = e.target.value;
      currentPage = 1;
      syncUrlParams();
      applyFiltersAndSort();
    });
  }

  if (ratingFilterSelect) {
    ratingFilterSelect.addEventListener('change', (e) => {
      minimumRating = Number(e.target.value) || 0;
      currentPage = 1;
      syncUrlParams();
      applyFiltersAndSort();
    });
  }

  // Clear actor button
  if (btnClearActor) {
    btnClearActor.addEventListener('click', () => {
      clearActorFilter(true);
    });
  }

  // Read URL query params on initial load
  const urlParams = new URLSearchParams(window.location.search);
  const initialYearParam = urlParams.get('year');
  const initialActorParam = urlParams.get('actor');
  const initialPageParam = parseInt(urlParams.get('page'), 10);
  if (!isNaN(initialPageParam) && initialPageParam > 0) {
    currentPage = initialPageParam;
  }

  // Footer "All Movies" link click
  if (footerAllLink) {
    footerAllLink.addEventListener('click', (e) => {
      e.preventDefault();
      clearActorFilter(false);
      setYearFilter('ALL', true);
      const target = document.getElementById('year-filters-nav') || document.getElementById('main-content');
      if (target) {
        target.scrollIntoView({ behavior: 'smooth' });
      }
    });
  }

  // Handle browser back/forward navigation
  window.addEventListener('popstate', () => {
    const params = new URLSearchParams(window.location.search);
    const yearParam = params.get('year') || 'ALL';
    const actorParam = params.get('actor') || null;
    const pageParam = parseInt(params.get('page'), 10);

    currentActorFilter = actorParam;
    currentPage = (!isNaN(pageParam) && pageParam > 0) ? pageParam : 1;

    setYearFilter(yearParam, false);
    updateActorBanner();
    renderPopularActors();
    applyFiltersAndSort();
  });

  // 1. Fetch upcoming movies
  fetch('upcoming.json')
    .then(res => res.ok ? res.json() : [])
    .then(data => {
      upcomingMovies = Array.isArray(data) ? data : [];
      renderUpcomingMovies();
      if (currentActorFilter) {
        updateActorBanner();
        applyFiltersAndSort();
      }
    })
    .catch(err => {
      console.warn('Could not load upcoming.json:', err);
      if (upcomingSection) upcomingSection.style.display = 'none';
    });

  // 2. Fetch cast data
  fetch('cast.json', { cache: 'no-store' })
    .then(res => res.ok ? res.json() : null)
    .then(data => {
      castData = data;
      renderPopularActors();
      if (currentActorFilter) {
        updateActorBanner();
        applyFiltersAndSort();
      }
    })
    .catch(err => {
      console.warn('Could not load cast.json:', err);
    });

  // 3. Fetch master movies.json
  fetch('movies.json', { cache: 'no-store' })
    .then((response) => {
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return response.json();
    })
    .then((movies) => {
      if (!Array.isArray(movies) || movies.length === 0) {
        moviesGrid.innerHTML = '<div class="loading-text">No movies found.</div>';
        if (headerMovieCount) headerMovieCount.textContent = '0 Hallmark Christmas movies ready and waiting.';
        if (footerMovieCount) footerMovieCount.textContent = '0 movies in the collection';
        return;
      }
      allMovies = movies;
      if (headerMovieCount) {
        headerMovieCount.textContent = `${allMovies.length} Hallmark Christmas movies ready and waiting.`;
      }
      if (footerMovieCount) {
        footerMovieCount.textContent = `${allMovies.length} movies in the collection`;
      }

      // Unique years sorted newest first
      const years = [...new Set(movies.map((m) => m.year).filter(Boolean))].sort((a, b) => b - a);
      buildYearFilters(years);

      if (initialActorParam) {
        currentActorFilter = initialActorParam;
      }

      if (initialYearParam && years.includes(parseInt(initialYearParam, 10))) {
        setYearFilter(initialYearParam, false);
      } else {
        setYearFilter('ALL', false);
      }

      updateActorBanner();
      renderPopularActors();
    })
    .catch((error) => {
      console.error('Error loading movies.json:', error);
      moviesGrid.innerHTML = `
        <div class="error-text">
          <p>Failed to load movies list.</p>
          <p style="font-size: 0.9rem; margin-top: 8px;">Ensure movies.json is accessible.</p>
        </div>
      `;
    });

  // =========================================================================
  // Year Filter Logic
  // =========================================================================
  function buildYearFilters(years) {
    if (!yearFiltersContainer) return;
    yearFiltersContainer.innerHTML = '';

    const allBtn = createFilterButton('ALL', 'ALL');
    yearFiltersContainer.appendChild(allBtn);

    years.forEach((year) => {
      const yearStr = year.toString();
      const btn = createFilterButton(yearStr, yearStr);
      yearFiltersContainer.appendChild(btn);
    });
  }

  function createFilterButton(label, value) {
    const btn = document.createElement('button');
    btn.className = 'btn-filter year-filter-button';
    btn.type = 'button';
    btn.id = `filter-year-${value.toLowerCase()}`;
    btn.textContent = label;
    btn.dataset.year = value;

    btn.addEventListener('click', () => {
      currentPage = 1; // Reset to page 1 on year change
      setYearFilter(value, true);
    });

    return btn;
  }

  function setYearFilter(yearValue, updateHistory = true) {
    currentYearFilter = yearValue;

    const filterButtons = yearFiltersContainer.querySelectorAll('.btn-filter');
    filterButtons.forEach((btn) => {
      if (btn.dataset.year === yearValue.toString()) {
        btn.classList.add('active');
        btn.setAttribute('aria-pressed', 'true');
      } else {
        btn.classList.remove('active');
        btn.setAttribute('aria-pressed', 'false');
      }
    });

    const targetJsonUrl = yearValue === 'ALL' ? 'movies.json' : `json/${yearValue}.json`;
    if (footerJsonLink) footerJsonLink.href = targetJsonUrl;

    if (updateHistory) {
      syncUrlParams();
    }

    applyFiltersAndSort();
  }

  // =========================================================================
  // Shared showActor(personId) Function
  // =========================================================================
  function showActor(personId, updateHistory = true) {
    if (!personId) {
      clearActorFilter(updateHistory);
      return;
    }

    let selectedId = Number(personId);
    let actorObj = null;

    if (!isNaN(selectedId) && castData && Array.isArray(castData.actors)) {
      actorObj = castData.actors.find(a => Number(a.id) === selectedId);
    }

    if (!actorObj && castData && Array.isArray(castData.actors)) {
      const norm = String(personId).toLowerCase().trim();
      actorObj = castData.actors.find(a => a.name && a.name.toLowerCase().trim() === norm);
      if (actorObj) {
        selectedId = Number(actorObj.id);
      }
    }

    currentActorFilter = actorObj ? actorObj.id : personId;
    currentPage = 1; // Reset to page 1

    if (updateHistory) {
      syncUrlParams();
    }

    updateActorBanner(actorObj);
    renderPopularActors();
    applyFiltersAndSort();

    // Scroll to active banner if not in view
    if (activeActorBanner && activeActorBanner.style.display !== 'none') {
      activeActorBanner.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }

  function clearActorFilter(updateHistory = true) {
    currentActorFilter = null;
    currentPage = 1;

    if (updateHistory) {
      syncUrlParams();
    }

    updateActorBanner(null);
    renderPopularActors();
    applyFiltersAndSort();
  }

  // =========================================================================
  // Active Actor Profile Banner with Dynamic Age
  // =========================================================================
  function updateActorBanner(actorObjParam) {
    if (!activeActorBanner) return;

    if (!currentActorFilter) {
      activeActorBanner.style.display = 'none';
      return;
    }

    let actorObj = actorObjParam;
    const selectedId = Number(currentActorFilter);

    if (!actorObj && castData && Array.isArray(castData.actors)) {
      if (!isNaN(selectedId)) {
        actorObj = castData.actors.find(a => Number(a.id) === selectedId);
      }
      if (!actorObj) {
        const norm = String(currentActorFilter).toLowerCase().trim();
        actorObj = castData.actors.find(a => a.name && a.name.toLowerCase().trim() === norm);
      }
    }

    const actorName = actorObj ? actorObj.name : String(currentActorFilter);
    const actorPhoto = actorObj ? actorObj.profile_path : null;

    if (activeActorAvatar) {
      const defaultAvatar = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="52" height="68" viewBox="0 0 52 68"><rect width="52" height="68" fill="%23cbd5e1"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" font-size="20">⭐</text></svg>';
      activeActorAvatar.src = getActorProfileImageUrl(actorPhoto);
      activeActorAvatar.alt = `${actorName} Profile`;
      activeActorAvatar.onerror = function() {
        this.onerror = null;
        this.src = defaultAvatar;
      };
    }

    if (activeActorText) {
      activeActorText.textContent = actorName;
    }

    const matchingMovies = getMoviesForActor(currentActorFilter);
    const count = matchingMovies.length;
    if (activeActorCountBadge) {
      activeActorCountBadge.textContent = `${count} public ${count === 1 ? 'movie' : 'movies'}`;
    }

    if (activeActorMeta) {
      activeActorMeta.innerHTML = '';
      if (actorObj && actorObj.birthday) {
        const ageInfo = calculateActorAge(actorObj.birthday, actorObj.deathday);
        if (ageInfo) {
          if (ageInfo.isDeceased) {
            activeActorMeta.innerHTML = `
              <span>Born: ${ageInfo.birthdayStr}</span>
              <span>&bull;</span>
              <span>Died: ${ageInfo.deathdayStr}</span>
              <span>&bull;</span>
              <strong>Aged: ${ageInfo.age}</strong>
            `;
          } else {
            activeActorMeta.innerHTML = `
              <span>Born: ${ageInfo.birthdayStr}</span>
              <span>&bull;</span>
              <strong>Age: ${ageInfo.age}</strong>
            `;
          }
        }
      }
    }

    const btnViewActorPage = document.getElementById('btn-view-actor-page');
    if (btnViewActorPage) {
      const actorParam = (actorObj && actorObj.id) ? actorObj.id : currentActorFilter;
      const actorForUrl = actorObj || { id: actorParam, name: actorName };
      btnViewActorPage.href = getActorUrl(actorForUrl);
    }

    activeActorBanner.style.display = 'flex';
  }

  // =========================================================================
  // Actor Movie Intersect Logic
  // Public movies matched by TMDB Person ID
  // =========================================================================
  function getMoviesForActor(personIdentifier) {
    const publicMovies = getPublicMovies(allMovies, upcomingMovies);
    if (!personIdentifier || publicMovies.length === 0) return [];
    const targetId = Number(personIdentifier);

    if (!isNaN(targetId) && targetId > 0) {
      return publicMovies.filter(movie => {
        const mId = String(movie.tmdbId || movie.tmdb_id);
        const cast = (castData && castData.castByMovieId && castData.castByMovieId[mId])
          || (castData && castData.movieCast && castData.movieCast[mId])
          || [];
        return cast.some(person => Number(person.id) === targetId);
      });
    }

    const normName = String(personIdentifier).toLowerCase().trim();
    return publicMovies.filter(movie => {
      const mId = String(movie.tmdbId || movie.tmdb_id);
      const cast = (castData && castData.castByMovieId && castData.castByMovieId[mId])
        || (castData && castData.movieCast && castData.movieCast[mId])
        || [];
      return cast.some(person => person.name && person.name.toLowerCase().trim() === normName);
    });
  }

  // =========================================================================
  // Popular Actors Row
  // =========================================================================
  function renderPopularActors() {
    if (!popularActorsList || !castData || !castData.actors) return;

    popularActorsList.innerHTML = '';
    // Only display genuine people with numeric TMDB person ID and non-empty name
    const actors = (castData.actors || []).filter(a => {
      return a && typeof a.id === 'number' && a.id > 0 && a.name && typeof a.name === 'string' && a.count > 0;
    });
    if (actors.length === 0) {
      if (popularActorsSection) popularActorsSection.style.display = 'none';
      return;
    }

    if (popularActorsSection) popularActorsSection.style.display = 'block';

     const defaultActorLimit = window.matchMedia('(max-width: 640px)').matches ? 8 : 12;
     const displayList = showAllActors ? actors : actors.slice(0, defaultActorLimit);

    displayList.forEach((actorObj, idx) => {
      if (idx > 0) {
        const sep = document.createElement('span');
        sep.className = 'actor-sep';
        sep.setAttribute('aria-hidden', 'true');
         sep.textContent = '✦';
        popularActorsList.appendChild(sep);
      }

      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'actor-chip actor-link';
      
      const isSelected = currentActorFilter && (
        Number(currentActorFilter) === Number(actorObj.id) ||
        String(currentActorFilter).toLowerCase() === actorObj.name.toLowerCase()
      );

      if (isSelected) {
        btn.classList.add('active');
        btn.setAttribute('aria-pressed', 'true');
      } else {
        btn.setAttribute('aria-pressed', 'false');
      }

      btn.textContent = actorObj.name;
      const publicActorMovieCount = getMoviesForActor(actorObj.id).length;
      btn.title = `Show movies starring ${actorObj.name} (${publicActorMovieCount} public ${publicActorMovieCount === 1 ? 'movie' : 'movies'})`;

      btn.addEventListener('click', () => {
        if (isSelected) {
          clearActorFilter(true);
        } else {
          showActor(actorObj.id || actorObj.name, true);
        }
      });

      popularActorsList.appendChild(btn);
    });

    if (actors.length > 8) {
      const sep = document.createElement('span');
      sep.className = 'actor-sep';
      sep.setAttribute('aria-hidden', 'true');
       sep.textContent = '✦';
      popularActorsList.appendChild(sep);

      const moreBtn = document.createElement('button');
      moreBtn.type = 'button';
      moreBtn.className = 'actor-chip btn-more-actors';
      moreBtn.textContent = showAllActors ? 'LESS...' : 'MORE...';
      moreBtn.setAttribute('aria-label', showAllActors ? 'Show fewer popular actors' : 'Show all collection actors');
      moreBtn.addEventListener('click', () => {
        showAllActors = !showAllActors;
        renderPopularActors();
      });
      popularActorsList.appendChild(moreBtn);
    }
  }

  // =========================================================================
  // Filtering, Sorting, & Pagination Execution
  // =========================================================================
  function applyFiltersAndSort() {
    let filteredMovies = allMovies;

    // 1. Filter by Year
    if (currentYearFilter !== 'ALL') {
      const yearNum = parseInt(currentYearFilter, 10);
      filteredMovies = filteredMovies.filter((m) => m.year === yearNum);
    }

    // 2. Filter by Actor
    if (currentActorFilter) {
      const actorMovies = getMoviesForActor(currentActorFilter);
      const actorMovieIds = new Set(actorMovies.map(m => Number(m.tmdbId || m.tmdb_id)));
      filteredMovies = filteredMovies.filter(m => actorMovieIds.has(Number(m.tmdbId || m.tmdb_id)));
    }

    // 3. Filter by minimum TMDB rating. Unrated movies do not pass a score filter.
    if (minimumRating > 0) {
      filteredMovies = filteredMovies.filter((m) => Number(m.vote_average) >= minimumRating);
    }

    // 4. Sort Movies
    const sortedMovies = sortMoviesList(filteredMovies, currentSortOption);

    // 4. Pagination (Applies strictly when currentYearFilter === 'ALL' and perPage !== 'all')
    if (currentYearFilter === 'ALL' && currentPerPage !== 'all') {
      const pageSize = parseInt(currentPerPage, 10) || 24;
      const totalPages = Math.max(1, Math.ceil(sortedMovies.length / pageSize));

      if (currentPage > totalPages) {
        currentPage = 1;
      }

      const startIndex = (currentPage - 1) * pageSize;
      const pageMovies = sortedMovies.slice(startIndex, startIndex + pageSize);

      renderMovies(pageMovies);
      renderPaginationControls(totalPages, currentPage);
    } else {
      if (paginationControls) {
        paginationControls.style.display = 'none';
        paginationControls.innerHTML = '';
      }
      renderMovies(sortedMovies);
    }
  }

  function sortMoviesList(movies, sortMode) {
    return [...movies].sort((a, b) => {
      const titleA = (a.title || '').trim();
      const titleB = (b.title || '').trim();
      const yearA = a.year || 0;
      const yearB = b.year || 0;

      switch (sortMode) {
        case 'oldest':
          if (yearA !== yearB) return yearA - yearB;
          return titleA.localeCompare(titleB, undefined, { sensitivity: 'base' });

        case 'title-asc':
          return titleA.localeCompare(titleB, undefined, { sensitivity: 'base' });

        case 'title-desc':
          return titleB.localeCompare(titleA, undefined, { sensitivity: 'base' });

        case 'rating-desc': {
          const ratingA = Number(a.vote_average) || 0;
          const ratingB = Number(b.vote_average) || 0;
          if (ratingA !== ratingB) return ratingB - ratingA;
          return titleA.localeCompare(titleB, undefined, { sensitivity: 'base' });
        }

        case 'rating-asc': {
          const ratingA = Number(a.vote_average) || 0;
          const ratingB = Number(b.vote_average) || 0;
          if (ratingA !== ratingB) return ratingA - ratingB;
          return titleA.localeCompare(titleB, undefined, { sensitivity: 'base' });
        }

        case 'newest':
        default:
          if (yearA !== yearB) return yearB - yearA;
          return titleA.localeCompare(titleB, undefined, { sensitivity: 'base' });
      }
    });
  }

  // =========================================================================
  // Pagination UI Generator
  // =========================================================================
  function renderPaginationControls(totalPages, activePage) {
    if (!paginationControls) return;

    if (totalPages <= 1) {
      paginationControls.style.display = 'none';
      paginationControls.innerHTML = '';
      return;
    }

    paginationControls.innerHTML = '';
    paginationControls.style.display = 'flex';

    // Previous Button
    const prevBtn = document.createElement('button');
    prevBtn.type = 'button';
    prevBtn.className = 'pagination-btn btn-prev';
    prevBtn.innerHTML = '&larr; Previous';
    prevBtn.disabled = activePage <= 1;
    prevBtn.setAttribute('aria-label', 'Previous page');
    prevBtn.addEventListener('click', () => {
      if (currentPage > 1) {
        goToPage(currentPage - 1);
      }
    });
    paginationControls.appendChild(prevBtn);

    // Number Buttons & Ellipses
    const pageNumbers = getPaginationRange(totalPages, activePage);
    pageNumbers.forEach(p => {
      if (p === '...') {
        const ellipsis = document.createElement('span');
        ellipsis.className = 'pagination-ellipsis';
        ellipsis.textContent = '…';
        ellipsis.setAttribute('aria-hidden', 'true');
        paginationControls.appendChild(ellipsis);
      } else {
        const pNum = Number(p);
        const pBtn = document.createElement('button');
        pBtn.type = 'button';
        pBtn.className = `pagination-btn btn-page ${pNum === activePage ? 'active' : ''}`;
        pBtn.textContent = pNum;
        pBtn.setAttribute('aria-label', `Page ${pNum}`);
        if (pNum === activePage) {
          pBtn.setAttribute('aria-current', 'page');
        }
        pBtn.addEventListener('click', () => {
          if (pNum !== currentPage) {
            goToPage(pNum);
          }
        });
        paginationControls.appendChild(pBtn);
      }
    });

    // Next Button
    const nextBtn = document.createElement('button');
    nextBtn.type = 'button';
    nextBtn.className = 'pagination-btn btn-next';
    nextBtn.innerHTML = 'Next &rarr;';
    nextBtn.disabled = activePage >= totalPages;
    nextBtn.setAttribute('aria-label', 'Next page');
    nextBtn.addEventListener('click', () => {
      if (currentPage < totalPages) {
        goToPage(currentPage + 1);
      }
    });
    paginationControls.appendChild(nextBtn);
  }

  function getPaginationRange(totalPages, current) {
    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }
    if (current <= 4) {
      return [1, 2, 3, 4, 5, '...', totalPages];
    }
    if (current >= totalPages - 3) {
      return [1, '...', totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
    }
    return [1, '...', current - 1, current, current + 1, '...', totalPages];
  }

  function goToPage(targetPage) {
    currentPage = targetPage;
    syncUrlParams();
    applyFiltersAndSort();

    const target = document.getElementById('year-filters-nav') || document.getElementById('main-content');
    if (target) {
      target.scrollIntoView({ behavior: 'smooth' });
    }
  }

  function syncUrlParams() {
    const newUrl = new URL(window.location.href);

    if (currentYearFilter === 'ALL') {
      newUrl.searchParams.delete('year');
    } else {
      newUrl.searchParams.set('year', currentYearFilter);
    }

    if (!currentActorFilter) {
      newUrl.searchParams.delete('actor');
    } else {
      newUrl.searchParams.set('actor', currentActorFilter);
    }

    if (currentYearFilter === 'ALL' && currentPage > 1) {
      newUrl.searchParams.set('page', currentPage);
    } else {
      newUrl.searchParams.delete('page');
    }

    window.history.pushState(
      { year: currentYearFilter, actor: currentActorFilter, page: currentPage },
      '',
      newUrl.toString()
    );
  }

  // =========================================================================
  // Movie Grid Rendering
  // =========================================================================
  function renderMovieCard(movie, isUpcoming = false) {
    const card = document.createElement('article');
    card.className = 'movie-card';
    card.id = `movie-${movie.tmdbId || movie.tmdb_id || movie.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;

    const movieUrl = getMovieUrl(movie);
    const posterLink = document.createElement('a');
    posterLink.className = 'poster-wrap';
    posterLink.href = movieUrl;
    posterLink.setAttribute('aria-label', `View details for ${movie.title} (${movie.year || ''})`);

    const img = document.createElement('img');
    img.className = 'movie-poster';
    img.alt = `${movie.title} Poster`;
    img.loading = 'lazy';
    img.referrerPolicy = 'no-referrer';
    const fallbackPoster = getPosterFallback(movie, isUpcoming, CARD_GENERIC_POSTER);
    img.src = movie.poster || fallbackPoster;
    img.onerror = () => {
      img.onerror = null;
      img.src = fallbackPoster;
    };
    posterLink.appendChild(img);
    card.appendChild(posterLink);

    const info = document.createElement('div');
    info.className = 'movie-info';
    if (isUpcoming) {
      const badge = document.createElement('span');
      badge.className = 'upcoming-badge';
      badge.textContent = 'UPCOMING';
      info.appendChild(badge);
    }

    const titleEl = document.createElement('h2');
    titleEl.className = 'movie-title';
    const titleLink = document.createElement('a');
    titleLink.href = movieUrl;
    titleLink.textContent = movie.title;
    titleLink.className = 'movie-title-link';
    titleEl.appendChild(titleLink);
    info.appendChild(titleEl);

    const yearEl = document.createElement('div');
    yearEl.className = 'movie-year';
    yearEl.textContent = isUpcoming ? (movie.premiereDate || movie.release_date || movie.year || '') : (movie.year || '');
    info.appendChild(yearEl);

    if (Number(movie.vote_average) > 0) {
      const ratingEl = document.createElement('div');
      ratingEl.className = 'movie-rating';
      ratingEl.textContent = `★ ${Number(movie.vote_average).toFixed(1)} / 10`;
      info.appendChild(ratingEl);
    }

    card.appendChild(info);
    if (isUpcoming) {
      card.tabIndex = 0;
      card.addEventListener('click', event => {
        if (!event.target.closest('a')) window.location.href = movieUrl;
      });
      card.addEventListener('keydown', event => {
        if ((event.key === 'Enter' || event.key === ' ') && !event.target.closest('a')) {
          event.preventDefault();
          window.location.href = movieUrl;
        }
      });
    }
    return card;
  }

  function renderMovies(movies) {
    if (!moviesGrid) return;
    moviesGrid.innerHTML = '';

    if (movies.length === 0) {
      moviesGrid.innerHTML = `
        <div class="empty-state">
          <p>No movies found matching the selected filters.</p>
        </div>
      `;
      return;
    }

    const fragment = document.createDocumentFragment();

    movies.forEach(movie => fragment.appendChild(renderMovieCard(movie)));

    moviesGrid.appendChild(fragment);
  }

  // =========================================================================
  // Upcoming Movies Section
  // =========================================================================
  function renderUpcomingMovies() {
    if (!upcomingSection || !upcomingGrid) return;

    if (!upcomingMovies || upcomingMovies.length === 0) {
      upcomingSection.style.display = 'none';
      return;
    }

    upcomingSection.style.display = 'block';
    const count = upcomingMovies.length;
    if (upcomingCountText) {
      upcomingCountText.textContent = `${count} upcoming ${count === 1 ? 'movie' : 'movies'}`;
    }

    upcomingGrid.className = 'movies-grid';
    upcomingGrid.innerHTML = '';
    upcomingMovies.forEach(movie => upcomingGrid.appendChild(renderMovieCard(movie, true)));

    if (upcomingToggleBtn) {
      upcomingToggleBtn.addEventListener('click', () => {
        isUpcomingPanelOpen = !isUpcomingPanelOpen;
        upcomingToggleBtn.setAttribute('aria-expanded', isUpcomingPanelOpen ? 'true' : 'false');
        upcomingPanel.setAttribute('aria-hidden', isUpcomingPanelOpen ? 'false' : 'true');
        upcomingPanel.style.display = isUpcomingPanelOpen ? 'block' : 'none';
        upcomingToggleArrow.textContent = isUpcomingPanelOpen ? '▲' : '▼';
        upcomingToggleBtn.classList.toggle('is-active', isUpcomingPanelOpen);
      });
    }
  }

});
