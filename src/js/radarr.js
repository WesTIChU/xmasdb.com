/**
 * Radarr Tutorial Page JavaScript
 * Handles dynamic feed URL generation, clipboard copying, and collection statistics.
 */

document.addEventListener('DOMContentLoaded', () => {
  const footerMovieCount = document.getElementById('footer-movie-count');
  const footerCopyrightYear = document.getElementById('footer-copyright-year');
  const footerJsonLink = document.getElementById('footer-json-link');

  const feedChoicesContainer = document.getElementById('radarr-feed-choices');
  const feedUrlInput = document.getElementById('radarr-feed-url');
  const copyBtn = document.getElementById('copy-url-btn');
  const copyBtnText = document.getElementById('copy-btn-text');
  const dynamicYearBreakdown = document.getElementById('dynamic-year-breakdown');
  const actorSearchInput = document.getElementById('actor-feed-search-input');
  const actorSearchResults = document.getElementById('actor-feed-search-results');
  const actorFeedResult = document.getElementById('actor-feed-url-result');
  const actorFeedLabel = document.getElementById('actor-feed-url-label');
  const actorFeedInput = document.getElementById('actor-feed-url');
  const copyActorUrlBtn = document.getElementById('copy-actor-url-btn');

  let availableYears = [];
  let actors = [];

  // Set copyright year automatically
  if (footerCopyrightYear) {
    footerCopyrightYear.textContent = new Date().getFullYear().toString();
  }

  // Helper to get absolute URL for a path relative to the website root
  function getAbsoluteFeedUrl(feed) {
    const origin = window.location.origin;
    const pathname = window.location.pathname;
    // Base directory (handles GitHub pages or subfolder deployments)
    const baseDir = pathname.substring(0, pathname.lastIndexOf('/') + 1);

    if (feed === 'ALL') {
      return `${origin}${baseDir}json/all.json`;
    }
    return `${origin}${baseDir}json/${feed}.json`;
  }

  function getAbsoluteActorFeedUrl(id) {
    return `${window.location.origin}${window.location.pathname.substring(0, window.location.pathname.lastIndexOf('/') + 1)}json/actors/${id}.json`;
  }

  function showActorFeed(actor) {
    if (!actorFeedResult || !actorFeedInput || !actorFeedLabel) return;
    actorFeedInput.value = getAbsoluteActorFeedUrl(actor.id);
    actorFeedLabel.textContent = `Hallmark Christmas movies in this collection featuring ${actor.name}`;
    actorFeedResult.hidden = false;
    if (actorSearchResults) actorSearchResults.innerHTML = '';
  }

  function renderActorMatches() {
    if (!actorSearchResults || !actorSearchInput) return;
    const query = actorSearchInput.value.trim().toLowerCase();
    actorSearchResults.innerHTML = '';
    if (!query) {
      if (actorFeedResult) actorFeedResult.hidden = true;
      return;
    }
    const matches = actors.filter(actor => actor.name.toLowerCase().includes(query)).slice(0, 8);
    matches.forEach(actor => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'actor-feed-match';
      button.textContent = `${actor.name} · ${actor.count || actor.movieTmdbIds?.length || 0} movies`;
      button.addEventListener('click', () => {
        actorSearchInput.value = actor.name;
        showActorFeed(actor);
      });
      actorSearchResults.appendChild(button);
    });
    if (!matches.length) actorSearchResults.textContent = 'No collection actor found.';
  }

  actorSearchInput?.addEventListener('input', renderActorMatches);

  copyActorUrlBtn?.addEventListener('click', async () => {
    if (!actorFeedInput?.value) return;
    try {
      await navigator.clipboard.writeText(actorFeedInput.value);
      copyActorUrlBtn.textContent = 'Copied!';
      setTimeout(() => { copyActorUrlBtn.textContent = 'Copy URL'; }, 2200);
    } catch {
      actorFeedInput.focus();
      actorFeedInput.select();
      document.execCommand('copy');
    }
  });

  fetch('cast.json')
    .then(res => res.ok ? res.json() : null)
    .then(data => { actors = Array.isArray(data?.actors) ? data.actors.filter(actor => actor?.id && actor?.name) : []; })
    .catch(() => { actors = []; });

  function updateFeedUrl(feed) {
    const fullUrl = getAbsoluteFeedUrl(feed);

    if (feedUrlInput) {
      feedUrlInput.value = fullUrl;
    }

    if (footerJsonLink) {
      footerJsonLink.href = feed === 'ALL' ? 'json/all.json' : `json/${feed}.json`;
    }

    // Update active state on choice buttons
    if (feedChoicesContainer) {
      const buttons = feedChoicesContainer.querySelectorAll('.btn-feed-choice');
      buttons.forEach((btn) => {
        if (btn.dataset.feed === feed.toString()) {
          btn.classList.add('active');
          btn.setAttribute('aria-pressed', 'true');
        } else {
          btn.classList.remove('active');
          btn.setAttribute('aria-pressed', 'false');
        }
      });
    }
  }

  // Fetch movies.json to get count and dynamic years
  fetch('movies.json')
    .then((res) => {
      if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
      return res.json();
    })
    .then((movies) => {
      if (!Array.isArray(movies) || movies.length === 0) return;

      // The shared layout owns the festive header count.
      if (footerMovieCount) {
        footerMovieCount.textContent = `${movies.length} movies in the collection`;
      }

      // Extract unique years sorted newest first
      availableYears = [...new Set(movies.map((m) => m.year).filter(Boolean))].sort((a, b) => b - a);

      // Build choice buttons
      if (feedChoicesContainer) {
        // Clear except FULL COLLECTION
        const allBtn = feedChoicesContainer.querySelector('[data-feed="ALL"]');
        feedChoicesContainer.innerHTML = '';
        if (allBtn) {
          feedChoicesContainer.appendChild(allBtn);
        } else {
          const newAllBtn = document.createElement('button');
          newAllBtn.type = 'button';
          newAllBtn.className = 'btn-feed-choice active';
          newAllBtn.dataset.feed = 'ALL';
          newAllBtn.textContent = 'FULL COLLECTION';
          feedChoicesContainer.appendChild(newAllBtn);
        }

        availableYears.forEach((year) => {
          const btn = document.createElement('button');
          btn.type = 'button';
          btn.className = 'btn-feed-choice';
          btn.dataset.feed = year.toString();
          btn.textContent = year.toString();
          feedChoicesContainer.appendChild(btn);
        });

        // Add event listeners to all choice buttons
        const allButtons = feedChoicesContainer.querySelectorAll('.btn-feed-choice');
        allButtons.forEach((btn) => {
          btn.addEventListener('click', () => {
            updateFeedUrl(btn.dataset.feed);
          });
        });
      }

      // Populate year breakdown list in explanation box
      if (dynamicYearBreakdown) {
        dynamicYearBreakdown.innerHTML = '';
        availableYears.forEach((year) => {
          const p = document.createElement('p');
          p.innerHTML = `<strong>${year}</strong> = only ${year} movies`;
          dynamicYearBreakdown.appendChild(p);
        });
      }

      // Initialize with FULL COLLECTION URL
      updateFeedUrl('ALL');
    })
    .catch((err) => {
      console.warn('Could not load movies.json for dynamic counts:', err);
      updateFeedUrl('ALL');
    });

  // Copy button handler with clipboard API & fallback
  if (copyBtn && feedUrlInput) {
    copyBtn.addEventListener('click', async () => {
      const urlToCopy = feedUrlInput.value;
      if (!urlToCopy) return;

      let success = false;
      if (navigator.clipboard && navigator.clipboard.writeText) {
        try {
          await navigator.clipboard.writeText(urlToCopy);
          success = true;
        } catch (err) {
          console.warn('Clipboard API write failed, falling back:', err);
        }
      }

      if (!success) {
        try {
          feedUrlInput.focus();
          feedUrlInput.select();
          success = document.execCommand('copy');
        } catch (err) {
          console.error('Fallback copy failed:', err);
        }
      }

      if (success) {
        copyBtn.classList.add('copied');
        if (copyBtnText) copyBtnText.textContent = '✓ Copied!';
        setTimeout(() => {
          copyBtn.classList.remove('copied');
          if (copyBtnText) copyBtnText.textContent = 'Copy URL';
        }, 2200);
      }
    });
  }
});
