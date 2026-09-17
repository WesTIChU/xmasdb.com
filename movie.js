/**
 * Movie Details Page Client Logic
 * Loads comprehensive movie metadata, cast with dynamic age calculation,
 * and handles clickable cast cards with collection filtering.
 */

import { calculateActorAge, formatCastCardSubtitle, getActorProfileImageUrl, PLACEHOLDER_ACTOR_PHOTO } from './actor-utils.js';
import { getActorUrl, getMovieUrl } from './movie-url.js';

document.addEventListener('DOMContentLoaded', async () => {
  const params = new URLSearchParams(window.location.search);
  const searchId = params.get('id');
  const initialActorId = params.get('actor');

  // Extract movieId and slug from either /movie/{id}/{slug} or ?id={id}
  let movieId = null;
  const pathMatch = window.location.pathname.match(/^\/movie\/([0-9]+)(?:\/([^/?#]+))?/);
  if (pathMatch) {
    movieId = pathMatch[1];
  } else {
    movieId = searchId;
  }

  const loadingEl = document.getElementById('movie-loading');
  const errorEl = document.getElementById('movie-error');
  const errorMsg = document.getElementById('movie-error-msg');
  const contentEl = document.getElementById('movie-content');
  const backLink = document.getElementById('back-link');

  let allMovies = [];
  let castData = null;
  let currentMovie = null;

  // Preserve referrer year if navigated from catalog
  if (document.referrer && document.referrer.includes('year=')) {
    try {
      const refUrl = new URL(document.referrer);
      const year = refUrl.searchParams.get('year');
      if (year) {
        backLink.href = `./?year=${encodeURIComponent(year)}`;
        backLink.innerHTML = `&larr; Back to ${year} Movies`;
      }
    } catch {
      // keep default
    }
  }

  if (!movieId && !initialActorId) {
    loadingEl.style.display = 'none';
    errorEl.style.display = 'block';
    errorMsg.textContent = 'No movie ID specified in URL.';
    return;
  }

  try {
    // 1. Fetch static datasets (movies.json and cast.json) in parallel
    const [moviesRes, castRes] = await Promise.all([
      fetch('/movies.json').then(r => r.ok ? r.json() : []),
      fetch('/cast.json').then(r => r.ok ? r.json() : null)
    ]);

    allMovies = Array.isArray(moviesRes) ? moviesRes : [];
    castData = castRes || { actors: [], castByMovieId: {}, movieCast: {} };

    // Find movie in our collection
    const matchedMovie = allMovies.find(m => 
      String(m.tmdbId) === String(movieId) || 
      String(m.tmdb_id) === String(movieId) || 
      (m.title && m.title.toLowerCase() === decodeURIComponent(movieId || '').toLowerCase())
    );

    // Public pages use the locally generated catalog only. TMDB is private ingestion data.
    let movieData = null;
    if (!movieData && matchedMovie) {
      movieData = {
        id: matchedMovie.tmdbId || matchedMovie.tmdb_id,
        title: matchedMovie.title,
        originalTitle: matchedMovie.originalTitle || matchedMovie.original_title,
        year: matchedMovie.year,
        overview: matchedMovie.overview,
        poster: matchedMovie.poster,
        vote_average: matchedMovie.vote_average,
        vote_count: matchedMovie.vote_count,
        imdb_id: matchedMovie.imdbId || matchedMovie.imdb_id,
        cast: [],
        crew: [],
        genres: [{ name: 'Holiday' }, { name: 'Romance' }]
      };
    } else if (movieData && matchedMovie) {
      // Ensure originalTitle from collection is preserved
      if (!movieData.originalTitle && matchedMovie.originalTitle) {
        movieData.originalTitle = matchedMovie.originalTitle;
      }
    }

    if (!movieData && !initialActorId) {
      loadingEl.style.display = 'none';
      errorEl.style.display = 'block';
      errorMsg.textContent = `Could not find movie details for ID "${movieId}".`;
      return;
    }

    currentMovie = movieData || matchedMovie;

    // Attach rich cast from cast.json to ensure TMDB person IDs, birthdays, deathdays, and profile paths
    const effectiveTmdbId = String(currentMovie ? (currentMovie.tmdbId || currentMovie.id || currentMovie.tmdb_id) : '');
    const canonicalCast = (castData && castData.castByMovieId && castData.castByMovieId[effectiveTmdbId])
      || (castData && castData.movieCast && castData.movieCast[effectiveTmdbId])
      || [];

    const existingCast = Array.isArray(currentMovie.cast) ? currentMovie.cast : [];
    const existingCastMap = new Map();
    existingCast.forEach(c => {
      if (c.id) existingCastMap.set(Number(c.id), c);
      if (c.name) existingCastMap.set(c.name.toLowerCase().trim(), c);
    });

    if (canonicalCast.length > 0) {
      currentMovie.cast = canonicalCast.map(actor => {
        const fromExisting = (actor.id && existingCastMap.get(Number(actor.id))) ||
                             (actor.name && existingCastMap.get(actor.name.toLowerCase().trim()));
        const profilePath = actor.profile_path || (fromExisting && fromExisting.profile_path) || null;
        return {
          ...actor,
          profile_path: profilePath
        };
      });
    } else if (existingCast.length > 0) {
      currentMovie.cast = existingCast;
    } else {
      currentMovie.cast = [];
    }

    if (currentMovie) {
      renderMovieDetails(currentMovie);
    }

    // Handle initial actor parameter in URL (e.g. ?actor=84224)
    if (initialActorId) {
       const initialActor = castData?.actors?.find(actor => Number(actor.id) === Number(initialActorId)) || { id: initialActorId, name: '' };
       window.location.replace(getActorUrl(initialActor));
      return;
    }
  } catch (err) {
    console.error('Fatal error loading movie details:', err);
    loadingEl.style.display = 'none';
    errorEl.style.display = 'block';
    errorMsg.textContent = err.message || 'An unexpected error occurred.';
  }

  // =========================================================================
  // Render Movie Details
  // =========================================================================
  function renderMovieDetails(m) {
    document.title = `${m.title} (${m.year || ''}) – Cast & Movie Details | XmasDB.com`;

    // Title & Tagline
    document.getElementById('detail-title').textContent = m.title || 'Untitled';
    
    // Original Title Handling
    const origTitleEl = document.getElementById('detail-original-title');
    const origTitleText = document.getElementById('detail-original-title-text');
    const orig = (m.originalTitle || m.original_title || '').trim();
    if (orig && orig.toLowerCase() !== (m.title || '').trim().toLowerCase()) {
      origTitleText.textContent = orig;
      origTitleEl.style.display = 'block';
    } else {
      origTitleEl.style.display = 'none';
    }

    const taglineEl = document.getElementById('detail-tagline');
    if (m.tagline) {
      taglineEl.textContent = `"${m.tagline}"`;
      taglineEl.style.display = 'block';
    } else {
      taglineEl.style.display = 'none';
    }

    // Backdrop
    const backdropEl = document.getElementById('movie-backdrop');
    if (m.backdrop) {
      backdropEl.style.backgroundImage = `url(${m.backdrop})`;
    } else if (m.poster) {
      backdropEl.style.backgroundImage = `url(${m.poster})`;
    }

    // Poster
    const posterEl = document.getElementById('detail-poster');
    posterEl.src = m.poster || 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="300" height="450" viewBox="0 0 300 450"><rect width="300" height="450" fill="%23e5e5e5"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" font-family="sans-serif" font-size="16" fill="%23888888">No Poster Available</text></svg>';
    posterEl.alt = `${m.title} Poster`;

    // Update Canonical URL and Address Bar
    const effectiveTmdbId = String(m.tmdbId || m.id || m.tmdb_id || '');
    const prettyPath = getMovieUrl({ ...m, tmdbId: effectiveTmdbId });
    const canonicalFullUrl = `https://xmasdb.com${prettyPath}`;

    if (window.location.pathname !== prettyPath) {
      window.history.replaceState(null, '', prettyPath);
    }

    let canonicalLink = document.querySelector('link[rel="canonical"]');
    if (!canonicalLink) {
      canonicalLink = document.createElement('link');
      canonicalLink.setAttribute('rel', 'canonical');
      document.head.appendChild(canonicalLink);
    }
    canonicalLink.setAttribute('href', canonicalFullUrl);

    // Update Open Graph / Twitter Meta Tags
    updateMetaTag('og:title', `${m.title} (${m.year || ''}) - XmasDB.com`);
    updateMetaTag('og:description', m.overview || 'Hallmark Christmas movie details and cast.');
    updateMetaTag('og:url', canonicalFullUrl);
    if (m.poster) updateMetaTag('og:image', m.poster);
    updateMetaTag('twitter:title', `${m.title} (${m.year || ''})`);
    updateMetaTag('twitter:description', m.overview || 'Hallmark Christmas movie details and cast.');

    // Badges: Year, Runtime, Rating, Release Date
    const yearEl = document.getElementById('detail-year');
    if (m.year) {
      yearEl.textContent = m.year;
      yearEl.style.display = 'inline-flex';
    } else {
      yearEl.style.display = 'none';
    }

    const runtimeEl = document.getElementById('detail-runtime');
    if (m.runtime) {
      const hrs = Math.floor(m.runtime / 60);
      const mins = m.runtime % 60;
      runtimeEl.textContent = hrs > 0 ? `${hrs}h ${mins}m` : `${mins}m`;
      runtimeEl.style.display = 'inline-flex';
    } else {
      runtimeEl.style.display = 'none';
    }

    const ratingEl = document.getElementById('detail-rating');
    if (Number.isFinite(Number(m.vote_average)) && Number(m.vote_average) > 0) {
      ratingEl.textContent = `★ ${Number(m.vote_average).toFixed(1)} / 10 on TMDB`;
      ratingEl.style.display = 'inline-flex';
    } else {
      ratingEl.style.display = 'none';
    }

    const releaseEl = document.getElementById('detail-release');
    if (m.release_date) {
      releaseEl.textContent = `Premiered: ${m.release_date}`;
      releaseEl.style.display = 'inline-flex';
    } else {
      releaseEl.style.display = 'none';
    }

    // Genres
    const genresEl = document.getElementById('detail-genres');
    genresEl.innerHTML = '';
    if (m.genres && m.genres.length > 0) {
      m.genres.forEach(g => {
        const pill = document.createElement('span');
        pill.className = 'genre-pill';
        pill.textContent = g.name;
        genresEl.appendChild(pill);
      });
    }

    // Synopsis
    document.getElementById('detail-overview').textContent = m.overview || 'No synopsis available for this Hallmark movie.';

    // External Links
    const imdbBtn = document.getElementById('detail-imdb-link');
    if (m.imdb_id) {
      imdbBtn.href = `https://www.imdb.com/title/${m.imdb_id}/`;
      imdbBtn.style.display = 'inline-flex';
    } else {
      imdbBtn.style.display = 'none';
    }

    const tmdbBtn = document.getElementById('detail-tmdb-link');
    const tmdbId = m.tmdbId || m.id;
    if (tmdbId) {
      tmdbBtn.href = `https://www.themoviedb.org/movie/${tmdbId}`;
      tmdbBtn.style.display = 'inline-flex';
    } else {
      tmdbBtn.style.display = 'none';
    }

    // Render Clickable Cast Cards with Dynamic Age
    renderCastGrid(m.cast || []);

    // Crew Section
    const crewSection = document.getElementById('crew-section');
    const crewList = document.getElementById('crew-list');
    crewList.innerHTML = '';
    if (m.crew && m.crew.length > 0) {
      crewSection.style.display = 'block';
      m.crew.forEach(person => {
        const item = document.createElement('div');
        item.className = 'crew-item';
        item.innerHTML = `
          <div class="crew-job">${escapeHtml(person.job || 'Crew')}</div>
          <div class="crew-name">${escapeHtml(person.name)}</div>
        `;
        crewList.appendChild(item);
      });
    } else {
      crewSection.style.display = 'none';
    }

    // Trailer Section
    const trailerSection = document.getElementById('trailer-section');
    const trailerWrap = document.getElementById('trailer-embed-wrap');
    trailerWrap.innerHTML = '';
    if (m.videos && m.videos.length > 0) {
      const topVideo = m.videos[0];
      trailerSection.style.display = 'block';
      trailerWrap.innerHTML = `
        <iframe 
          src="https://www.youtube-nocookie.com/embed/${encodeURIComponent(topVideo.key)}" 
          title="${escapeHtml(topVideo.name || 'Official Trailer')}" 
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
          allowfullscreen>
        </iframe>
      `;
    } else {
      trailerSection.style.display = 'none';
    }

    // Inject Schema.org JSON-LD for Movie
    injectMovieSchema(m);

    // Reveal Content
    loadingEl.style.display = 'none';
    contentEl.style.display = 'block';
  }

  // =========================================================================
  // Clickable Cast Grid with Dynamic Age
  // =========================================================================
  function renderCastGrid(castList) {
    const castSection = document.getElementById('cast-section');
    const castGrid = document.getElementById('cast-grid');
    castGrid.innerHTML = '';

    if (!castList || castList.length === 0) {
      castSection.style.display = 'none';
      return;
    }

    castSection.style.display = 'block';

    castList.forEach(actor => {
      const card = document.createElement('a');
      card.className = 'cast-card cast-card-clickable';
      const actorParam = actor.id || actor.name;
      const actorForUrl = castData?.actors?.find(actor => Number(actor.id) === Number(actorParam)) || { id: actorParam, name: actor.name };
      card.href = getActorUrl(actorForUrl);
      card.setAttribute('data-person-id', actor.id || '');
      card.setAttribute('aria-label', `View actor profile and movies featuring ${actor.name}`);
      card.title = `Click to view ${actor.name}'s profile and Hallmark filmography`;

      // Resolve actor photo URL from cast item or global actor registry
       let rawProfilePath = actor.profile || actor.profile_path;
      if (!rawProfilePath && castData && Array.isArray(castData.actors)) {
        const globalActor = castData.actors.find(a => 
          (actor.id && Number(a.id) === Number(actor.id)) ||
          (actor.name && a.name && a.name.toLowerCase().trim() === actor.name.toLowerCase().trim())
        );
         if (globalActor && (globalActor.profile || globalActor.profile_path)) {
           rawProfilePath = globalActor.profile || globalActor.profile_path;
        }
      }

      const photo = document.createElement('img');
      photo.className = 'cast-photo';
      photo.alt = actor.name || 'Actor';
      photo.loading = 'lazy';
      photo.src = getActorProfileImageUrl(rawProfilePath);
      
      photo.onerror = function() {
        this.onerror = null;
        this.src = PLACEHOLDER_ACTOR_PHOTO;
      };

      const info = document.createElement('div');
      info.className = 'cast-info';

      const name = document.createElement('div');
      name.className = 'cast-name';
      name.textContent = actor.name;

      const char = document.createElement('div');
      char.className = 'cast-character';
      
      // Calculate age dynamically per prompt requirements:
      // Living: "Ashley · Age 38"
      // Deceased: "Bill Mitchell · Aged 71"
      // No birthday: "Ashley" (never display "Age unknown")
      const subtitle = formatCastCardSubtitle(actor.character, actor.birthday, actor.deathday);
      char.textContent = subtitle;

      info.appendChild(name);
      if (subtitle) {
        info.appendChild(char);
      }

      card.appendChild(photo);
      card.appendChild(info);

      // Keyboard navigation support for Spacebar
      card.addEventListener('keydown', (e) => {
        if (e.key === ' ' || e.key === 'Spacebar') {
          e.preventDefault();
          window.location.href = card.href;
        }
      });

      castGrid.appendChild(card);
    });
  }

  // Helper: Update or add meta tag
  function updateMetaTag(property, content) {
    let el = document.querySelector(`meta[property="${property}"]`) || document.querySelector(`meta[name="${property}"]`);
    if (el) {
      el.setAttribute('content', content);
    }
  }

  // Helper: Inject Schema.org Movie metadata
  function injectMovieSchema(m) {
    const schemaEl = document.getElementById('movie-schema');
    if (!schemaEl) return;

    const canonicalFullUrl = `https://xmasdb.com${getMovieUrl(m)}`;

    const actors = (m.cast || []).map(a => ({
      '@type': 'Person',
      'name': a.name,
      'sameAs': `https://www.themoviedb.org/person/${a.id}`
    }));

    const schemaData = {
      '@context': 'https://schema.org',
      '@type': 'Movie',
      'name': m.title,
      'url': canonicalFullUrl,
      'datePublished': m.release_date || (m.year ? `${m.year}-11-01` : undefined),
      'description': m.overview,
      'image': m.poster,
      'actor': actors,
      'genre': ['Holiday', 'Romance', 'Drama']
    };

    if (m.vote_average && m.vote_average > 0) {
      schemaData.aggregateRating = {
        '@type': 'AggregateRating',
        'ratingValue': m.vote_average,
        'bestRating': 10,
        'worstRating': 1,
        'ratingCount': m.vote_count || 10
      };
    }

    schemaEl.textContent = JSON.stringify(schemaData, null, 2);
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
});
