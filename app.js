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

import { calculateActorAge, normalizeSearchText, getActorProfileImageUrl, PLACEHOLDER_ACTOR_PHOTO } from './actor-utils.js';
import { getActorUrl, getMovieUrl } from './movie-url.js';
import { getPublicMovies } from './public-movies.js';

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

  // Birthdays Today Elements
  const birthdaysTodaySection = document.getElementById('birthdays-today-section');
  const birthdaysTodayList = document.getElementById('birthdays-today-list');

  // Upcoming Section Elements
  const upcomingSection = document.getElementById('upcoming-section');
  const upcomingGrid = document.getElementById('upcoming-grid');
  const upcomingToggleBtn = document.getElementById('upcoming-toggle-btn');
  const upcomingPanel = document.getElementById('upcoming-panel');
  const upcomingCountText = document.getElementById('upcoming-count-text');
  const upcomingToggleArrow = document.getElementById('upcoming-toggle-arrow');
  let isUpcomingPanelOpen = false;

  // Search Elements
  const globalSearchContainer = document.getElementById('global-search-container');
  const globalSearchInput = document.getElementById('global-search-input');
  const searchClearBtn = document.getElementById('search-clear-btn');
  const autocompleteDropdown = document.getElementById('search-autocomplete-dropdown');
  const autocompleteList = document.getElementById('search-autocomplete-list');

  // Header & Footer Elements
  const headerMovieCount = document.getElementById('header-movie-count');
  const headerFestiveMessage = document.getElementById('header-festive-message');
  const headerFestiveText = headerFestiveMessage?.querySelector('.festive-main-message');
  const footerMovieCount = document.getElementById('footer-movie-count');
  const footerCopyrightYear = document.getElementById('footer-copyright-year');
  const footerJsonLink = document.getElementById('footer-json-link');
  const footerAllLink = document.getElementById('footer-all-link');

  let allMovies = [];
  let castData = null;
  let searchIndex = [];
  let currentAutocompleteResults = [];
  let selectedAutocompleteIndex = -1;
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

  // =========================================================================
  // Dynamic Festive Christmas Header Message
  // =========================================================================
  function getChristmasMessage(now = new Date()) {
    const localYear = now.getFullYear();
    const month = now.getMonth(); // 0 = Jan, 11 = Dec
    const day = now.getDate();

    if (month === 11) {
      if (day === 24) return "✨ It's Christmas Eve - one more movie?";
      if (day === 25) return '🎄 Merry Christmas!';
      if (day === 26) return "🎁 Christmas isn't over yet…";
      if (day >= 27 && day <= 30) return '✨ Keep the festive feeling going.';
      if (day === 31) return "🥂 Happy New Year's Eve!";
    } else if (month === 0) {
      if (day === 1) return '🎆 Happy New Year!';
    }

    let targetYear = localYear;
    if (month === 11 && day > 25) {
      targetYear = localYear + 1;
    }

    const utcToday = Date.UTC(localYear, month, day);
    const utcTarget = Date.UTC(targetYear, 11, 25);
    const diffDays = Math.round((utcTarget - utcToday) / 86400000);

    if (diffDays <= 7) {
      const sleepWord = diffDays === 1 ? 'sleep' : 'sleeps';
      return `🎄 Only ${diffDays} ${sleepWord} until Christmas!`;
    }
    if (diffDays <= 24) return `${diffDays} days until Christmas - Christmas movie season is in full swing. 🎬`;
    if (diffDays <= 49) return `${diffDays} days until Christmas - Hallmark season is officially underway. 🎄`;
    if (diffDays <= 99) return `${diffDays} days until Christmas — time for a little festive magic. ✨`;
    return "Too early for Christmas movies? We don't think so. 🎄";
  }

  function updateFestiveMessage() {
    if (headerFestiveText) {
      headerFestiveText.textContent = getChristmasMessage();
    } else if (headerFestiveMessage) {
      headerFestiveMessage.textContent = getChristmasMessage();
    }
  }

  updateFestiveMessage();
  setInterval(updateFestiveMessage, 60000);

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
      buildSearchIndex();
      renderPopularActors();
      renderBirthdaysToday();
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
      buildSearchIndex();

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
      renderBirthdaysToday();
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
  // Birthdays Today Section
  // =========================================================================
  function renderBirthdaysToday() {
    if (!birthdaysTodaySection || !birthdaysTodayList || !castData || !castData.actors) return;

    birthdaysTodayList.innerHTML = '';

    const now = new Date();
    const currentMonth = String(now.getMonth() + 1).padStart(2, '0');
    const currentDay = String(now.getDate()).padStart(2, '0');

    // Build a Set of TMDB movie IDs currently present in movies.json
    const validMovieTmdbIds = new Set(allMovies.map(m => Number(m.tmdbId || m.tmdb_id)).filter(Boolean));

    // Only consider genuine actors referenced by movies currently in movies.json
    const collectionActors = (castData.actors || []).filter(actor => {
      if (!actor || !actor.id || !actor.name) return false;
      const inCollection = actor.count > 0 && Array.isArray(actor.movieTmdbIds) &&
        actor.movieTmdbIds.some(id => validMovieTmdbIds.has(Number(id)));
      return inCollection;
    });

    // Actors with birthday data
    const actorsWithBirthday = collectionActors.filter(actor => Boolean(actor.birthday));

    // Find actors in collection with birthday today (local month + day)
    const birthdayActors = actorsWithBirthday.filter(actor => {
      const parts = String(actor.birthday).split('-');
      if (parts.length < 3) return false;
      const bMonth = parts[1];
      const bDay = parts[2];
      return bMonth === currentMonth && bDay === currentDay;
    });

    if (birthdayActors.length === 0) {
      birthdaysTodaySection.style.display = 'none';
      return;
    }

    birthdaysTodaySection.style.display = 'block';

    if (birthdayActors.length === 0) {
      const emptyNotice = document.createElement('div');
      emptyNotice.className = 'birthday-today-empty';
      emptyNotice.textContent = 'No collection birthdays today.';
      birthdaysTodayList.appendChild(emptyNotice);
      return;
    }

    birthdayActors.forEach(actor => {
      const card = document.createElement('div');
      card.className = 'birthday-actor-card';
      card.setAttribute('role', 'button');
      card.setAttribute('tabindex', '0');
      card.setAttribute('aria-label', `View Hallmark movies starring ${actor.name}`);
      card.title = `Click to filter movies starring ${actor.name}`;

      const photo = document.createElement('img');
      photo.className = 'birthday-actor-photo';
      photo.alt = actor.name;
      photo.loading = 'lazy';
      photo.src = getActorProfileImageUrl(actor.profile_path);
      photo.onerror = function() {
        this.onerror = null;
        this.src = PLACEHOLDER_ACTOR_PHOTO;
      };

      const info = document.createElement('div');
      info.className = 'birthday-actor-info';

      const nameRow = document.createElement('div');
      nameRow.className = 'birthday-actor-name-row';

      const nameEl = document.createElement('strong');
      nameEl.className = 'birthday-actor-name';
      nameEl.textContent = actor.name;

      const badge = document.createElement('span');
      badge.className = 'birthday-actor-badge';

      const birthYear = parseInt(actor.birthday.split('-')[0], 10);
      const isDeceased = Boolean(actor.deathday);

      if (isDeceased) {
        badge.textContent = 'Born on this day';
      } else {
        const age = now.getFullYear() - birthYear;
        badge.textContent = `Turns ${age} today`;
      }

      nameRow.appendChild(nameEl);
      nameRow.appendChild(badge);

      const countEl = document.createElement('span');
      countEl.className = 'birthday-actor-count';
      countEl.textContent = ` · ${actor.count} ${actor.count === 1 ? 'movie' : 'movies'} in this collection`;

      info.appendChild(nameRow);
      info.appendChild(countEl);

      card.appendChild(photo);
      card.appendChild(info);

      const triggerFilter = () => {
        showActor(actor.id, true);
      };

      card.addEventListener('click', triggerFilter);
      card.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          triggerFilter();
        }
      });

      birthdaysTodayList.appendChild(card);
    });
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
    img.src = movie.poster || 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="300" height="450" viewBox="0 0 300 450"><rect width="300" height="450" fill="%23e5e5e5"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" font-family="sans-serif" font-size="16" fill="%23888888">No Poster</text></svg>';
    img.onerror = () => {
      img.onerror = null;
      img.src = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="300" height="450" viewBox="0 0 300 450"><rect width="300" height="450" fill="%23e5e5e5"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" font-family="sans-serif" font-size="16" fill="%23888888">No Poster</text></svg>';
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

  // =========================================================================
  // Live Local Autocomplete Search (Movies & Actors)
  // =========================================================================
  function buildSearchIndex() {
    const items = [];

    if (Array.isArray(allMovies)) {
      allMovies.forEach((m) => {
        if (m && m.title) {
          const orig = m.originalTitle || m.original_title || '';
          items.push({
            type: 'movie',
            title: m.title,
            originalTitle: orig,
            year: m.year,
            poster: m.poster,
            tmdbId: m.tmdbId || m.tmdb_id,
            normTitle: normalizeSearchText(m.title),
            normOriginalTitle: orig ? normalizeSearchText(orig) : ''
          });
        }
      });
    }

    if (castData && Array.isArray(castData.actors)) {
      castData.actors.forEach((a) => {
        if (a && a.name) {
          const count = typeof a.count === 'number'
            ? a.count
            : (Array.isArray(a.movieTmdbIds) ? a.movieTmdbIds.length : 0);
          items.push({
            type: 'actor',
            id: a.id,
            name: a.name,
            profile: a.profile || a.profile_path,
            profile_path: a.profile_path,
            birthday: a.birthday,
            deathday: a.deathday,
            count: count,
            movieTmdbIds: a.movieTmdbIds || [],
            normName: normalizeSearchText(a.name)
          });
        }
      });
    }

    searchIndex = items;
  }

  function rankItem(normQuery, item) {
    if (item.type === 'movie') {
      const t = item.normTitle;
      if (t.startsWith(normQuery)) return 1;
      const words = t.split(' ');
      if (words.some(w => w.startsWith(normQuery))) return 2;
      if (t.includes(normQuery)) return 3;

      if (item.normOriginalTitle) {
        const ot = item.normOriginalTitle;
        if (ot.startsWith(normQuery)) return 2;
        const otWords = ot.split(' ');
        if (otWords.some(w => w.startsWith(normQuery))) return 3;
        if (ot.includes(normQuery)) return 4;
      }
    } else if (item.type === 'actor') {
      const a = item.normName;
      if (a.startsWith(normQuery)) return 1;
      const aWords = a.split(' ');
      if (aWords.some(w => w.startsWith(normQuery))) return 2;
      if (a.includes(normQuery)) return 3;
    }
    return null;
  }

  function handleAutocompleteSearch(query) {
    const norm = normalizeSearchText(query);
    if (!norm) {
      closeAutocomplete();
      return;
    }

    if (searchIndex.length === 0) {
      buildSearchIndex();
    }

    const matches = [];
    for (const item of searchIndex) {
      const rank = rankItem(norm, item);
      if (rank !== null) {
        matches.push({ item, rank });
      }
    }

    matches.sort((a, b) => {
      if (a.rank !== b.rank) return a.rank - b.rank;
      if (a.item.type === 'actor' && b.item.type === 'actor') {
        return (b.item.count || 0) - (a.item.count || 0);
      }
      if (a.item.type === 'movie' && b.item.type === 'movie') {
        if (a.item.year !== b.item.year) return (b.item.year || 0) - (a.item.year || 0);
        return a.item.title.localeCompare(b.item.title);
      }
      return 0;
    });

    currentAutocompleteResults = matches.slice(0, 10);
    selectedAutocompleteIndex = -1;
    renderAutocompleteDropdown(query.trim(), currentAutocompleteResults);
  }

  function renderAutocompleteDropdown(query, results) {
    if (!autocompleteDropdown || !autocompleteList) return;
    autocompleteList.innerHTML = '';

    if (results.length === 0) {
      const li = document.createElement('li');
      li.className = 'autocomplete-no-results';
      li.textContent = `No movies or actors found matching "${query}".`;
      autocompleteList.appendChild(li);
    } else {
      results.forEach(({ item }, idx) => {
        const li = document.createElement('li');
        li.className = 'autocomplete-item';
        li.id = `autocomplete-item-${idx}`;
        li.setAttribute('role', 'option');
        li.setAttribute('aria-selected', 'false');

        const mainWrap = document.createElement('div');
        mainWrap.className = 'autocomplete-item-main';

        if (item.type === 'movie') {
          const img = document.createElement('img');
          img.className = 'autocomplete-poster-thumb';
          img.alt = item.title;
          img.referrerPolicy = 'no-referrer';
          img.src = item.poster || 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="26" height="39" viewBox="0 0 26 39"><rect width="26" height="39" fill="%23e2e8f0"/></svg>';
          img.onerror = () => {
            img.onerror = null;
            img.src = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="26" height="39" viewBox="0 0 26 39"><rect width="26" height="39" fill="%23e2e8f0"/></svg>';
          };
          mainWrap.appendChild(img);

          const textWrap = document.createElement('div');
          textWrap.className = 'autocomplete-text-wrap';

          const titleSpan = document.createElement('span');
          titleSpan.className = 'autocomplete-title';
          titleSpan.textContent = item.title;
          textWrap.appendChild(titleSpan);

          const subSpan = document.createElement('span');
          subSpan.className = 'autocomplete-sub';
          if (item.originalTitle && item.originalTitle.toLowerCase() !== item.title.toLowerCase()) {
            subSpan.textContent = `${item.year || ''} · Orig: "${item.originalTitle}"`;
          } else {
            subSpan.textContent = item.year ? `${item.year} Release` : 'Movie';
          }
          textWrap.appendChild(subSpan);

          mainWrap.appendChild(textWrap);

          const badge = document.createElement('span');
          badge.className = 'autocomplete-badge badge-type-movie';
          badge.textContent = 'Movie';

          li.appendChild(mainWrap);
          li.appendChild(badge);
        } else if (item.type === 'actor') {
          const photo = document.createElement('img');
          photo.className = 'autocomplete-poster-thumb';
          photo.alt = item.name;
          photo.src = getActorProfileImageUrl(item.profile || item.profile_path);
          photo.onerror = () => {
            photo.onerror = null;
            photo.src = PLACEHOLDER_ACTOR_PHOTO;
          };
          mainWrap.appendChild(photo);

          const textWrap = document.createElement('div');
          textWrap.className = 'autocomplete-text-wrap';

          const nameSpan = document.createElement('span');
          nameSpan.className = 'autocomplete-title';
          nameSpan.textContent = item.name;
          textWrap.appendChild(nameSpan);

          const subSpan = document.createElement('span');
          subSpan.className = 'autocomplete-sub';
          const count = item.count || 0;
          subSpan.textContent = `${count} ${count === 1 ? 'movie' : 'movies'} in collection`;
          textWrap.appendChild(subSpan);

          mainWrap.appendChild(textWrap);

          const badge = document.createElement('span');
          badge.className = 'autocomplete-badge badge-type-actor';
          badge.textContent = 'Actor';

          li.appendChild(mainWrap);
          li.appendChild(badge);
        }

        li.addEventListener('mouseenter', () => {
          setSelectedAutocompleteIndex(idx);
        });

        li.addEventListener('click', () => {
          executeAutocompleteItem(item);
        });

        autocompleteList.appendChild(li);
      });
    }

    autocompleteDropdown.style.display = 'block';
    if (globalSearchInput) {
      globalSearchInput.setAttribute('aria-expanded', 'true');
    }
  }

  function setSelectedAutocompleteIndex(idx) {
    selectedAutocompleteIndex = idx;
    const items = autocompleteList.querySelectorAll('.autocomplete-item');
    items.forEach((el, i) => {
      if (i === idx) {
        el.classList.add('is-selected');
        el.setAttribute('aria-selected', 'true');
        el.scrollIntoView({ block: 'nearest' });
      } else {
        el.classList.remove('is-selected');
        el.setAttribute('aria-selected', 'false');
      }
    });
  }

  function executeAutocompleteItem(item) {
    closeAutocomplete();
    if (globalSearchInput) globalSearchInput.value = '';
    if (searchClearBtn) searchClearBtn.style.display = 'none';

    if (item.type === 'movie') {
      window.location.href = getMovieUrl(item);
    } else if (item.type === 'actor') {
      window.location.href = getActorUrl({ id: item.id, name: item.name });
    }
  }

  function closeAutocomplete() {
    if (autocompleteDropdown) autocompleteDropdown.style.display = 'none';
    if (globalSearchInput) {
      globalSearchInput.setAttribute('aria-expanded', 'false');
      globalSearchInput.removeAttribute('aria-activedescendant');
    }
    selectedAutocompleteIndex = -1;
  }

  if (globalSearchInput) {
    globalSearchInput.addEventListener('input', (e) => {
      const val = e.target.value;
      if (searchClearBtn) {
        searchClearBtn.style.display = val.length > 0 ? 'flex' : 'none';
      }
      handleAutocompleteSearch(val);
    });

    globalSearchInput.addEventListener('keydown', (e) => {
      if (!autocompleteDropdown || autocompleteDropdown.style.display === 'none') {
        if (e.key === 'Enter') {
          e.preventDefault();
          handleAutocompleteSearch(globalSearchInput.value);
        }
        return;
      }

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        const next = selectedAutocompleteIndex + 1;
        if (next < currentAutocompleteResults.length) {
          setSelectedAutocompleteIndex(next);
        }
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        const prev = selectedAutocompleteIndex - 1;
        if (prev >= 0) {
          setSelectedAutocompleteIndex(prev);
        }
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (selectedAutocompleteIndex >= 0 && selectedAutocompleteIndex < currentAutocompleteResults.length) {
          executeAutocompleteItem(currentAutocompleteResults[selectedAutocompleteIndex].item);
        } else if (currentAutocompleteResults.length > 0) {
          executeAutocompleteItem(currentAutocompleteResults[0].item);
        }
      } else if (e.key === 'Escape') {
        closeAutocomplete();
      }
    });
  }

  if (searchClearBtn) {
    searchClearBtn.addEventListener('click', () => {
      if (globalSearchInput) {
        globalSearchInput.value = '';
        globalSearchInput.focus();
      }
      searchClearBtn.style.display = 'none';
      closeAutocomplete();
    });
  }

  document.addEventListener('click', (e) => {
    if (globalSearchContainer && !globalSearchContainer.contains(e.target)) {
      closeAutocomplete();
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeAutocomplete();
    }
  });

});
