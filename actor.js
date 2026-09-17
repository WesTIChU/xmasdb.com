/**
 * Actor Page Script - XmasDB.com
 * 
 * Loads actor profile metadata and renders their complete Hallmark Christmas filmography.
 */

import { calculateActorAge, getActorProfileImageUrl, PLACEHOLDER_ACTOR_PHOTO } from './actor-utils.js';
import { updateLayoutCounts } from './js/site-layout.js';
import { getMovieUrl } from './movie-url.js';

document.addEventListener('DOMContentLoaded', () => {
  const params = new URLSearchParams(window.location.search);
  const prettyPathMatch = window.location.pathname.match(/^\/actor\/([0-9]+)(?:\/[^/?#]+)?/);
  const rawActorParam = (prettyPathMatch?.[1] || params.get('id') || params.get('actor') || params.get('name') || '').trim();

  // DOM Elements
  const loadingEl = document.getElementById('actor-loading');
  const errorEl = document.getElementById('actor-error');
  const errorMsgEl = document.getElementById('actor-error-msg');
  const contentEl = document.getElementById('actor-content');
  const backLink = document.getElementById('actor-back-link');

  const nameEl = document.getElementById('actor-name');
  const photoEl = document.getElementById('actor-profile-photo');
  const deptBadge = document.getElementById('actor-dept-badge');
  const countBadge = document.getElementById('actor-movie-count-badge');
  const bioMetaRow = document.getElementById('actor-bio-meta-row');
  const biographyWrap = document.getElementById('actor-biography-wrap');
  const biographyEl = document.getElementById('actor-biography');
  const bioToggleBtn = document.getElementById('btn-bio-toggle');
  const tmdbLink = document.getElementById('actor-tmdb-link');
  const jsonLink = document.getElementById('actor-json-link');
  const imdbLink = document.getElementById('actor-imdb-link');

  const filmographyGrid = document.getElementById('actor-filmography-grid');
  const filmographySubheading = document.getElementById('filmography-subheading');
  let allMovies = [];

  // Configure back link
  if (backLink) {
    if (document.referrer && (document.referrer.includes('movie.html') || document.referrer.includes('/movie/'))) {
      backLink.innerHTML = '&larr; Back to Movie';
      backLink.href = document.referrer;
    } else if (document.referrer && (document.referrer.includes('/') || document.referrer.includes('index.html'))) {
      backLink.innerHTML = '&larr; Back to Catalog';
      backLink.href = document.referrer;
    } else {
      backLink.innerHTML = '&larr; Back to Catalog';
      backLink.href = './';
    }
  }

  if (!rawActorParam) {
    showError('No actor specified. Please select a cast member from a movie or catalog search.');
    return;
  }

  loadActorData(rawActorParam);

  async function loadActorData(actorParam) {
    try {
      // 1. Fetch movies and cast data in parallel
      const [moviesRes, castRes, cacheRes] = await Promise.all([
        fetch('/movies.json').then(r => r.ok ? r.json() : []),
        fetch('/cast.json').then(r => r.ok ? r.json() : null).catch(() => null),
        fetch('/person-cache.json').then(r => r.ok ? r.json() : {}).catch(() => ({}))
      ]);

       allMovies = Array.isArray(moviesRes) ? moviesRes : [];
      const castData = castRes || { actors: [], castByMovieId: {}, movieCast: {} };
      const personCache = cacheRes || {};

      // Update total movie count in header and footer
      updateLayoutCounts(allMovies.length);

      // 2. Identify target actor
      const numericId = Number(actorParam);
      let actor = null;

      // Match by TMDB person ID
      if (!isNaN(numericId) && numericId > 0) {
        if (Array.isArray(castData.actors)) {
          actor = castData.actors.find(a => Number(a.id) === numericId);
        }
        if (!actor && personCache[String(numericId)]) {
          actor = personCache[String(numericId)];
        }
      }

      // Match by Name if not found
      if (!actor) {
        const normSearch = actorParam.toLowerCase().trim();
        if (Array.isArray(castData.actors)) {
          actor = castData.actors.find(a => a.name && a.name.toLowerCase().trim() === normSearch);
        }
        if (!actor) {
          // Check personCache
          const cacheMatch = Object.values(personCache).find(p => p && p.name && p.name.toLowerCase().trim() === normSearch);
          if (cacheMatch) {
            actor = cacheMatch;
          }
        }
      }

      // Search movie cast lists directly as fallback
      if (!actor) {
        for (const m of allMovies) {
          const tmdbId = String(m.tmdbId || m.tmdb_id);
          const movieCast = castData.castByMovieId?.[tmdbId] || castData.movieCast?.[tmdbId] || m.cast;
          if (Array.isArray(movieCast)) {
            const match = movieCast.find(c => 
              (numericId > 0 && Number(c.id) === numericId) ||
              (c.name && c.name.toLowerCase().trim() === actorParam.toLowerCase().trim())
            );
            if (match) {
              actor = {
                id: match.id,
                name: match.name,
                profile_path: match.profile_path,
                birthday: match.birthday || null,
                deathday: match.deathday || null,
                known_for_department: match.known_for_department || 'Acting'
              };
              break;
            }
          }
        }
      }

      // A numeric TMDB ID is authoritative even when a static aggregate file is stale.
      if (!actor && numericId > 0) {
        actor = {
          id: numericId,
          name: personCache[String(numericId)]?.name || `TMDB Person ${numericId}`,
          profile_path: personCache[String(numericId)]?.profile_path || null,
          birthday: personCache[String(numericId)]?.birthday || null,
          deathday: personCache[String(numericId)]?.deathday || null,
          known_for_department: 'Acting'
        };
      }

      if (!actor) {
        showError(`Could not find an actor matching "${actorParam}" in the Hallmark Christmas collection.`);
        return;
      }

      // Check if personCache has richer info (e.g. biography, place_of_birth, imdb_id)
      const cachedPerson = actor.id && personCache[String(actor.id)];
      if (cachedPerson) {
        actor = { ...cachedPerson, ...actor };
      }

      // 3. Find all movies in our collection featuring this actor
      const actorId = actor.id ? Number(actor.id) : null;
      const actorNameLower = (actor.name || '').toLowerCase().trim();

      const matchedMovies = allMovies.filter(movie => {
        const tmdbId = String(movie.tmdbId || movie.tmdb_id);
        const movieCast = (castData.castByMovieId && castData.castByMovieId[tmdbId]) ||
                          (castData.movieCast && castData.movieCast[tmdbId]) ||
                          (Array.isArray(movie.cast) ? movie.cast : []);

        return movieCast.some(c => {
          if (actorId && c.id) return Number(c.id) === actorId;
          if (c.name && c.name.toLowerCase().trim() === actorNameLower) return true;
          return false;
        });
      });

      // Sort movies descending by year
      matchedMovies.sort((a, b) => {
        const yearA = parseInt(a.year || '0', 10) || 0;
        const yearB = parseInt(b.year || '0', 10) || 0;
        return yearB - yearA;
      });

      // 4. Render Actor Profile
      renderActorProfile(actor, matchedMovies.length, castData);
      renderTmdbCredits(actor.tmdbCredits || []);

      // 5. Render Filmography Grid
      renderFilmography(actor, matchedMovies, castData);

       // Show content
      if (loadingEl) loadingEl.style.display = 'none';
      if (errorEl) errorEl.style.display = 'none';
      if (contentEl) contentEl.style.display = 'block';

    } catch (err) {
      console.error('Failed to load actor data:', err);
      showError('An error occurred while loading actor details. Please try again.');
    }
  }

  function renderActorProfile(actor, movieCount, castData) {
    const actorName = actor.name || 'Hallmark Christmas Actor';
    
    // Page Title & Meta
    document.title = `${actorName} - XmasDB.com`;
    const metaDesc = document.getElementById('meta-description');
    if (metaDesc) {
      metaDesc.setAttribute('content', `Explore ${actorName}'s Hallmark Christmas movies, biographical details, and filmography.`);
    }

    // Name
    if (nameEl) nameEl.textContent = actorName;

    // Profile Photo
    if (photoEl) {
      photoEl.alt = `${actorName} Profile`;
       photoEl.src = getActorProfileImageUrl(actor.profile || actor.profile_path, 'h632');
      photoEl.onerror = function() {
        this.onerror = null;
        this.src = PLACEHOLDER_ACTOR_PHOTO;
      };
    }

    if (jsonLink && actor.id) {
      jsonLink.href = `/json/actors/${encodeURIComponent(actor.id)}.json`;
      jsonLink.title = `Hallmark Christmas movies in this collection featuring ${actorName}`;
      jsonLink.style.display = 'inline-flex';
    }

    // Badges
    if (deptBadge) {
      deptBadge.textContent = actor.known_for_department || 'Acting';
    }
    if (countBadge) {
      const countText = `${movieCount} Hallmark Christmas ${movieCount === 1 ? 'Movie' : 'Movies'}`;
      countBadge.textContent = countText;
    }

    // Bio Meta Row (Born, Died, Dynamic Age, Place of Birth)
    if (bioMetaRow) {
      bioMetaRow.innerHTML = '';
      const ageInfo = calculateActorAge(actor.birthday, actor.deathday);

      if (ageInfo) {
        const bornItem = document.createElement('div');
        bornItem.className = 'actor-bio-meta-item';
        bornItem.innerHTML = `<strong>Born:</strong> <span>${escapeHtml(ageInfo.birthdayStr)}</span>`;
        bioMetaRow.appendChild(bornItem);

        if (ageInfo.isDeceased) {
          const diedItem = document.createElement('div');
          diedItem.className = 'actor-bio-meta-item';
          diedItem.innerHTML = `<strong>Died:</strong> <span>${escapeHtml(ageInfo.deathdayStr || '')}</span>`;
          bioMetaRow.appendChild(diedItem);

          const ageItem = document.createElement('div');
          ageItem.className = 'actor-bio-meta-item';
          ageItem.innerHTML = `<span class="actor-bio-age-highlight">Aged ${ageInfo.age}</span>`;
          bioMetaRow.appendChild(ageItem);
        } else {
          const ageItem = document.createElement('div');
          ageItem.className = 'actor-bio-meta-item';
          ageItem.innerHTML = `<span class="actor-bio-age-highlight">Age ${ageInfo.age}</span>`;
          bioMetaRow.appendChild(ageItem);
        }
      }

      if (actor.place_of_birth) {
        const placeItem = document.createElement('div');
        placeItem.className = 'actor-bio-meta-item';
        placeItem.innerHTML = `<strong>Birthplace:</strong> <span>${escapeHtml(actor.place_of_birth)}</span>`;
        bioMetaRow.appendChild(placeItem);
      }
    }

    // Biography
    if (actor.biography && actor.biography.trim()) {
      if (biographyWrap) biographyWrap.style.display = 'block';
      if (biographyEl) biographyEl.textContent = actor.biography.trim();
      
      // If biography is long, show expand/collapse button
      if (bioToggleBtn && actor.biography.length > 280) {
        bioToggleBtn.style.display = 'inline-block';
        bioToggleBtn.onclick = () => {
          const isExpanded = biographyEl?.classList.toggle('expanded');
          bioToggleBtn.textContent = isExpanded ? 'Show less' : 'Read more';
        };
      }
    } else {
      if (biographyWrap) biographyWrap.style.display = 'none';
    }

    // External Links
    if (actor.id && tmdbLink) {
      tmdbLink.href = `https://www.themoviedb.org/person/${actor.id}`;
      tmdbLink.style.display = 'inline-flex';
    }

    if (actor.imdb_id && imdbLink) {
      imdbLink.href = `https://www.imdb.com/name/${actor.imdb_id}/`;
      imdbLink.style.display = 'inline-flex';
    }

    // Update Schema JSON-LD
    const schemaEl = document.getElementById('actor-schema');
    if (schemaEl) {
      const schemaData = {
        '@context': 'https://schema.org',
        '@type': 'Person',
        'name': actorName,
        'url': window.location.href,
        'image': getActorProfileImageUrl(actor.profile_path, 'h632'),
        'jobTitle': actor.known_for_department || 'Actor',
        ...(actor.birthday ? { 'birthDate': actor.birthday } : {}),
        ...(actor.deathday ? { 'deathDate': actor.deathday } : {})
      };
      schemaEl.textContent = JSON.stringify(schemaData);
    }
  }

  function renderFilmography(actor, movies, castData) {
    if (!filmographyGrid) return;
    filmographyGrid.innerHTML = '';

    const actorId = actor.id ? Number(actor.id) : null;
    const actorNameLower = (actor.name || '').toLowerCase().trim();

    if (filmographySubheading) {
      filmographySubheading.textContent = `Showing all ${movies.length} ${movies.length === 1 ? 'movie' : 'movies'} starring ${actor.name} in this collection`;
    }

    if (movies.length === 0) {
      filmographyGrid.innerHTML = `
        <div style="grid-column: 1 / -1; padding: 32px; text-align: center; color: var(--text-muted, #64748b);">
          No Hallmark Christmas movies found in this collection starring ${escapeHtml(actor.name)}.
        </div>
      `;
      return;
    }

    movies.forEach(movie => {
      const tmdbId = String(movie.tmdbId || movie.tmdb_id);
      const movieCast = (castData.castByMovieId && castData.castByMovieId[tmdbId]) ||
                        (castData.movieCast && castData.movieCast[tmdbId]) ||
                        (Array.isArray(movie.cast) ? movie.cast : []);

      // Find character played by this actor in this movie
      const castEntry = movieCast.find(c => 
        (actorId && Number(c.id) === actorId) ||
        (c.name && c.name.toLowerCase().trim() === actorNameLower)
      );

      const characterName = castEntry?.character ? castEntry.character.trim() : '';

      // Movie Card Element
      const card = document.createElement('a');
      card.className = 'filmography-movie-card';
      card.href = getMovieUrl(movie);
      card.title = `View details for ${movie.title} (${movie.year || ''})`;

      // Poster Container
      const posterWrap = document.createElement('div');
      posterWrap.className = 'filmography-movie-poster-wrap';

      const posterImg = document.createElement('img');
      posterImg.className = 'filmography-movie-poster';
      posterImg.alt = movie.title || 'Movie Poster';
      posterImg.loading = 'lazy';
      posterImg.src = movie.poster || 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="200" height="300" viewBox="0 0 200 300"><rect width="200" height="300" fill="%23f1f5f9"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" font-family="sans-serif" font-size="14" fill="%2394a3b8">No Poster</text></svg>';
      posterImg.onerror = function() {
        this.onerror = null;
        this.src = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="200" height="300" viewBox="0 0 200 300"><rect width="200" height="300" fill="%23f1f5f9"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" font-family="sans-serif" font-size="14" fill="%2394a3b8">No Poster</text></svg>';
      };

      posterWrap.appendChild(posterImg);

      if (movie.year) {
        const yearBadge = document.createElement('span');
        yearBadge.className = 'filmography-year-badge';
        yearBadge.textContent = String(movie.year);
        posterWrap.appendChild(yearBadge);
      }

      if (movie.rating && parseFloat(movie.rating) > 0) {
        const ratingBadge = document.createElement('span');
        ratingBadge.className = 'filmography-rating-badge';
        ratingBadge.innerHTML = `&#9733; ${parseFloat(movie.rating).toFixed(1)}`;
        posterWrap.appendChild(ratingBadge);
      }

      // Info Container
      const infoWrap = document.createElement('div');
      infoWrap.className = 'filmography-movie-info';

      const titleEl = document.createElement('div');
      titleEl.className = 'filmography-movie-title';
      titleEl.textContent = movie.title;
      infoWrap.appendChild(titleEl);

      if (characterName) {
        const charEl = document.createElement('div');
        charEl.className = 'filmography-movie-character';
        charEl.innerHTML = `<span class="filmography-movie-character-label">as</span> ${escapeHtml(characterName)}`;
        infoWrap.appendChild(charEl);
      }

      if (movie.overview) {
        const overviewEl = document.createElement('div');
        overviewEl.className = 'filmography-movie-overview';
        overviewEl.textContent = movie.overview;
        infoWrap.appendChild(overviewEl);
      }

      card.appendChild(posterWrap);
      card.appendChild(infoWrap);

      filmographyGrid.appendChild(card);
    });
  }

  async function fetchExtraDetailsIfNeeded(actor) {
    if (!actor.id) return;
    
    try {
      const token = localStorage.getItem('HALLMARK_TMDB_TOKEN') || '';
      const res = await fetch(`/api/actor-details?id=${actor.id}&token=${encodeURIComponent(token)}`);
      if (!res.ok) {
        renderTmdbCredits(await fetchDirectTmdbCredits(actor.id, token));
        return;
      }

      const data = await res.json();
       if (data.success && data.actor) {
         let fresh = data.actor;
         if (!Array.isArray(fresh.tmdbCredits) || fresh.tmdbCredits.length === 0) {
           const directCredits = await fetchDirectTmdbCredits(actor.id, token);
           if (directCredits.length > 0) fresh = { ...fresh, tmdbCredits: directCredits };
         }
        
        // Update Bio if freshly available
        if (fresh.biography && (!actor.biography || actor.biography.length < fresh.biography.length)) {
          if (biographyWrap) biographyWrap.style.display = 'block';
          if (biographyEl) biographyEl.textContent = fresh.biography.trim();
          if (bioToggleBtn && fresh.biography.length > 280) {
            bioToggleBtn.style.display = 'inline-block';
            bioToggleBtn.onclick = () => {
              const isExpanded = biographyEl?.classList.toggle('expanded');
              bioToggleBtn.textContent = isExpanded ? 'Show less' : 'Read more';
            };
          }
        }

        // Update IMDb link if freshly available
        if (fresh.imdb_id && imdbLink) {
          imdbLink.href = `https://www.imdb.com/name/${fresh.imdb_id}/`;
          imdbLink.style.display = 'inline-flex';
        }

        // Update Birthplace if freshly available
        if (fresh.place_of_birth && bioMetaRow && !actor.place_of_birth) {
          const placeItem = document.createElement('div');
          placeItem.className = 'actor-bio-meta-item';
          placeItem.innerHTML = `<strong>Birthplace:</strong> <span>${escapeHtml(fresh.place_of_birth)}</span>`;
          bioMetaRow.appendChild(placeItem);
        }

        const actingYears = [...new Set((fresh.tmdbActingCredits || []).map(credit => Number(credit.year)).filter(year => Number.isInteger(year)))].sort((a, b) => a - b);
        if (actingYears.length > 0 && bioMetaRow && !bioMetaRow.querySelector('[data-tmdb-acting-history]')) {
          const actingItem = document.createElement('div');
          actingItem.className = 'actor-bio-meta-item';
          actingItem.dataset.tmdbActingHistory = 'true';
          const yearText = actingYears.length === 1
            ? String(actingYears[0])
            : `${actingYears[0]}-${actingYears[actingYears.length - 1]}`;
          actingItem.innerHTML = `<strong>TMDB Acting:</strong> <span>${escapeHtml(yearText)} (${actingYears.length} movies)</span>`;
          bioMetaRow.appendChild(actingItem);
        }
        const tmdbCredits = Array.isArray(fresh.tmdbCredits)
          ? fresh.tmdbCredits
          : (fresh.tmdbActingCredits || []).map(credit => ({
            ...credit,
            department: 'Acting',
            mediaType: 'movie'
          }));
        renderTmdbCredits(tmdbCredits);
      }
    } catch {
      // Background enrichment error is non-fatal
    }
  }

  function renderTmdbCredits(credits) {
    if (!Array.isArray(credits) || credits.length === 0 || !filmographyGrid?.parentElement) return;
    const existing = document.getElementById('tmdb-credit-history');
    if (existing) existing.remove();

    const section = document.createElement('section');
    section.id = 'tmdb-credit-history';
    section.className = 'tmdb-credit-history';
    section.setAttribute('aria-label', 'TMDB credit history');
    const heading = document.createElement('h2');
    heading.className = 'tmdb-credit-history-title';
    heading.textContent = 'TMDB Credit History';
    section.appendChild(heading);

    for (const department of ['Acting', 'Writing']) {
      const entries = credits
        .filter(credit => credit.department === department)
        .sort((a, b) => b.year - a.year || a.title.localeCompare(b.title));
      if (entries.length === 0) continue;

      const departmentHeading = document.createElement('h3');
      departmentHeading.className = 'tmdb-credit-department';
      departmentHeading.textContent = department;
      section.appendChild(departmentHeading);
      const list = document.createElement('ul');
      list.className = 'tmdb-credit-list';
      for (const credit of entries) {
        const item = document.createElement('li');
        item.className = 'tmdb-credit-row';
        const year = document.createElement('strong');
        year.className = 'tmdb-credit-year';
        year.textContent = `${credit.year} `;
        item.appendChild(year);
        const title = document.createElement('span');
        title.className = 'tmdb-credit-title';
        const siteMovie = allMovies.find(movie => Number(movie.tmdbId || movie.tmdb_id) === Number(credit.id));
        if (siteMovie) {
          const movieLink = document.createElement('a');
          movieLink.href = getMovieUrl(siteMovie);
          movieLink.textContent = credit.title;
          movieLink.title = `View ${siteMovie.title}`;
          title.appendChild(movieLink);
        } else {
          title.textContent = credit.title;
        }
        item.appendChild(title);
        if (credit.episodes) {
          const episodes = document.createElement('span');
          episodes.className = 'tmdb-credit-episodes';
          episodes.textContent = `${credit.episodes} ${credit.episodes === 1 ? 'episode' : 'episodes'}`;
          item.appendChild(episodes);
        }
        if (credit.role) {
          const role = document.createElement('span');
          role.className = 'tmdb-credit-role';
          role.textContent = `as ${credit.role}`;
          item.appendChild(role);
        }
        list.appendChild(item);
      }
      section.appendChild(list);
    }
    filmographyGrid.parentElement.after(section);
  }

  async function fetchDirectTmdbCredits(personId, token) {
    if (!token || !/^\d+$/.test(String(personId))) return [];
    try {
      const url = new URL(`https://api.themoviedb.org/3/person/${personId}/combined_credits`);
      const headers = { Accept: 'application/json' };
      if (token.length > 40 || token.startsWith('ey')) {
        headers.Authorization = `Bearer ${token}`;
      } else {
        url.searchParams.set('api_key', token);
      }
      const response = await fetch(url, { headers });
      if (!response.ok) return [];
      const data = await response.json();
      return [
        ...(data.cast || []).map(credit => ({
          id: credit.id,
          department: 'Acting',
          year: Number((credit.release_date || credit.first_air_date || '').slice(0, 4)),
          title: credit.title || credit.name || credit.original_title || credit.original_name || '',
          role: credit.character || '',
          episodes: credit.episode_count || null,
          mediaType: credit.media_type || 'movie'
        })),
        ...(data.crew || [])
          .filter(credit => credit.department === 'Writing' || credit.job === 'Writer' || credit.job === 'Story')
          .map(credit => ({
            id: credit.id,
            department: 'Writing',
            year: Number((credit.release_date || credit.first_air_date || '').slice(0, 4)),
            title: credit.title || credit.name || credit.original_title || credit.original_name || '',
            role: credit.job || '',
            episodes: credit.episode_count || null,
            mediaType: credit.media_type || 'movie'
          }))
      ].filter(credit => Number.isInteger(credit.year) && credit.year > 1800 && credit.title);
    } catch {
      return [];
    }
  }

  function showError(message) {
    if (loadingEl) loadingEl.style.display = 'none';
    if (contentEl) contentEl.style.display = 'none';
    if (errorEl) {
      errorEl.style.display = 'block';
      if (errorMsgEl) errorMsgEl.textContent = message;
    }
  }

  function escapeHtml(str) {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

});
