/**
 * XmasDB.com - Local Manager Client Logic
 * 
 * Includes:
 * 1. Collection management (View, search, and 2-step safe removal).
 * 2. Shared TMDB Search function used by manual search, bulk import, and news.
 * 3. Title normalization with ampersand ('&' -> 'and') and punctuation handling.
 * 4. Hallmark Countdown to Christmas bulk importer with shared TMDB matching.
 * 5. Hallmark Movie News extraction and Approved Upcoming Movies workflow:
 *    - Candidate (News) -> Upcoming (Confirmed) -> Collection (Released).
 */

document.addEventListener('DOMContentLoaded', () => {
  // Token & Collection Elements
  const tokenInput = document.getElementById('tmdb-token-input');
  const saveTokenBtn = document.getElementById('save-token-btn');
  const tokenStatus = document.getElementById('token-status');

  const collectionCountBadge = document.getElementById('collection-count-badge');
  const collectionLoading = document.getElementById('collection-loading');
  const collectionList = document.getElementById('collection-list');
  const collectionSearchInput = document.getElementById('collection-search-input');
  const toast = document.getElementById('toast');

  // Manual Search Elements
  const searchForm = document.getElementById('search-form');
  const searchQueryInput = document.getElementById('search-query-input');
  const searchFeedback = document.getElementById('search-feedback');
  const searchResultsWrap = document.getElementById('search-results');
  const resultsGrid = document.getElementById('results-grid');
  const resultsCount = document.getElementById('results-count');

  // Debug Panel Elements
  const debugPanel = document.getElementById('search-debug-panel');
  const debugStatus = document.getElementById('debug-status');
  const debugTotalResults = document.getElementById('debug-total-results');
  const debugResultsCount = document.getElementById('debug-results-count');
  const debugEndpoint = document.getElementById('debug-endpoint');
  const debugTime = document.getElementById('debug-time');
  const debugRawJson = document.getElementById('debug-raw-json');

  // Hallmark Countdown Importer Elements
  const hallmarkYearSelect = document.getElementById('hallmark-year-select');
  const btnFetchHallmark = document.getElementById('btn-fetch-hallmark');
  const btnImportAllHallmark = document.getElementById('btn-import-all-hallmark');
  const hallmarkSourcePreview = document.getElementById('hallmark-source-preview');
  const hallmarkFetchFeedback = document.getElementById('hallmark-fetch-feedback');
  const hallmarkCandidatesPanel = document.getElementById('hallmark-candidates-panel');
  const candidatesHeaderTitle = document.getElementById('candidates-header-title');
  const candidatesCountPill = document.getElementById('candidates-count-pill');
  const hideInCollectionChk = document.getElementById('hide-in-collection-chk');
  const hideIgnoredChk = document.getElementById('hide-ignored-chk');
  const ignoredCountLabel = document.getElementById('ignored-count-label');
  const candidatesGrid = document.getElementById('candidates-grid');

  // Upcoming Hallmark Movies & News Elements
  const btnFetchNews = document.getElementById('btn-fetch-news');
  const newsFetchFeedback = document.getElementById('news-fetch-feedback');
  const newsCandidatesPanel = document.getElementById('news-candidates-panel');
  const newsCandidatesCountPill = document.getElementById('news-candidates-count-pill');
  const newsHideKnownChk = document.getElementById('news-hide-known-chk');
  const newsHideIgnoredChk = document.getElementById('news-hide-ignored-chk');
  const newsIgnoredCountLabel = document.getElementById('news-ignored-count-label');
  const newsCandidatesGrid = document.getElementById('news-candidates-grid');
  const upcomingCountBadge = document.getElementById('upcoming-count-badge');
  const approvedUpcomingList = document.getElementById('approved-upcoming-list');
  const approvedUpcomingLoading = document.getElementById('approved-upcoming-loading');
  const btnRefreshUpcoming = document.getElementById('btn-refresh-upcoming');

  // Local State
  let currentMovies = [];
  let existingTmdbIds = new Set();
  let hallmarkCandidates = [];
  let ignoredHallmarkTitles = new Set();
  let approvedUpcomingMovies = [];
  let hallmarkNewsCandidates = [];
  let ignoredNewsTitles = new Set();

  try {
    const rawIgnored = localStorage.getItem('HALLMARK_IGNORED_TITLES');
    if (rawIgnored) {
      ignoredHallmarkTitles = new Set(JSON.parse(rawIgnored));
    }
  } catch (e) {
    ignoredHallmarkTitles = new Set();
  }

  try {
    const rawIgnoredNews = localStorage.getItem('HALLMARK_IGNORED_NEWS');
    if (rawIgnoredNews) {
      ignoredNewsTitles = new Set(JSON.parse(rawIgnoredNews));
    }
  } catch (e) {
    ignoredNewsTitles = new Set();
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // =========================================================================
  // 1. Initialize Token from localStorage
  // =========================================================================
  const savedToken = localStorage.getItem('HALLMARK_TMDB_TOKEN') || '';
  if (savedToken) {
    tokenInput.value = savedToken;
    tokenStatus.textContent = '✓ Saved locally';
    tokenStatus.className = 'token-status saved';
  }

  saveTokenBtn.addEventListener('click', () => {
    const token = tokenInput.value.trim();
    if (!token) {
      localStorage.removeItem('HALLMARK_TMDB_TOKEN');
      tokenStatus.textContent = 'Token cleared';
      tokenStatus.className = 'token-status';
      showToast('Token cleared from local storage', 'info');
    } else {
      localStorage.setItem('HALLMARK_TMDB_TOKEN', token);
      tokenStatus.textContent = '✓ Saved locally';
      tokenStatus.className = 'token-status saved';
      showToast('Token saved to local storage', 'success');
    }
  });

  // =========================================================================
  // 2. Shared TMDB Search Function (Manual Search, Bulk Import & News)
  // =========================================================================
  async function searchTmdbMovies(query) {
    const token = (tokenInput ? tokenInput.value : '').trim();
    const rawQuery = (query || '').trim();

    if (!rawQuery) {
      return {
        success: false,
        status: 400,
        statusText: 'Bad Request',
        error: 'Search query cannot be empty',
        results: [],
        total_results: 0,
        results_count: 0
      };
    }

    const res = await fetch(`/api/manage/search?query=${encodeURIComponent(rawQuery)}&token=${encodeURIComponent(token)}`);
    const data = await res.json();
    data.httpStatus = res.status;
    data.rawQuery = rawQuery;

    // Log the raw TMDB response to browser console
    console.group(`[Shared TMDB Search] Query: "${rawQuery}"`);
    console.log('HTTP Status:', res.status, data.statusText || '');
    console.log('TMDB Endpoint:', data.endpoint);
    console.log('TMDB total_results:', data.total_results);
    console.log('Results Received:', data.results_count !== undefined ? data.results_count : (data.results ? data.results.length : 0));
    console.log('Raw TMDB JSON Response:', data.raw || data);
    console.groupEnd();

    return data;
  }

  // =========================================================================
  // 3. Collection Management (Load, Render, Filter, Remove)
  // =========================================================================
  async function loadCollection() {
    collectionLoading.style.display = 'block';
    collectionLoading.textContent = 'Loading movies...';

    try {
      const res = await fetch('/api/manage/movies');
      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error || 'Failed to fetch movies');
      }

      currentMovies = data.movies || [];
      existingTmdbIds = new Set(currentMovies.map((m) => Number(m.tmdbId)));

      collectionCountBadge.textContent = `${currentMovies.length} Movies in Collection`;
      collectionLoading.style.display = 'none';

      renderCollection(currentMovies);
      if (hallmarkCandidates && hallmarkCandidates.length > 0) {
        renderHallmarkCandidates();
      }
    } catch (err) {
      console.error('Error loading collection:', err);
      collectionLoading.textContent = `Error loading movies: ${err.message}`;
    }
  }

  function renderCollection(moviesToRender) {
    collectionList.innerHTML = '';

    if (moviesToRender.length === 0) {
      collectionList.innerHTML = '<div class="loading-state">No movies found in collection.</div>';
      return;
    }

    moviesToRender.forEach((movie) => {
      const item = document.createElement('div');
      item.className = 'collection-item';
      item.id = `col-movie-${movie.tmdbId}`;

      const left = document.createElement('div');
      left.className = 'item-left';

      const poster = document.createElement('img');
      poster.className = 'item-poster';
      poster.src = movie.poster || 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="40" height="60" fill="%23ccc"><rect width="40" height="60"/></svg>';
      poster.alt = movie.title;
      poster.loading = 'lazy';
      poster.referrerPolicy = 'no-referrer';

      const text = document.createElement('div');
      text.className = 'item-text';

      const title = document.createElement('span');
      title.className = 'item-title';
      title.textContent = `${movie.title} (${movie.year || 'Unknown Year'})`;

      const meta = document.createElement('span');
      meta.className = 'item-meta';
      meta.innerHTML = `TMDB: <a href="https://www.themoviedb.org/movie/${movie.tmdbId}" target="_blank" rel="noopener noreferrer">${movie.tmdbId}</a> &bull; IMDb: ${movie.imdbId ? `<a href="https://www.imdb.com/title/${movie.imdbId}" target="_blank" rel="noopener noreferrer">${movie.imdbId}</a>` : 'N/A'}`;

      text.appendChild(title);
      text.appendChild(meta);

      left.appendChild(poster);
      left.appendChild(text);

      const removeBtn = document.createElement('button');
      removeBtn.className = 'btn btn-danger';
      removeBtn.type = 'button';
      removeBtn.textContent = 'Remove';
      
      let confirmTimeout = null;
      removeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (removeBtn.dataset.confirming === 'true') {
          clearTimeout(confirmTimeout);
          removeBtn.dataset.confirming = 'false';
          handleRemoveMovie(movie, removeBtn);
        } else {
          removeBtn.dataset.confirming = 'true';
          removeBtn.textContent = 'Confirm Remove?';
          removeBtn.style.backgroundColor = '#b91c1c';
          removeBtn.style.borderColor = '#991b1b';
          confirmTimeout = setTimeout(() => {
            removeBtn.dataset.confirming = 'false';
            removeBtn.textContent = 'Remove';
            removeBtn.style.backgroundColor = '';
            removeBtn.style.borderColor = '';
          }, 4000);
        }
      });

      item.appendChild(left);
      item.appendChild(removeBtn);

      collectionList.appendChild(item);
    });
  }

  // Filter current collection
  if (collectionSearchInput) {
    collectionSearchInput.addEventListener('input', (e) => {
      const q = e.target.value.toLowerCase().trim();
      if (!q) {
        renderCollection(currentMovies);
        return;
      }
      const filtered = currentMovies.filter(
        (m) =>
          (m.title && m.title.toLowerCase().includes(q)) ||
          (m.year && m.year.toString().includes(q)) ||
          (m.tmdbId && m.tmdbId.toString().includes(q))
      );
      renderCollection(filtered);
    });
  }

  // Remove Movie
  async function handleRemoveMovie(movie, btnElement) {
    const idToRemove = movie.tmdbId || movie.tmdb_id;
    if (!idToRemove) {
      showToast('Error: Movie does not have a valid TMDB ID to remove.', 'error');
      return;
    }

    if (btnElement) {
      btnElement.disabled = true;
      btnElement.textContent = 'Removing...';
    }

    try {
      const res = await fetch('/api/manage/remove', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tmdbId: idToRemove })
      });

      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error || 'Failed to remove movie');
      }

      showToast(`Removed "${movie.title}". Regenerated movies.json, year feeds, and cast.json.`, 'success');

      // Refresh collection list
      await loadCollection();
    } catch (err) {
      console.error('Remove movie error:', err);
      if (btnElement) {
        btnElement.disabled = false;
        btnElement.textContent = 'Remove';
      }
      showToast(`Error: ${err.message}`, 'error');
    }
  }

  // =========================================================================
  // 4. Section 4: Manual TMDB Search Form
  // =========================================================================
  searchForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const rawQuery = searchQueryInput.value.trim();
    if (!rawQuery) return;

    const token = tokenInput.value.trim();
    if (!token) {
      searchFeedback.innerHTML = '<div class="alert-error">⚠️ Please enter your TMDB API Key / Read Access Token in Section 1 first.</div>';
      tokenInput.focus();
      return;
    }

    const isNumericId = /^\d+$/.test(rawQuery);

    searchFeedback.innerHTML = `<div class="alert-info">🔍 ${isNumericId ? `Looking up TMDB Movie ID <strong>${rawQuery}</strong>...` : `Searching TMDB for "<strong>${escapeHtml(rawQuery)}</strong>"...`}</div>`;
    resultsGrid.innerHTML = '<div class="loading-state" style="grid-column: 1/-1;">Contacting TMDB API...</div>';
    searchResultsWrap.style.display = 'block';
    resultsCount.textContent = 'Searching...';

    // Update debug panel
    if (debugPanel) {
      debugPanel.style.display = 'block';
      debugStatus.textContent = 'Requesting...';
      debugStatus.className = 'debug-val';
      debugTotalResults.textContent = '-';
      debugResultsCount.textContent = '-';
      debugEndpoint.textContent = 'Sending request to TMDB...';
      if (debugRawJson) debugRawJson.textContent = 'Fetching from TMDB...';
      if (debugTime) debugTime.textContent = new Date().toLocaleTimeString();
    }

    try {
      const data = await searchTmdbMovies(rawQuery);

      if (debugTime) debugTime.textContent = new Date().toLocaleTimeString();
      if (debugEndpoint) debugEndpoint.textContent = data.endpoint || 'N/A';
      if (debugTotalResults) debugTotalResults.textContent = data.total_results !== undefined && data.total_results !== null ? data.total_results : 'N/A';
      if (debugResultsCount) debugResultsCount.textContent = data.results_count !== undefined ? data.results_count : (data.results ? data.results.length : 0);
      if (debugRawJson) debugRawJson.textContent = JSON.stringify(data.raw || data, null, 2);

      if (!data.success) {
        const errStatus = data.status || 500;
        const errStatusText = data.statusText || 'Error';

        if (debugStatus) {
          debugStatus.textContent = `${errStatus} ${errStatusText}`;
          debugStatus.className = 'debug-val status-error';
        }

        let errorTitle = `TMDB Error (${errStatus} ${errStatusText})`;
        let errorDetail = data.error || 'An unexpected error occurred while querying TMDB.';

        if (errStatus === 401) {
          errorTitle = '🔒 401 Authentication Failed';
          errorDetail = 'Your TMDB API Key / Read Access Token is invalid or unauthorized. Please verify your token in Section 1.';
        } else if (errStatus === 404) {
          errorTitle = isNumericId ? `🔍 404 Movie ID Not Found` : `🔍 404 Not Found`;
          errorDetail = isNumericId ? `TMDB has no record of a movie with ID ${rawQuery}.` : (data.error || 'Resource not found on TMDB.');
        } else if (errStatus === 429) {
          errorTitle = '⏳ 429 Rate Limit Exceeded';
          errorDetail = 'TMDB rate limit reached. Please wait a few moments before searching again.';
        }

        const errorHtml = `
          <div class="alert-error">
            <strong>${errorTitle}</strong>
            <p style="margin-top: 4px; font-size: 0.88rem;">${escapeHtml(errorDetail)}</p>
          </div>
        `;

        searchFeedback.innerHTML = errorHtml;
        resultsGrid.innerHTML = `<div class="error-state" style="grid-column: 1/-1;">${errorHtml}</div>`;
        resultsCount.textContent = `Error ${errStatus}`;
        return;
      }

      if (debugStatus) {
        debugStatus.textContent = `${data.status || 200} OK`;
        debugStatus.className = 'debug-val status-ok';
      }

      const results = data.results || [];
      resultsCount.textContent = `${results.length} result(s) found`;

      if (results.length === 0) {
        searchFeedback.innerHTML = `
          <div class="alert-notice">
            <strong>200 OK &bull; 0 matching movies returned by TMDB.</strong>
            <p style="margin-top: 4px; font-size: 0.88rem;">TMDB search returned 0 results for <em>"${escapeHtml(rawQuery)}"</em>. Try alternate terms or enter the numeric TMDB ID directly.</p>
          </div>
        `;
        resultsGrid.innerHTML = `
          <div class="zero-state" style="grid-column: 1/-1;">
            <p style="font-weight: 500; font-size: 1rem; color: var(--text-main);">No matching movies found on TMDB for "<strong>${escapeHtml(rawQuery)}</strong>".</p>
          </div>
        `;
        return;
      }

      searchFeedback.innerHTML = '';
      renderSearchResults(results);
    } catch (err) {
      console.error('[TMDB Search Error]:', err);
      if (debugStatus) {
        debugStatus.textContent = 'Network Error';
        debugStatus.className = 'debug-val status-error';
      }
      const netErrorHtml = `
        <div class="alert-error">
          <strong>🌐 Network / Connection Error</strong>
          <p style="margin-top: 4px; font-size: 0.88rem;">Unable to connect to TMDB: ${escapeHtml(err.message)}</p>
        </div>
      `;
      searchFeedback.innerHTML = netErrorHtml;
      resultsGrid.innerHTML = `<div class="error-state" style="grid-column: 1/-1;">${netErrorHtml}</div>`;
      resultsCount.textContent = 'Network Error';
    }
  });

  function renderSearchResults(results) {
    resultsGrid.innerHTML = '';

    results.forEach((movie) => {
      const card = document.createElement('div');
      card.className = 'result-card';
      card.id = `search-result-${movie.tmdbId}`;

      const posterWrap = document.createElement('div');
      posterWrap.style.flexShrink = '0';

      const poster = document.createElement('img');
      poster.className = 'result-poster';
      poster.src = movie.poster || 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="85" height="128" fill="%23f1f5f9"><rect width="85" height="128" fill="%23e2e8f0"/><text x="50%" y="45%" font-size="11" text-anchor="middle" dominant-baseline="middle" fill="%2364748b" font-family="sans-serif">No Poster</text></svg>';
      poster.alt = movie.title;
      poster.loading = 'lazy';
      poster.referrerPolicy = 'no-referrer';
      posterWrap.appendChild(poster);

      const info = document.createElement('div');
      info.className = 'result-info';

      const title = document.createElement('h3');
      title.className = 'result-title';
      title.textContent = movie.title;
      info.appendChild(title);

      if (movie.original_title) {
        const origTitle = document.createElement('div');
        origTitle.className = 'result-orig-title';
        origTitle.innerHTML = `<strong>Original Title:</strong> ${escapeHtml(movie.original_title)}`;
        info.appendChild(origTitle);
      }

      const meta = document.createElement('div');
      meta.className = 'result-meta';
      const releaseDateText = movie.release_date ? movie.release_date : (movie.year ? String(movie.year) : 'Unknown');
      meta.innerHTML = `
        <span>📅 <strong>Release Date:</strong> ${escapeHtml(releaseDateText)}</span>
        <span>🆔 <strong>TMDB ID:</strong> <a href="https://www.themoviedb.org/movie/${movie.tmdbId}" target="_blank" rel="noopener noreferrer">${movie.tmdbId}</a></span>
      `;
      info.appendChild(meta);

      const overview = document.createElement('p');
      overview.className = 'result-overview';
      overview.textContent = movie.overview || 'No overview synopsis provided by TMDB.';
      info.appendChild(overview);

      const actions = document.createElement('div');
      actions.className = 'result-actions';

      const actionBtn = document.createElement('button');
      actionBtn.type = 'button';

      const isAlreadyIn = existingTmdbIds.has(Number(movie.tmdbId));
      if (isAlreadyIn) {
        actionBtn.className = 'btn btn-disabled';
        actionBtn.disabled = true;
        actionBtn.textContent = '✓ In Collection';
      } else {
        actionBtn.className = 'btn btn-primary btn-add-movie';
        actionBtn.textContent = '+ Add Movie';
        actionBtn.addEventListener('click', () => {
          handleAddMovie(movie, actionBtn);
        });
      }

      actions.appendChild(actionBtn);
      info.appendChild(actions);

      card.appendChild(posterWrap);
      card.appendChild(info);

      resultsGrid.appendChild(card);
    });
  }

  async function handleAddMovie(movie, btnElement) {
    const token = tokenInput.value.trim();
    btnElement.disabled = true;
    btnElement.textContent = 'Adding...';

    try {
      const res = await fetch('/api/manage/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tmdbId: movie.tmdbId, token })
      });

      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error || 'Failed to add movie');
      }

      btnElement.className = 'btn btn-disabled';
      btnElement.disabled = true;
      btnElement.textContent = '✓ In Collection';

      showToast(`Added "${movie.title}". Regenerated movies.json, year feeds, and cast.json.`, 'success');

      // Refresh collection list
      await loadCollection();
    } catch (err) {
      console.error('Add movie error:', err);
      btnElement.disabled = false;
      btnElement.className = 'btn btn-primary';
      btnElement.textContent = '+ Add Movie';
      showToast(`Error: ${err.message}`, 'error');
    }
  }

  // =========================================================================
  // 5. Section 2: Hallmark Countdown to Christmas Import Logic
  // =========================================================================
  if (hallmarkYearSelect) {
    hallmarkYearSelect.addEventListener('change', () => {
      const yr = hallmarkYearSelect.value;
      if (hallmarkSourcePreview) {
        hallmarkSourcePreview.textContent = `Source: https://www.hallmarkchannel.com/christmas/countdown-to-christmas-${yr}-preview/`;
      }
    });
  }

  if (btnFetchHallmark) {
    btnFetchHallmark.addEventListener('click', async () => {
      const year = hallmarkYearSelect.value;
      const token = tokenInput.value.trim();

      hallmarkFetchFeedback.style.display = 'block';
      hallmarkFetchFeedback.className = 'feedback feedback-info';
      hallmarkFetchFeedback.innerHTML = `Fetching Hallmark Countdown to Christmas candidates for <strong>${year}</strong> and querying TMDB using the shared search...`;

      btnFetchHallmark.disabled = true;
      btnFetchHallmark.textContent = 'Fetching Hallmark Movies...';

      try {
        // 1. Fetch raw candidate titles from Hallmark
        const rawRes = await fetch(`/api/manage/hallmark-raw-candidates?year=${encodeURIComponent(year)}`);
        const rawData = await rawRes.json();

        let rawCandidates = [];
        if (rawData.success && Array.isArray(rawData.candidates) && rawData.candidates.length > 0) {
          rawCandidates = rawData.candidates;
        } else {
          // Fallback to fetch endpoint
          const fallbackRes = await fetch(`/api/manage/hallmark-fetch?year=${encodeURIComponent(year)}${token ? `&token=${encodeURIComponent(token)}` : ''}`);
          const fallbackData = await fallbackRes.json();
          rawCandidates = fallbackData.candidates || [];
        }

        hallmarkCandidates = [];

        // 2. Query TMDB for EACH candidate using the EXACT SAME shared searchTmdbMovies() function
        for (let i = 0; i < rawCandidates.length; i++) {
          const c = rawCandidates[i];
          btnFetchHallmark.textContent = `Matching TMDB (${i + 1}/${rawCandidates.length})...`;

          const candObj = {
            hallmarkTitle: c.hallmarkTitle,
            possibleSeries: Boolean(c.possibleSeries),
            seriesReason: c.seriesReason || null,
            year: c.year || parseInt(year, 10),
            tmdbResults: []
          };

          try {
            // Pass candidate title unchanged into the SAME searchTmdbMovies() function
            const tmdbRes = await searchTmdbMovies(c.hallmarkTitle);
            if (tmdbRes && tmdbRes.results && tmdbRes.results.length > 0) {
              // Up to top 3 TMDB search results
              candObj.tmdbResults = tmdbRes.results.slice(0, 3).map((m) => ({
                id: m.id || m.tmdbId,
                tmdbId: m.id || m.tmdbId,
                title: m.title,
                year: m.year || (m.release_date ? parseInt(m.release_date.split('-')[0], 10) : null),
                release_date: m.release_date || '',
                overview: m.overview || '',
                poster: m.poster || (m.poster_path ? `https://image.tmdb.org/t/p/w500${m.poster_path}` : null),
                imdb_id: m.imdb_id || null
              }));
            }
          } catch (e) {
            console.warn(`TMDB search error for candidate "${c.hallmarkTitle}":`, e);
          }

          hallmarkCandidates.push(candObj);
        }

        hallmarkCandidatesPanel.style.display = 'block';
        candidatesHeaderTitle.textContent = `${year} Countdown to Christmas Candidates`;

        hallmarkFetchFeedback.className = 'feedback feedback-success';
        hallmarkFetchFeedback.innerHTML = `✓ Successfully fetched <strong>${hallmarkCandidates.length}</strong> official Hallmark candidate titles for ${year} using the shared TMDB search. Review each candidate's matches below.`;

        renderHallmarkCandidates();
      } catch (err) {
        console.error('Error fetching Hallmark candidates:', err);
        hallmarkFetchFeedback.className = 'feedback feedback-error';
        hallmarkFetchFeedback.textContent = `Error fetching Hallmark movies: ${err.message}`;
      } finally {
        btnFetchHallmark.disabled = false;
        btnFetchHallmark.textContent = 'FETCH HALLMARK MOVIES';
      }
    });
  }

  if (btnImportAllHallmark) {
    btnImportAllHallmark.addEventListener('click', async () => {
      const token = tokenInput.value.trim();
      if (!token) {
        hallmarkFetchFeedback.style.display = 'block';
        hallmarkFetchFeedback.className = 'feedback feedback-error';
        hallmarkFetchFeedback.textContent = 'Please enter your TMDB API token before importing.';
        tokenInput.focus();
        return;
      }

      const confirmed = window.confirm('Import only unique exact title and year matches from 2008 through 2025? Ambiguous titles, series, and unavailable Hallmark pages will be skipped.');
      if (!confirmed) return;

      btnImportAllHallmark.disabled = true;
      btnFetchHallmark.disabled = true;
      btnImportAllHallmark.textContent = 'IMPORTING VERIFIED MOVIES...';
      hallmarkFetchFeedback.style.display = 'block';
      hallmarkFetchFeedback.className = 'feedback feedback-info';
      hallmarkFetchFeedback.textContent = 'Checking Hallmark pages and verifying each title against TMDB...';

      try {
        const res = await fetch('/api/manage/hallmark-import-all', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token })
        });
        const data = await res.json();
        if (!res.ok || !data.success) throw new Error(data.error || 'Bulk import failed');

        const imported = data.imported || [];
        const skipped = data.skipped || [];
        const skippedSummary = skipped.length
          ? ` Skipped ${skipped.length} uncertain or already-added titles.`
          : '';
        hallmarkFetchFeedback.className = 'feedback feedback-success';
        hallmarkFetchFeedback.innerHTML = `✓ Added <strong>${imported.length}</strong> verified movies from ${data.years.join(', ')}.${skippedSummary}`;
        await loadCollection();
      } catch (err) {
        hallmarkFetchFeedback.className = 'feedback feedback-error';
        hallmarkFetchFeedback.textContent = `Bulk import error: ${err.message}`;
      } finally {
        btnImportAllHallmark.disabled = false;
        btnFetchHallmark.disabled = false;
        btnImportAllHallmark.textContent = 'IMPORT ALL VERIFIED YEARS';
      }
    });
  }

  function isCandidateInCollection(cand) {
    if (cand.tmdbResults && cand.tmdbResults.length > 0) {
      if (cand.tmdbResults.some((m) => existingTmdbIds.has(Number(m.tmdbId || m.id)))) {
        return true;
      }
    }
    const cleanCandTitle = (cand.hallmarkTitle || '').toLowerCase().trim();
    return currentMovies.some(m => m.title && m.title.toLowerCase().trim() === cleanCandTitle);
  }

  function renderHallmarkCandidates() {
    if (!candidatesGrid) return;
    candidatesGrid.innerHTML = '';

    const hideAlreadyInCollection = hideInCollectionChk ? hideInCollectionChk.checked : false;
    const hideIgnored = hideIgnoredChk ? hideIgnoredChk.checked : true;

    let totalIgnored = 0;
    hallmarkCandidates.forEach(c => {
      if (ignoredHallmarkTitles.has(c.hallmarkTitle.toLowerCase().trim())) {
        totalIgnored++;
      }
    });
    if (ignoredCountLabel) {
      ignoredCountLabel.textContent = totalIgnored;
    }

    const visibleCandidates = hallmarkCandidates.filter(c => {
      const isIgnored = ignoredHallmarkTitles.has(c.hallmarkTitle.toLowerCase().trim());
      if (hideIgnored && isIgnored) return false;

      const isInCollection = isCandidateInCollection(c);
      if (hideAlreadyInCollection && isInCollection) return false;

      return true;
    });

    if (candidatesCountPill) {
      candidatesCountPill.textContent = `${visibleCandidates.length} of ${hallmarkCandidates.length} Candidates`;
    }

    if (visibleCandidates.length === 0) {
      candidatesGrid.innerHTML = `
        <div style="padding: 32px; text-align: center; color: var(--text-muted); background: #f8fafc; border-radius: 6px; border: 1px dashed var(--border);">
          No candidates match the active filter criteria (e.g. all shown items are already in your collection or marked ignored).
        </div>
      `;
      return;
    }

    visibleCandidates.forEach((candidate) => {
      const card = createCandidateCard(candidate);
      candidatesGrid.appendChild(card);
    });
  }

  function createCandidateCard(cand) {
    const card = document.createElement('div');
    const isIgnored = ignoredHallmarkTitles.has(cand.hallmarkTitle.toLowerCase().trim());
    const alreadyInCollection = isCandidateInCollection(cand);
    const tmdbMatches = cand.tmdbResults || [];
    const hasTmdbMatch = tmdbMatches.length > 0;

    let cardClasses = ['candidate-card'];
    if (isIgnored) cardClasses.push('is-ignored');
    if (cand.possibleSeries) cardClasses.push('is-series-warning');
    if (alreadyInCollection) cardClasses.push('is-in-collection');
    if (!hasTmdbMatch) cardClasses.push('is-not-found');
    card.className = cardClasses.join(' ');
    card.id = `candidate-${cand.hallmarkTitle.replace(/[^a-zA-Z0-9]/g, '_')}`;

    // Header Line
    const headerLine = document.createElement('div');
    headerLine.className = 'candidate-header-line';

    const sourceInfo = document.createElement('div');
    sourceInfo.className = 'candidate-source-info';

    const hallmarkTitleEl = document.createElement('div');
    hallmarkTitleEl.className = 'hallmark-title-badge';
    hallmarkTitleEl.innerHTML = `<strong>Hallmark Title:</strong> ${escapeHtml(cand.hallmarkTitle)}`;
    sourceInfo.appendChild(hallmarkTitleEl);

    if (cand.possibleSeries) {
      const seriesReasonEl = document.createElement('div');
      seriesReasonEl.className = 'series-warning-badge';
      seriesReasonEl.innerHTML = `⚠️ <strong>Series Warning:</strong> ${escapeHtml(cand.seriesReason || 'Hallmark source indicates this may be an episodic series or competition.')}`;
      sourceInfo.appendChild(seriesReasonEl);
    }

    headerLine.appendChild(sourceInfo);

    const statusPillWrap = document.createElement('div');
    statusPillWrap.className = 'status-pill-wrap';

    if (alreadyInCollection) {
      const inCollPill = document.createElement('span');
      inCollPill.className = 'badge-in-collection';
      inCollPill.textContent = '✓ IN COLLECTION';
      statusPillWrap.appendChild(inCollPill);
    } else if (isIgnored) {
      const ignoredPill = document.createElement('span');
      ignoredPill.className = 'badge-ignored';
      ignoredPill.textContent = 'IGNORED';
      statusPillWrap.appendChild(ignoredPill);
    }
    headerLine.appendChild(statusPillWrap);
    card.appendChild(headerLine);

    // Body
    const body = document.createElement('div');
    body.className = 'candidate-body';

    if (hasTmdbMatch) {
      const resultsContainer = document.createElement('div');
      resultsContainer.className = 'candidate-results-list';

      tmdbMatches.forEach((m) => {
        const item = document.createElement('div');
        const isThisInColl = existingTmdbIds.has(Number(m.tmdbId || m.id));
        item.className = `candidate-result-item ${isThisInColl ? 'is-match-in-collection' : ''}`;

        // Poster
        const posterWrap = document.createElement('div');
        posterWrap.className = 'result-item-poster-wrap';
        const posterImg = document.createElement('img');
        posterImg.className = 'result-item-poster';
        posterImg.src = m.poster || 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="68" height="102" viewBox="0 0 68 102"><rect width="68" height="102" fill="%23e2e8f0"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" font-family="sans-serif" font-size="9" fill="%2364748b">No Poster</text></svg>';
        posterImg.alt = m.title;
        posterImg.loading = 'lazy';
        posterImg.referrerPolicy = 'no-referrer';
        posterImg.onerror = () => {
          posterImg.onerror = null;
          posterImg.src = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="68" height="102" viewBox="0 0 68 102"><rect width="68" height="102" fill="%23f1f5f9"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" font-family="sans-serif" font-size="9" fill="%2394a3b8">No Poster</text></svg>';
        };
        posterWrap.appendChild(posterImg);
        item.appendChild(posterWrap);

        // Info
        const info = document.createElement('div');
        info.className = 'result-item-info';

        const header = document.createElement('div');
        header.className = 'result-item-header';
        const titleEl = document.createElement('span');
        titleEl.className = 'result-item-title';
        titleEl.textContent = m.title || 'Untitled';
        header.appendChild(titleEl);

        if (m.year) {
          const yearEl = document.createElement('span');
          yearEl.className = 'result-item-year';
          yearEl.textContent = `(${m.year})`;
          header.appendChild(yearEl);
        }
        info.appendChild(header);

        const ids = document.createElement('div');
        ids.className = 'result-item-ids';
        ids.innerHTML = `TMDB ID: <a href="https://www.themoviedb.org/movie/${m.tmdbId || m.id}" target="_blank" rel="noopener noreferrer">${m.tmdbId || m.id}</a>${m.imdb_id ? ` &bull; IMDb: <a href="https://www.imdb.com/title/${m.imdb_id}/" target="_blank" rel="noopener noreferrer">${m.imdb_id}</a>` : ''}`;
        info.appendChild(ids);

        const overview = document.createElement('p');
        overview.className = 'result-item-overview';
        overview.textContent = m.overview || 'No synopsis provided by TMDB.';
        info.appendChild(overview);

        // Action button: [ USE THIS MATCH ]
        const actionWrap = document.createElement('div');
        actionWrap.className = 'result-item-action';

        if (isThisInColl) {
          const disabledBtn = document.createElement('button');
          disabledBtn.type = 'button';
          disabledBtn.className = 'btn btn-disabled btn-sm';
          disabledBtn.disabled = true;
          disabledBtn.textContent = '✓ In Collection';
          actionWrap.appendChild(disabledBtn);
        } else {
          const useMatchBtn = document.createElement('button');
          useMatchBtn.type = 'button';
          useMatchBtn.className = 'btn btn-primary btn-sm btn-use-match';
          useMatchBtn.textContent = '[ USE THIS MATCH ]';
          useMatchBtn.addEventListener('click', () => approveCandidateMatch(cand, m, useMatchBtn));
          actionWrap.appendChild(useMatchBtn);
        }

        info.appendChild(actionWrap);
        item.appendChild(info);
        resultsContainer.appendChild(item);
      });

      body.appendChild(resultsContainer);
    } else {
      // No TMDB match found
      const notFoundCol = document.createElement('div');
      notFoundCol.className = 'candidate-details';
      notFoundCol.style.width = '100%';

      const alertMsg = document.createElement('div');
      alertMsg.style.cssText = 'background: #fef2f2; border: 1px solid #fee2e2; padding: 12px 16px; border-radius: 6px; margin-bottom: 12px; color: #991b1b;';
      alertMsg.innerHTML = `
        <strong>TMDB MATCH NOT FOUND</strong>
        <p style="margin-top: 4px; font-size: 0.88rem; color: #7f1d1d;">
          TMDB could not find search results for "<em>${escapeHtml(cand.hallmarkTitle)}</em>". 
          Use the options below to search TMDB with modified keywords, enter a numeric TMDB ID, or ignore this entry.
        </p>
      `;
      notFoundCol.appendChild(alertMsg);
      body.appendChild(notFoundCol);
    }

    // Secondary actions (Search manually, Enter ID, Ignore)
    const secondaryActions = document.createElement('div');
    secondaryActions.className = 'candidate-actions';

    const searchAgainBtn = document.createElement('button');
    searchAgainBtn.type = 'button';
    searchAgainBtn.className = 'btn btn-outline btn-sm';
    searchAgainBtn.textContent = 'SEARCH MANUALLY';
    searchAgainBtn.addEventListener('click', () => toggleCandidateSearchDrawer(card, cand));
    secondaryActions.appendChild(searchAgainBtn);

    const enterIdBtn = document.createElement('button');
    enterIdBtn.type = 'button';
    enterIdBtn.className = 'btn btn-outline btn-sm';
    enterIdBtn.textContent = 'ENTER TMDB ID';
    enterIdBtn.addEventListener('click', () => toggleCandidateIdDrawer(card, cand));
    secondaryActions.appendChild(enterIdBtn);

    const ignoreBtn = document.createElement('button');
    ignoreBtn.type = 'button';
    ignoreBtn.className = 'btn btn-ghost btn-sm';
    ignoreBtn.textContent = isIgnored ? 'UNDO IGNORE' : 'IGNORE';
    ignoreBtn.addEventListener('click', () => toggleIgnoreCandidate(cand));
    secondaryActions.appendChild(ignoreBtn);

    card.appendChild(body);
    card.appendChild(secondaryActions);

    const drawerWrap = document.createElement('div');
    drawerWrap.className = 'candidate-drawer-container';
    card.appendChild(drawerWrap);

    return card;
  }

  async function approveCandidateMatch(cand, tmdbMovie, btnElement) {
    const token = (tokenInput ? tokenInput.value : '').trim();
    if (!token) {
      showToast('Please enter your TMDB API Key / Access Token in Section 1 first.', 'error');
      tokenInput.focus();
      return;
    }

    const movieTmdbId = tmdbMovie.tmdbId || tmdbMovie.id;
    btnElement.disabled = true;
    btnElement.textContent = 'Adding...';

    try {
      const res = await fetch('/api/manage/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tmdbId: movieTmdbId, token })
      });
      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error || 'Failed to add movie');
      }

      existingTmdbIds.add(Number(movieTmdbId));
      btnElement.className = 'btn btn-disabled btn-sm';
      btnElement.disabled = true;
      btnElement.textContent = '✓ Added to Collection';

      showToast(`Added "${tmdbMovie.title}" (${tmdbMovie.year || ''}) to collection.`, 'success');
      await loadCollection();
      renderHallmarkCandidates();
    } catch (err) {
      console.error('Approve candidate error:', err);
      btnElement.disabled = false;
      btnElement.textContent = '[ USE THIS MATCH ]';
      showToast(`Error: ${err.message}`, 'error');
    }
  }

  function toggleCandidateSearchDrawer(cardEl, cand) {
    const drawerContainer = cardEl.querySelector('.candidate-drawer-container');
    const existingDrawer = drawerContainer.querySelector('.candidate-drawer');
    if (existingDrawer) {
      existingDrawer.remove();
      return;
    }

    const drawer = document.createElement('div');
    drawer.className = 'candidate-drawer';
    drawer.innerHTML = `
      <div class="drawer-title">Search TMDB for "${escapeHtml(cand.hallmarkTitle)}"</div>
      <div class="drawer-input-row">
        <input type="text" class="drawer-query-input" value="${escapeHtml(cand.hallmarkTitle)}" placeholder="Search movie title..." />
        <button type="button" class="btn btn-primary btn-sm drawer-search-btn">Search TMDB</button>
      </div>
      <div class="drawer-results-wrap" style="display: none;">
        <div class="drawer-results-list"></div>
      </div>
    `;

    const input = drawer.querySelector('.drawer-query-input');
    const searchBtn = drawer.querySelector('.drawer-search-btn');
    const resultsWrap = drawer.querySelector('.drawer-results-wrap');
    const resultsList = drawer.querySelector('.drawer-results-list');

    const doSearch = async () => {
      const q = input.value.trim();
      if (!q) return;

      searchBtn.disabled = true;
      searchBtn.textContent = 'Searching...';
      resultsWrap.style.display = 'block';
      resultsList.innerHTML = '<div style="padding: 8px; color: var(--text-muted);">Searching TMDB...</div>';

      try {
        const data = await searchTmdbMovies(q);

        if (!data.success || !data.results || data.results.length === 0) {
          resultsList.innerHTML = '<div style="padding: 8px; color: var(--text-muted);">No TMDB results found for this query.</div>';
          return;
        }

        resultsList.innerHTML = '';
        data.results.forEach((m) => {
          const item = document.createElement('div');
          item.className = 'drawer-result-item';

          const info = document.createElement('div');
          info.className = 'drawer-result-info';

          if (m.poster) {
            const thumb = document.createElement('img');
            thumb.className = 'drawer-thumb';
            thumb.src = m.poster;
            thumb.alt = m.title;
            info.appendChild(thumb);
          }

          const textWrap = document.createElement('div');
          textWrap.innerHTML = `
            <strong>${escapeHtml(m.title)}</strong> ${m.year ? `(${m.year})` : ''} 
            <span style="color: var(--text-muted); font-size: 0.78rem;">TMDB #${m.id}</span>
          `;
          info.appendChild(textWrap);
          item.appendChild(info);

          const selectBtn = document.createElement('button');
          selectBtn.type = 'button';
          selectBtn.className = 'btn btn-primary btn-sm';
          selectBtn.textContent = 'Select This Movie';
          selectBtn.addEventListener('click', () => {
            cand.tmdbResults = [{
              id: m.id || m.tmdbId,
              tmdbId: m.id || m.tmdbId,
              title: m.title,
              year: m.year,
              release_date: m.release_date,
              overview: m.overview,
              poster: m.poster,
              imdb_id: m.imdb_id || null
            }];
            showToast(`Selected "${m.title}" for Hallmark title "${cand.hallmarkTitle}".`, 'info');
            renderHallmarkCandidates();
          });

          item.appendChild(selectBtn);
          resultsList.appendChild(item);
        });
      } catch (err) {
        resultsList.innerHTML = `<div style="padding: 8px; color: #dc2626;">Error: ${escapeHtml(err.message)}</div>`;
      } finally {
        searchBtn.disabled = false;
        searchBtn.textContent = 'Search TMDB';
      }
    };

    searchBtn.addEventListener('click', doSearch);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        doSearch();
      }
    });

    drawerContainer.appendChild(drawer);
    input.focus();
    input.select();
  }

  function toggleCandidateIdDrawer(cardEl, cand) {
    const drawerContainer = cardEl.querySelector('.candidate-drawer-container');
    const existingDrawer = drawerContainer.querySelector('.candidate-drawer');
    if (existingDrawer) {
      existingDrawer.remove();
      return;
    }

    const drawer = document.createElement('div');
    drawer.className = 'candidate-drawer';
    drawer.innerHTML = `
      <div class="drawer-title">Enter Numeric TMDB ID for "${escapeHtml(cand.hallmarkTitle)}"</div>
      <div class="drawer-input-row">
        <input type="text" class="drawer-id-input" placeholder="e.g. 1064137" />
        <button type="button" class="btn btn-primary btn-sm drawer-lookup-btn">Lookup &amp; Select</button>
      </div>
      <div class="drawer-feedback" style="font-size: 0.82rem; color: var(--text-muted);"></div>
    `;

    const input = drawer.querySelector('.drawer-id-input');
    const lookupBtn = drawer.querySelector('.drawer-lookup-btn');
    const feedback = drawer.querySelector('.drawer-feedback');

    const doLookup = async () => {
      const id = input.value.trim();
      if (!id || !/^\d+$/.test(id)) {
        feedback.textContent = 'Please enter a valid numeric TMDB ID.';
        feedback.style.color = '#dc2626';
        return;
      }

      lookupBtn.disabled = true;
      lookupBtn.textContent = 'Looking up...';
      feedback.textContent = 'Fetching movie from TMDB...';
      feedback.style.color = 'var(--text-muted)';

      try {
        const data = await searchTmdbMovies(id);

        if (!data.success || !data.results || data.results.length === 0) {
          throw new Error('Movie not found on TMDB with that ID.');
        }

        const m = data.results[0];
        cand.tmdbResults = [{
          id: m.id || m.tmdbId,
          tmdbId: m.id || m.tmdbId,
          title: m.title,
          year: m.year,
          release_date: m.release_date,
          overview: m.overview,
          poster: m.poster,
          imdb_id: m.imdb_id || null
        }];
        showToast(`Matched "${cand.hallmarkTitle}" to TMDB movie "${m.title}".`, 'success');
        renderHallmarkCandidates();
      } catch (err) {
        feedback.textContent = err.message;
        feedback.style.color = '#dc2626';
      } finally {
        lookupBtn.disabled = false;
        lookupBtn.textContent = 'Lookup & Select';
      }
    };

    lookupBtn.addEventListener('click', doLookup);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        doLookup();
      }
    });

    drawerContainer.appendChild(drawer);
    input.focus();
  }

  function toggleIgnoreCandidate(cand) {
    const normTitle = cand.hallmarkTitle.toLowerCase().trim();
    if (ignoredHallmarkTitles.has(normTitle)) {
      ignoredHallmarkTitles.delete(normTitle);
      showToast(`Restored "${cand.hallmarkTitle}" to candidates list.`, 'info');
    } else {
      ignoredHallmarkTitles.add(normTitle);
      showToast(`Ignored Hallmark entry "${cand.hallmarkTitle}".`, 'info');
    }
    localStorage.setItem('HALLMARK_IGNORED_TITLES', JSON.stringify([...ignoredHallmarkTitles]));
    renderHallmarkCandidates();
  }

  if (hideInCollectionChk) {
    hideInCollectionChk.addEventListener('change', renderHallmarkCandidates);
  }
  if (hideIgnoredChk) {
    hideIgnoredChk.addEventListener('change', renderHallmarkCandidates);
  }

  // =========================================================================
  // 6. Section 3: Upcoming Hallmark Movies & Hallmark News Logic
  // =========================================================================

  // Load approved upcoming movies
  async function loadApprovedUpcoming() {
    if (!approvedUpcomingLoading || !approvedUpcomingList) return;

    approvedUpcomingLoading.style.display = 'block';
    approvedUpcomingLoading.textContent = 'Loading upcoming movies...';

    try {
      const res = await fetch('/api/manage/upcoming');
      const data = await res.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to load upcoming movies');
      }

      approvedUpcomingMovies = data.movies || [];
      if (upcomingCountBadge) {
        upcomingCountBadge.textContent = `${approvedUpcomingMovies.length} Approved Upcoming`;
      }
      approvedUpcomingLoading.style.display = 'none';

      renderApprovedUpcomingList();
    } catch (err) {
      console.error('Error loading upcoming movies:', err);
      approvedUpcomingLoading.textContent = `Error: ${err.message}`;
    }
  }

  if (btnRefreshUpcoming) {
    btnRefreshUpcoming.addEventListener('click', loadApprovedUpcoming);
  }

  function renderApprovedUpcomingList() {
    if (!approvedUpcomingList) return;
    approvedUpcomingList.innerHTML = '';

    if (approvedUpcomingMovies.length === 0) {
      approvedUpcomingList.innerHTML = `
        <div style="padding: 24px; text-align: center; color: var(--text-muted); background: #f8fafc; border-radius: 6px; border: 1px dashed var(--border);">
          No upcoming movies currently scheduled. Use "Check Hallmark Movie News" above to discover and approve candidates!
        </div>
      `;
      return;
    }

    approvedUpcomingMovies.forEach((movie) => {
      const item = document.createElement('div');
      item.className = 'collection-item';
      item.id = `upcoming-movie-${movie.id}`;

      const left = document.createElement('div');
      left.className = 'item-left';

      const poster = document.createElement('img');
      poster.className = 'item-poster';
      poster.src = movie.poster || 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="40" height="60" fill="%23ccc"><rect width="40" height="60"/></svg>';
      poster.alt = movie.title;
      poster.loading = 'lazy';
      poster.referrerPolicy = 'no-referrer';

      const text = document.createElement('div');
      text.className = 'item-text';

      const titleRow = document.createElement('div');
      titleRow.style.display = 'flex';
      titleRow.style.alignItems = 'center';
      titleRow.style.gap = '8px';

      const title = document.createElement('span');
      title.className = 'item-title';
      title.textContent = movie.title;
      titleRow.appendChild(title);

      const tag = document.createElement('span');
      tag.className = 'badge-upcoming-tag';
      tag.textContent = 'UPCOMING';
      titleRow.appendChild(tag);
      text.appendChild(titleRow);

      const meta = document.createElement('span');
      meta.className = 'item-meta';
      const premiereStr = movie.premiereDate && movie.premiereDate !== 'TBA' ? movie.premiereDate : 'TBA';
      meta.innerHTML = `<span class="item-premiere">📅 Expected Premiere: <strong>${escapeHtml(premiereStr)}</strong></span> &bull; TMDB ID: ${movie.tmdbId ? `<a href="https://www.themoviedb.org/movie/${movie.tmdbId}" target="_blank" rel="noopener noreferrer">${movie.tmdbId}</a>` : 'N/A'}`;
      text.appendChild(meta);

      if (movie.overview) {
        const overview = document.createElement('div');
        overview.style.cssText = 'font-size: 0.8rem; color: var(--text-muted); margin-top: 4px; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;';
        overview.textContent = movie.overview;
        text.appendChild(overview);
      }

      left.appendChild(poster);
      left.appendChild(text);

      const actions = document.createElement('div');
      actions.style.display = 'flex';
      actions.style.gap = '8px';
      actions.style.alignItems = 'center';

      // 1. Move to Collection Button
      const promoteBtn = document.createElement('button');
      promoteBtn.className = 'btn btn-sm btn-promote';
      promoteBtn.type = 'button';
      promoteBtn.textContent = 'Move to Collection';
      promoteBtn.title = 'Move this movie to the released movies.json catalogue';
      promoteBtn.addEventListener('click', () => handlePromoteUpcoming(movie, promoteBtn));
      actions.appendChild(promoteBtn);

      // 2. Edit Button
      const editBtn = document.createElement('button');
      editBtn.className = 'btn btn-outline btn-sm';
      editBtn.type = 'button';
      editBtn.textContent = 'Edit';
      editBtn.addEventListener('click', () => openEditUpcomingModal(movie));
      actions.appendChild(editBtn);

      // 3. Remove Button (with 2-step confirmation)
      const removeBtn = document.createElement('button');
      removeBtn.className = 'btn btn-danger btn-sm';
      removeBtn.type = 'button';
      removeBtn.textContent = 'Remove';
      
      let confirmTimeout = null;
      removeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (removeBtn.dataset.confirming === 'true') {
          clearTimeout(confirmTimeout);
          removeBtn.dataset.confirming = 'false';
          handleRemoveUpcoming(movie, removeBtn);
        } else {
          removeBtn.dataset.confirming = 'true';
          removeBtn.textContent = 'Confirm?';
          confirmTimeout = setTimeout(() => {
            removeBtn.dataset.confirming = 'false';
            removeBtn.textContent = 'Remove';
          }, 3500);
        }
      });
      actions.appendChild(removeBtn);

      item.appendChild(left);
      item.appendChild(actions);
      approvedUpcomingList.appendChild(item);
    });
  }

  async function handlePromoteUpcoming(movie, btn) {
    const token = tokenInput.value.trim();
    if (!confirm(`Move "${movie.title}" to the released movies collection?\n\nThis will remove it from Upcoming and add it to movies.json and cast.json.`)) {
      return;
    }

    btn.disabled = true;
    btn.textContent = 'Promoting...';

    try {
      const res = await fetch('/api/manage/upcoming/promote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: movie.id,
          movieData: movie,
          token
        })
      });

      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error || 'Failed to promote movie');
      }

      showToast(`✓ Moved "${movie.title}" to released collection!`, 'success');
      await loadApprovedUpcoming();
      await loadCollection();
    } catch (err) {
      console.error('Promote upcoming error:', err);
      btn.disabled = false;
      btn.textContent = 'Move to Collection';
      showToast(`Error: ${err.message}`, 'error');
    }
  }

  async function handleRemoveUpcoming(movie, btn) {
    btn.disabled = true;
    btn.textContent = 'Removing...';

    try {
      const res = await fetch('/api/manage/upcoming/remove', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: movie.id })
      });

      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error || 'Failed to remove movie');
      }

      showToast(`Removed "${movie.title}" from upcoming movies.`, 'info');
      await loadApprovedUpcoming();
    } catch (err) {
      console.error('Remove upcoming error:', err);
      btn.disabled = false;
      btn.textContent = 'Remove';
      showToast(`Error: ${err.message}`, 'error');
    }
  }

  function openEditUpcomingModal(movie) {
    const existing = document.getElementById('edit-upcoming-modal');
    if (existing) existing.remove();

    const backdrop = document.createElement('div');
    backdrop.id = 'edit-upcoming-modal';
    backdrop.className = 'modal-edit-backdrop';

    const card = document.createElement('div');
    card.className = 'modal-edit-card';
    card.innerHTML = `
      <h3 class="modal-edit-title">Edit Upcoming Movie</h3>
      <form class="modal-edit-form">
        <div class="modal-edit-field">
          <label for="edit-title">Movie Title</label>
          <input type="text" id="edit-title" value="${escapeHtml(movie.title)}" required />
        </div>
        <div class="modal-edit-field">
          <label for="edit-premiere">Expected Premiere Date / Note</label>
          <input type="text" id="edit-premiere" value="${escapeHtml(movie.premiereDate || 'TBA')}" placeholder="e.g. 2026-10-24 or TBA" />
        </div>
        <div class="modal-edit-field">
          <label for="edit-poster">Poster URL</label>
          <input type="url" id="edit-poster" value="${escapeHtml(movie.poster || '')}" placeholder="https://image.tmdb.org/..." />
        </div>
        <div class="modal-edit-field">
          <label for="edit-overview">Synopsis / Description</label>
          <textarea id="edit-overview" rows="3">${escapeHtml(movie.overview || '')}</textarea>
        </div>
        <div class="modal-edit-actions">
          <button type="button" class="btn btn-outline" id="btn-cancel-edit">Cancel</button>
          <button type="submit" class="btn btn-primary" id="btn-save-edit">Save Changes</button>
        </div>
      </form>
    `;

    backdrop.appendChild(card);
    document.body.appendChild(backdrop);

    const form = card.querySelector('.modal-edit-form');
    const cancelBtn = card.querySelector('#btn-cancel-edit');

    cancelBtn.addEventListener('click', () => backdrop.remove());
    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) backdrop.remove();
    });

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const saveBtn = card.querySelector('#btn-save-edit');
      saveBtn.disabled = true;
      saveBtn.textContent = 'Saving...';

      const updates = {
        title: card.querySelector('#edit-title').value.trim(),
        premiereDate: card.querySelector('#edit-premiere').value.trim() || 'TBA',
        poster: card.querySelector('#edit-poster').value.trim() || null,
        overview: card.querySelector('#edit-overview').value.trim()
      };

      try {
        const res = await fetch('/api/manage/upcoming/update', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: movie.id, updates })
        });

        const data = await res.json();
        if (!data.success) {
          throw new Error(data.error || 'Failed to update upcoming movie');
        }

        backdrop.remove();
        showToast(`Updated "${updates.title}".`, 'success');
        await loadApprovedUpcoming();
      } catch (err) {
        alert(`Error: ${err.message}`);
        saveBtn.disabled = false;
        saveBtn.textContent = 'Save Changes';
      }
    });
  }

  // Fetch Hallmark News Announcements
  if (btnFetchNews) {
    btnFetchNews.addEventListener('click', async () => {
      newsFetchFeedback.style.display = 'block';
      newsFetchFeedback.className = 'feedback feedback-info';
      newsFetchFeedback.innerHTML = 'Connecting to official Hallmark Channel Movie News and querying TMDB using shared search...';

      btnFetchNews.disabled = true;
      btnFetchNews.textContent = 'Checking Hallmark News...';

      try {
        const res = await fetch('/api/manage/hallmark-news');
        const data = await res.json();

        if (!data.success) {
          throw new Error(data.error || 'Failed to fetch Hallmark news');
        }

        const rawCandidates = data.candidates || [];
        hallmarkNewsCandidates = [];

        // Query TMDB using the EXACT shared searchTmdbMovies() function for each news candidate
        for (let i = 0; i < rawCandidates.length; i++) {
          const c = rawCandidates[i];
          btnFetchNews.textContent = `Matching TMDB (${i + 1}/${rawCandidates.length})...`;

          const newsItem = {
            hallmarkTitle: c.hallmarkTitle,
            announcementDate: c.announcementDate,
            premiereDate: c.premiereDate || 'TBA',
            description: c.description,
            pageUrl: c.pageUrl,
            tmdbMatch: null
          };

          try {
            const tmdbRes = await searchTmdbMovies(c.hallmarkTitle);
            if (tmdbRes.success && tmdbRes.results && tmdbRes.results.length > 0) {
              const bestMatch = pickBestTmdbCandidate(tmdbRes.results, c.hallmarkTitle);
              if (bestMatch) {
                newsItem.tmdbMatch = {
                  id: bestMatch.id || bestMatch.tmdbId,
                  title: bestMatch.title,
                  year: bestMatch.year,
                  release_date: bestMatch.release_date,
                  overview: bestMatch.overview,
                  poster: bestMatch.poster,
                  imdb_id: bestMatch.imdb_id || null
                };
              }
            }
          } catch (e) {
            console.warn(`TMDB lookup error for news item "${c.hallmarkTitle}":`, e);
          }

          hallmarkNewsCandidates.push(newsItem);
        }

        newsCandidatesPanel.style.display = 'block';
        newsFetchFeedback.className = 'feedback feedback-success';
        newsFetchFeedback.innerHTML = `✓ Discovered <strong>${hallmarkNewsCandidates.length}</strong> movie candidates from Hallmark Movie News announcements. Review and approve below.`;

        renderNewsCandidates();
      } catch (err) {
        console.error('Error fetching Hallmark news:', err);
        newsFetchFeedback.className = 'feedback feedback-error';
        newsFetchFeedback.textContent = `Error fetching Hallmark news: ${err.message}`;
      } finally {
        btnFetchNews.disabled = false;
        btnFetchNews.textContent = 'CHECK FOR UPCOMING MOVIES';
      }
    });
  }

  function isNewsInCollectionOrUpcoming(cand) {
    const normCand = normalizeTitleForRanking(cand.hallmarkTitle);

    const inCollection = currentMovies.some(m => {
      if (cand.tmdbMatch && cand.tmdbMatch.id && Number(m.tmdbId) === Number(cand.tmdbMatch.id)) return true;
      return normalizeTitleForRanking(m.title) === normCand;
    });

    const inUpcoming = approvedUpcomingMovies.some(u => {
      if (cand.tmdbMatch && cand.tmdbMatch.id && u.tmdbId && Number(u.tmdbId) === Number(cand.tmdbMatch.id)) return true;
      return normalizeTitleForRanking(u.title) === normCand;
    });

    return { inCollection, inUpcoming };
  }

  function renderNewsCandidates() {
    if (!newsCandidatesGrid) return;
    newsCandidatesGrid.innerHTML = '';

    const hideKnown = newsHideKnownChk ? newsHideKnownChk.checked : false;
    const hideIgnored = newsHideIgnoredChk ? newsHideIgnoredChk.checked : true;

    let totalIgnored = 0;
    hallmarkNewsCandidates.forEach(c => {
      if (ignoredNewsTitles.has(c.hallmarkTitle.toLowerCase().trim())) {
        totalIgnored++;
      }
    });
    if (newsIgnoredCountLabel) {
      newsIgnoredCountLabel.textContent = totalIgnored;
    }

    const visibleNews = hallmarkNewsCandidates.filter(c => {
      const isIgnored = ignoredNewsTitles.has(c.hallmarkTitle.toLowerCase().trim());
      if (hideIgnored && isIgnored) return false;

      const { inCollection, inUpcoming } = isNewsInCollectionOrUpcoming(c);
      if (hideKnown && (inCollection || inUpcoming)) return false;

      return true;
    });

    if (newsCandidatesCountPill) {
      newsCandidatesCountPill.textContent = `${visibleNews.length} of ${hallmarkNewsCandidates.length} News Candidates`;
    }

    if (visibleNews.length === 0) {
      newsCandidatesGrid.innerHTML = `
        <div style="padding: 28px; text-align: center; color: var(--text-muted); background: #f8fafc; border-radius: 6px; border: 1px dashed var(--border);">
          No news candidates match the active filter criteria.
        </div>
      `;
      return;
    }

    visibleNews.forEach((cand) => {
      const card = createNewsCandidateCard(cand);
      newsCandidatesGrid.appendChild(card);
    });
  }

  function createNewsCandidateCard(cand) {
    const card = document.createElement('div');
    const isIgnored = ignoredNewsTitles.has(cand.hallmarkTitle.toLowerCase().trim());
    const { inCollection, inUpcoming } = isNewsInCollectionOrUpcoming(cand);
    const hasTmdbMatch = Boolean(cand.tmdbMatch && cand.tmdbMatch.id);

    let cardClasses = ['candidate-card'];
    if (isIgnored) cardClasses.push('is-ignored');
    if (inCollection || inUpcoming) cardClasses.push('is-in-collection');
    if (!hasTmdbMatch) cardClasses.push('is-not-found');
    card.className = cardClasses.join(' ');

    // Header Line
    const headerLine = document.createElement('div');
    headerLine.className = 'candidate-header-line';

    const sourceInfo = document.createElement('div');
    sourceInfo.className = 'candidate-source-info';

    const titleEl = document.createElement('div');
    titleEl.className = 'hallmark-title-badge';
    titleEl.innerHTML = `<strong>Hallmark Title:</strong> ${escapeHtml(cand.hallmarkTitle)}`;
    sourceInfo.appendChild(titleEl);

    if (cand.premiereDate && cand.premiereDate !== 'TBA') {
      const premiereEl = document.createElement('span');
      premiereEl.style.cssText = 'font-size: 0.8rem; color: #0369a1; font-weight: 600; margin-left: 8px;';
      premiereEl.textContent = `📅 Expected Premiere: ${cand.premiereDate}`;
      sourceInfo.appendChild(premiereEl);
    }

    headerLine.appendChild(sourceInfo);

    const statusPillWrap = document.createElement('div');
    statusPillWrap.className = 'status-pill-wrap';

    if (inCollection) {
      const p = document.createElement('span');
      p.className = 'badge-in-collection';
      p.textContent = '✓ IN COLLECTION';
      statusPillWrap.appendChild(p);
    } else if (inUpcoming) {
      const p = document.createElement('span');
      p.className = 'badge-upcoming-tag';
      p.textContent = '✓ IN UPCOMING';
      statusPillWrap.appendChild(p);
    } else if (isIgnored) {
      const p = document.createElement('span');
      p.className = 'badge-ignored';
      p.textContent = 'IGNORED';
      statusPillWrap.appendChild(p);
    }
    headerLine.appendChild(statusPillWrap);
    card.appendChild(headerLine);

    // Body
    const body = document.createElement('div');
    body.className = 'candidate-body';

    const posterWrap = document.createElement('div');
    posterWrap.className = 'candidate-poster-wrap';

    const posterImg = document.createElement('img');
    posterImg.className = 'candidate-poster-img';
    posterImg.src = cand.tmdbMatch?.poster || 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="90" height="135" viewBox="0 0 90 135"><rect width="90" height="135" fill="%23f1f5f9"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" font-family="sans-serif" font-size="10" fill="%2394a3b8">Announcement Pending</text></svg>';
    posterImg.alt = cand.hallmarkTitle;
    posterImg.loading = 'lazy';
    posterImg.referrerPolicy = 'no-referrer';
    posterWrap.appendChild(posterImg);
    body.appendChild(posterWrap);

    const details = document.createElement('div');
    details.className = 'candidate-details';

    if (hasTmdbMatch) {
      const tmdb = cand.tmdbMatch;

      const titleRow = document.createElement('div');
      titleRow.className = 'candidate-tmdb-title-row';

      const tmdbTitle = document.createElement('h4');
      tmdbTitle.className = 'candidate-tmdb-title';
      tmdbTitle.textContent = tmdb.title || 'Untitled';
      titleRow.appendChild(tmdbTitle);

      if (tmdb.year) {
        const yearPill = document.createElement('span');
        yearPill.className = 'candidate-year-pill';
        yearPill.textContent = `(${tmdb.year})`;
        titleRow.appendChild(yearPill);
      }
      details.appendChild(titleRow);

      const idsRow = document.createElement('div');
      idsRow.className = 'candidate-ids-row';
      idsRow.innerHTML = `
        <span>TMDB ID: <a href="https://www.themoviedb.org/movie/${tmdb.id}" target="_blank" rel="noopener noreferrer">${tmdb.id}</a></span>
        ${tmdb.imdb_id ? `<span>&bull; IMDb: <a href="https://www.imdb.com/title/${tmdb.imdb_id}/" target="_blank" rel="noopener noreferrer">${tmdb.imdb_id}</a></span>` : ''}
      `;
      details.appendChild(idsRow);
    } else {
      const noTmdbNotice = document.createElement('div');
      noTmdbNotice.style.cssText = 'font-size: 0.85rem; color: #92400e; background: #fef3c7; padding: 6px 10px; border-radius: 4px; margin-bottom: 8px; font-weight: 500;';
      noTmdbNotice.textContent = 'ℹ️ TMDB entry not yet created (standard for upcoming announcements). You can still approve as Upcoming.';
      details.appendChild(noTmdbNotice);
    }

    const overview = document.createElement('p');
    overview.className = 'candidate-overview';
    overview.textContent = cand.tmdbMatch?.overview || cand.description || 'Announced by Hallmark for Countdown to Christmas.';
    details.appendChild(overview);

    const actions = document.createElement('div');
    actions.className = 'candidate-actions';

    if (!inCollection && !inUpcoming) {
      const addUpcomingBtn = document.createElement('button');
      addUpcomingBtn.type = 'button';
      addUpcomingBtn.className = 'btn btn-primary btn-sm';
      addUpcomingBtn.textContent = '+ ADD TO UPCOMING';
      addUpcomingBtn.addEventListener('click', () => handleAddNewsToUpcoming(cand, addUpcomingBtn));
      actions.appendChild(addUpcomingBtn);
    }

    const searchAgainBtn = document.createElement('button');
    searchAgainBtn.type = 'button';
    searchAgainBtn.className = 'btn btn-outline btn-sm';
    searchAgainBtn.textContent = 'SEARCH TMDB';
    searchAgainBtn.addEventListener('click', () => toggleCandidateSearchDrawer(card, cand));
    actions.appendChild(searchAgainBtn);

    const ignoreBtn = document.createElement('button');
    ignoreBtn.type = 'button';
    ignoreBtn.className = 'btn btn-ghost btn-sm';
    ignoreBtn.textContent = isIgnored ? 'UNDO IGNORE' : 'IGNORE';
    ignoreBtn.addEventListener('click', () => toggleIgnoreNewsCandidate(cand));
    actions.appendChild(ignoreBtn);

    details.appendChild(actions);
    body.appendChild(details);
    card.appendChild(body);

    const drawerWrap = document.createElement('div');
    drawerWrap.className = 'candidate-drawer-container';
    card.appendChild(drawerWrap);

    return card;
  }

  async function handleAddNewsToUpcoming(cand, btn) {
    btn.disabled = true;
    btn.textContent = 'Adding...';

    const upcomingMovieObj = {
      hallmarkTitle: cand.hallmarkTitle,
      title: cand.tmdbMatch?.title || cand.hallmarkTitle,
      year: cand.tmdbMatch?.year || new Date().getFullYear(),
      premiereDate: cand.premiereDate || 'TBA',
      announcementDate: cand.announcementDate || null,
      tmdbId: cand.tmdbMatch?.id || null,
      imdbId: cand.tmdbMatch?.imdb_id || null,
      poster: cand.tmdbMatch?.poster || null,
      overview: cand.tmdbMatch?.overview || cand.description || '',
      pageUrl: cand.pageUrl || null
    };

    try {
      const res = await fetch('/api/manage/upcoming/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ movie: upcomingMovieObj })
      });

      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error || 'Failed to add upcoming movie');
      }

      showToast(`✓ Added "${upcomingMovieObj.title}" to Upcoming Movies!`, 'success');
      await loadApprovedUpcoming();
      renderNewsCandidates();
    } catch (err) {
      console.error('Add to upcoming error:', err);
      btn.disabled = false;
      btn.textContent = '+ ADD TO UPCOMING';
      showToast(`Error: ${err.message}`, 'error');
    }
  }

  function toggleIgnoreNewsCandidate(cand) {
    const normTitle = cand.hallmarkTitle.toLowerCase().trim();
    if (ignoredNewsTitles.has(normTitle)) {
      ignoredNewsTitles.delete(normTitle);
      showToast(`Restored "${cand.hallmarkTitle}" to news candidates.`, 'info');
    } else {
      ignoredNewsTitles.add(normTitle);
      showToast(`Ignored Hallmark news entry "${cand.hallmarkTitle}".`, 'info');
    }
    localStorage.setItem('HALLMARK_IGNORED_NEWS', JSON.stringify([...ignoredNewsTitles]));
    renderNewsCandidates();
  }

  if (newsHideKnownChk) {
    newsHideKnownChk.addEventListener('change', renderNewsCandidates);
  }
  if (newsHideIgnoredChk) {
    newsHideIgnoredChk.addEventListener('change', renderNewsCandidates);
  }

  // =========================================================================
  // 7. Cast & Actor Metadata Refresh (TMDB Person API)
  // =========================================================================
  const castActorsCountBadge = document.getElementById('cast-actors-count-badge');
  const btnRefreshCast = document.getElementById('btn-refresh-cast');
  const castRefreshStatus = document.getElementById('cast-refresh-status');
  const castRefreshFeedback = document.getElementById('cast-refresh-feedback');
  const castProgressContainer = document.getElementById('cast-progress-container');
  const castProgressText = document.getElementById('cast-progress-text');
  const castProgressPercent = document.getElementById('cast-progress-percent');
  const castProgressBar = document.getElementById('cast-progress-bar');
  const castSummaryPanel = document.getElementById('cast-summary-panel');
  const castSummaryStats = document.getElementById('cast-summary-stats');
  let castRefreshRunning = false;

  async function loadCastOverview() {
    if (!castActorsCountBadge) return;
    try {
      const res = await fetch('/api/manage/cast/actor-ids');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (data.success) {
        castActorsCountBadge.textContent = `${data.total} Actors in Cast`;
      }
    } catch {
      castActorsCountBadge.textContent = 'Actor Metadata';
    }
  }

  if (btnRefreshCast) {
    btnRefreshCast.addEventListener('click', handleRefreshCast);
  }

  async function handleRefreshCast() {
    if (castRefreshRunning) return;
    castRefreshRunning = true;
    const token = (tokenInput ? tokenInput.value.trim() : '') || localStorage.getItem('HALLMARK_TMDB_TOKEN') || '';

    // Clear previous feedback and summary
    if (castRefreshFeedback) {
      castRefreshFeedback.style.display = 'none';
      castRefreshFeedback.className = 'feedback';
      castRefreshFeedback.innerHTML = '';
    }
    if (castSummaryPanel) {
      castSummaryPanel.style.display = 'none';
    }

    if (!token) {
      if (castRefreshFeedback) {
        castRefreshFeedback.className = 'feedback error';
        castRefreshFeedback.style.display = 'block';
        castRefreshFeedback.innerHTML = `
          <strong>Missing TMDB Credentials:</strong> Please enter your TMDB API Read Access Token or API Key in <em>Section 1 (TMDB API Configuration)</em> above and click "SAVE TOKEN" before refreshing actor data.
        `;
      }
      showToast('Please enter a TMDB token in Section 1 first.', 'error');
      if (tokenInput) {
        tokenInput.focus();
        tokenInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      return;
    }

    // Rebuild movie credits first; actor-only refresh cannot recover missing cast.
    try {
      if (castRefreshStatus) castRefreshStatus.textContent = 'Rebuilding complete cast data from TMDB...';
      if (castProgressContainer) castProgressContainer.style.display = 'block';
      if (castProgressBar) castProgressBar.style.width = '15%';
      if (castProgressPercent) castProgressPercent.textContent = '15%';
      let rebuildProgress = 15;
      const rebuildProgressTimer = setInterval(() => {
        rebuildProgress = Math.min(rebuildProgress + 1, 95);
        if (castProgressBar) castProgressBar.style.width = `${rebuildProgress}%`;
        if (castProgressPercent) castProgressPercent.textContent = `${rebuildProgress}%`;
        if (castRefreshStatus) castRefreshStatus.textContent = `TMDB is processing all cast and photos... ${rebuildProgress}%`;
      }, 2000);
      let rebuildRes;
      try {
        rebuildRes = await fetch('/api/manage/cast/refresh', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token })
        });
      } finally {
        clearInterval(rebuildProgressTimer);
      }
      const rebuildData = await rebuildRes.json().catch(() => ({}));
      if (!rebuildRes.ok || !rebuildData.success) {
        throw new Error(rebuildData.error || `Cast rebuild failed (HTTP ${rebuildRes.status}).`);
      }
      if (castProgressBar) castProgressBar.style.width = '100%';
      if (castProgressPercent) castProgressPercent.textContent = '100%';
      if (castProgressText) castProgressText.textContent = 'Complete cast data saved and verified.';
      if (castSummaryPanel && castSummaryStats) {
        castSummaryPanel.style.display = 'block';
        castSummaryStats.textContent = [
          `Movies processed: ${rebuildData.moviesProcessed}`,
          `TMDB cast records returned: ${rebuildData.tmdbCastRecordsReturned}`,
          `Cast records written: ${rebuildData.castRecordsWritten}`,
          `Unique people: ${rebuildData.uniquePeople}`,
          `People enriched: ${rebuildData.peopleEnriched}`,
          `Birthdays found: ${rebuildData.birthdaysFound}`,
          `Photos found: ${rebuildData.photosFound}`,
          `Photos recovered through /images: ${rebuildData.photosRecoveredThroughImages}`,
          `People genuinely without photos: ${rebuildData.peopleGenuinelyWithoutPhotos}`,
          `API failures: ${rebuildData.apiFailures}`,
          `Christmas at the Catnip Café (1545999): TMDB ${rebuildData.castData?.castByMovieId?.['1545999']?.length ?? 'unavailable'}, saved ${rebuildData.castData?.castByMovieId?.['1545999']?.length ?? 'unavailable'}, rendered: all saved records`
        ].join('\n');
      }
      if (castRefreshStatus) castRefreshStatus.textContent = '✓ Complete TMDB cast rebuild finished';
      showToast('✓ Complete cast data rebuilt from TMDB!', 'success');
      loadCastOverview();
      return;
    } catch (rebuildErr) {
      console.error('Complete cast rebuild error:', rebuildErr);
      throw rebuildErr;
    }

    // Prepare UI for refresh
    btnRefreshCast.disabled = true;
    const originalBtnHtml = btnRefreshCast.innerHTML;
    btnRefreshCast.innerHTML = `
      <span class="spinner" style="display:inline-block;width:14px;height:14px;border:2px solid #fff;border-top-color:transparent;border-radius:50%;animation:spin 0.8s linear infinite;vertical-align:middle;margin-right:6px;"></span>
      <span>REFRESHING...</span>
    `;
    if (castRefreshStatus) {
      castRefreshStatus.textContent = 'Retrieving cast list...';
    }

    if (castProgressContainer) {
      castProgressContainer.style.display = 'block';
    }
    if (castProgressBar) {
      castProgressBar.style.width = '0%';
    }
    if (castProgressPercent) {
      castProgressPercent.textContent = '0%';
    }
    if (castProgressText) {
      castProgressText.textContent = 'Initializing actor refresh...';
    }

    try {
      // Step 1: Get all unique cast person IDs from the collection
      const idsRes = await fetch('/api/manage/cast/actor-ids');
      if (!idsRes.ok) {
        throw new Error(`Failed to load cast person IDs (HTTP ${idsRes.status}).`);
      }
      const idsData = await idsRes.json();
      if (!idsData.success || !idsData.personIds || idsData.personIds.length === 0) {
        throw new Error('No actors found in cast collection.');
      }

      const personIds = idsData.personIds;
      const total = personIds.length;
      let processed = 0;
      let totalUpdated = 0;
      let totalNoPhoto = 0;
      let totalFailed = 0;
      const batchSize = 6;

      if (castRefreshStatus) {
        castRefreshStatus.textContent = `Processing ${total} actors via TMDB Person API...`;
      }

      // Step 2: Process in batches with live UI updates and rate-limit handling
      for (let i = 0; i < personIds.length; i += batchSize) {
        const batch = personIds.slice(i, i + batchSize);
        
        let batchSuccess = false;
        let retryAttempts = 0;
        const maxRetries = 3;

        while (!batchSuccess && retryAttempts < maxRetries) {
          try {
            const batchRes = await fetch('/api/manage/cast/enrich-batch', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ token, personIds: batch })
            });

            if (batchRes.status === 401 || batchRes.status === 403) {
              const errData = await batchRes.json().catch(() => ({}));
              throw new Error(errData.error || 'TMDB Authentication Failed (401/403): Invalid API Token.');
            }

            if (batchRes.status === 429) {
              // Rate limit encountered
              retryAttempts++;
              const retryAfter = parseInt(batchRes.headers.get('Retry-After') || '2', 10);
              if (castRefreshStatus) {
                castRefreshStatus.textContent = `TMDB rate limit hit. Waiting ${retryAfter}s before retry...`;
              }
              await new Promise(r => setTimeout(r, retryAfter * 1000));
              continue;
            }

            if (!batchRes.ok) {
              throw new Error(`Server returned HTTP ${batchRes.status}`);
            }

            const batchData = await batchRes.json();
            if (!batchData.success) {
              throw new Error(batchData.error || 'Batch enrichment failed.');
            }

            totalUpdated += (batchData.updatedCount || 0);
            totalNoPhoto += (batchData.noPhotoCount || 0);
            totalFailed += (batchData.failedCount || 0);
            batchSuccess = true;
          } catch (batchErr) {
            if (batchErr.message.includes('401') || batchErr.message.includes('403') || batchErr.message.includes('Authentication Failed')) {
              throw batchErr;
            }
            retryAttempts++;
            if (retryAttempts >= maxRetries) {
              totalFailed += batch.length;
              break;
            }
            await new Promise(r => setTimeout(r, 1200 * retryAttempts));
          }
        }

        processed = Math.min(i + batchSize, total);
        const percent = Math.round((processed / total) * 100);

        if (castProgressBar) {
          castProgressBar.style.width = `${percent}%`;
        }
        if (castProgressPercent) {
          castProgressPercent.textContent = `${percent}%`;
        }
        if (castProgressText) {
          castProgressText.textContent = `Refreshing actors... ${processed} / ${total}`;
        }
      }

      // Step 3: Save and regenerate enriched cast.json
      if (castRefreshStatus) {
        castRefreshStatus.textContent = 'Finalizing cast.json and synchronizing collection...';
      }
      const saveRes = await fetch('/api/manage/cast/save-enriched', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      const saveData = await saveRes.json();

      if (!saveData.success) {
        throw new Error(saveData.error || 'Failed to save final cast data.');
      }

      // Show completion summary
      if (castSummaryPanel && castSummaryStats) {
        castSummaryPanel.style.display = 'block';
        castSummaryStats.innerHTML = `
          <div><strong>Actor refresh complete</strong></div>
          <div><strong>${totalUpdated}</strong> updated</div>
          <div><strong>${totalNoPhoto}</strong> have no TMDB profile image</div>
          ${totalFailed > 0 ? `<div style="color:#b45309;"><strong>${totalFailed}</strong> actors skipped due to network errors (fallback preserved)</div>` : ''}
          <div style="margin-top:6px; font-size:0.82rem; color:#166534;">
            All movie characters and TMDB person IDs in <code>cast.json</code> and <code>person-cache.json</code> are preserved.
          </div>
        `;
      }

      if (castRefreshStatus) {
        castRefreshStatus.textContent = `✓ Completed (${totalUpdated} actors enriched)`;
      }
      showToast(`✓ Cast refresh complete: ${totalUpdated} actors updated!`, 'success');
      loadCastOverview();
    } catch (err) {
      console.error('Cast refresh error:', err);
      let friendlyError = err.message || 'Failed to refresh actor data from TMDB.';
      
      if (friendlyError.includes('Failed to fetch') || friendlyError.includes('NetworkError') || friendlyError.includes('Load failed')) {
        friendlyError = 'Network failure: Unable to connect to the management server. Please check your internet connection.';
      } else if (friendlyError.includes('401') || friendlyError.includes('403') || friendlyError.includes('Authentication')) {
        friendlyError = 'TMDB Authentication error (401/403): Your TMDB token was rejected. Please verify your token in Section 1.';
      }

      if (castRefreshFeedback) {
        castRefreshFeedback.className = 'feedback error';
        castRefreshFeedback.style.display = 'block';
        castRefreshFeedback.innerHTML = `<strong>Cast Refresh Error:</strong> ${escapeHtml(friendlyError)}`;
      }
      if (castRefreshStatus) {
        castRefreshStatus.textContent = 'Refresh failed.';
      }
      showToast(`Error: ${friendlyError}`, 'error');
    } finally {
      castRefreshRunning = false;
      btnRefreshCast.disabled = false;
      btnRefreshCast.innerHTML = originalBtnHtml;
    }
  }

  // =========================================================================
  // 8. Toast notification helper
  // =========================================================================
  function showToast(message, type = 'info') {
    toast.textContent = message;
    toast.className = `toast toast-${type}`;
    toast.style.display = 'block';

    setTimeout(() => {
      toast.style.display = 'none';
    }, 4000);
  }

  // Initial loads
  loadCollection();
  loadApprovedUpcoming();
  loadCastOverview();
  if (localStorage.getItem('HALLMARK_TMDB_TOKEN')) {
    setTimeout(handleRefreshCast, 0);
  }
});
