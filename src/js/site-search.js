import { getActorProfileImageUrl, normalizeSearchText, PLACEHOLDER_ACTOR_PHOTO } from './actor-utils.js';
import { getActorUrl, getMovieUrl } from './movie-url.js';

let initialized = false;

export function initSiteSearch() {
  if (initialized) return;

  const container = document.getElementById('global-search-container');
  const input = document.getElementById('global-search-input');
  const clearButton = document.getElementById('search-clear-btn');
  const dropdown = document.getElementById('search-autocomplete-dropdown');
  const list = document.getElementById('search-autocomplete-list');
  if (!container || !input || !dropdown || !list) return;

  initialized = true;
  let searchIndex = [];
  let results = [];
  let selectedIndex = -1;

  const close = () => {
    dropdown.style.display = 'none';
    input.setAttribute('aria-expanded', 'false');
    input.removeAttribute('aria-activedescendant');
    selectedIndex = -1;
  };

  const buildIndex = (movies, castData) => {
    searchIndex = [];
    (Array.isArray(movies) ? movies : []).forEach(movie => {
      if (!movie?.title) return;
      const originalTitle = movie.originalTitle || movie.original_title || '';
      searchIndex.push({
        type: 'movie',
        title: movie.title,
        originalTitle,
        year: movie.year,
        poster: movie.poster,
        tmdbId: movie.tmdbId || movie.tmdb_id,
        normTitle: normalizeSearchText(movie.title),
        normOriginalTitle: originalTitle ? normalizeSearchText(originalTitle) : ''
      });
    });
    (Array.isArray(castData?.actors) ? castData.actors : []).forEach(actor => {
      if (!actor?.name) return;
      const count = typeof actor.count === 'number'
        ? actor.count
        : (Array.isArray(actor.movieTmdbIds) ? actor.movieTmdbIds.length : 0);
      searchIndex.push({
        type: 'actor',
        id: actor.id,
        name: actor.name,
        profile_path: actor.profile_path,
        count,
        normName: normalizeSearchText(actor.name)
      });
    });
  };

  const rank = (query, item) => {
    const value = item.type === 'movie' ? item.normTitle : item.normName;
    if (value.startsWith(query)) return 1;
    if (value.split(' ').some(word => word.startsWith(query))) return 2;
    if (value.includes(query)) return 3;
    if (item.type === 'movie' && item.normOriginalTitle) {
      if (item.normOriginalTitle.startsWith(query)) return 2;
      if (item.normOriginalTitle.split(' ').some(word => word.startsWith(query))) return 3;
      if (item.normOriginalTitle.includes(query)) return 4;
    }
    return null;
  };

  const setSelected = index => {
    selectedIndex = index;
    list.querySelectorAll('.autocomplete-item').forEach((item, itemIndex) => {
      const selected = itemIndex === index;
      item.classList.toggle('is-selected', selected);
      item.setAttribute('aria-selected', selected ? 'true' : 'false');
      if (selected) item.scrollIntoView({ block: 'nearest' });
    });
  };

  const execute = item => {
    close();
    input.value = '';
    clearButton.style.display = 'none';
    window.location.href = item.type === 'movie' ? getMovieUrl(item) : getActorUrl({ id: item.id, name: item.name });
  };

  const render = (query, matches) => {
    list.innerHTML = '';
    if (matches.length === 0) {
      const empty = document.createElement('li');
      empty.className = 'autocomplete-no-results';
      empty.textContent = `No movies or actors found matching "${query}".`;
      list.appendChild(empty);
    }

    matches.forEach(({ item }, index) => {
      const row = document.createElement('li');
      row.className = 'autocomplete-item';
      row.id = `autocomplete-item-${index}`;
      row.setAttribute('role', 'option');
      row.setAttribute('aria-selected', 'false');

      const image = document.createElement('img');
      image.className = 'autocomplete-poster-thumb';
      image.alt = item.type === 'movie' ? item.title : item.name;
      image.src = item.type === 'movie' ? (item.poster || '') : getActorProfileImageUrl(item.profile_path);
      image.onerror = () => {
        image.onerror = null;
        image.src = item.type === 'movie'
          ? 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="26" height="39"><rect width="26" height="39" fill="%23e2e8f0"/></svg>'
          : PLACEHOLDER_ACTOR_PHOTO;
      };

      const text = document.createElement('div');
      text.className = 'autocomplete-text-wrap';
      const title = document.createElement('span');
      title.className = 'autocomplete-title';
      title.textContent = item.type === 'movie' ? item.title : item.name;
      const subtitle = document.createElement('span');
      subtitle.className = 'autocomplete-sub';
      subtitle.textContent = item.type === 'movie'
        ? (item.year ? `${item.year} Release` : 'Movie')
        : `${item.count || 0} ${item.count === 1 ? 'movie' : 'movies'} in collection`;
      text.append(title, subtitle);

      const main = document.createElement('div');
      main.className = 'autocomplete-item-main';
      main.append(image, text);
      const badge = document.createElement('span');
      badge.className = `autocomplete-badge badge-type-${item.type}`;
      badge.textContent = item.type === 'movie' ? 'Movie' : 'Actor';
      row.append(main, badge);
      row.addEventListener('mouseenter', () => setSelected(index));
      row.addEventListener('click', () => execute(item));
      list.appendChild(row);
    });

    dropdown.style.display = 'block';
    input.setAttribute('aria-expanded', 'true');
  };

  const search = query => {
    const normalized = normalizeSearchText(query);
    if (!normalized) return close();
    const matches = searchIndex
      .map(item => ({ item, rank: rank(normalized, item) }))
      .filter(match => match.rank !== null)
      .sort((a, b) => a.rank - b.rank || (b.item.count || 0) - (a.item.count || 0) || String(a.item.title || a.item.name).localeCompare(String(b.item.title || b.item.name)))
      .slice(0, 10);
    results = matches;
    selectedIndex = -1;
    render(query.trim(), matches);
  };

  input.addEventListener('input', event => {
    clearButton.style.display = event.target.value.length > 0 ? 'flex' : 'none';
    search(event.target.value);
  });
  input.addEventListener('keydown', event => {
    if (dropdown.style.display === 'none') {
      if (event.key === 'Enter') search(input.value);
      return;
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      if (selectedIndex + 1 < results.length) setSelected(selectedIndex + 1);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      if (selectedIndex > 0) setSelected(selectedIndex - 1);
    } else if (event.key === 'Enter') {
      event.preventDefault();
      if (results[selectedIndex]) execute(results[selectedIndex].item);
      else if (results[0]) execute(results[0].item);
    } else if (event.key === 'Escape') close();
  });
  clearButton.addEventListener('click', () => {
    input.value = '';
    clearButton.style.display = 'none';
    close();
    input.focus();
  });
  document.addEventListener('click', event => {
    if (!container.contains(event.target)) close();
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') close();
  });

  Promise.all([
    fetch('/movies.json', { cache: 'no-store' }).then(response => response.ok ? response.json() : []),
    fetch('/cast.json', { cache: 'no-store' }).then(response => response.ok ? response.json() : null)
  ]).then(([movies, castData]) => buildIndex(movies, castData)).catch(() => {});
}
