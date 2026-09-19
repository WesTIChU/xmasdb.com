/**
 * Shared Site Layout Module for XmasDB.com
 * 
 * Provides unified, single-source-of-truth render functions for:
 * - renderSiteHeader()
 * - renderSiteFooter()
 * - updateLayoutCounts()
 * 
 * Preserves the exact master design from the homepage (index.html).
 */

import { initSiteSearch } from './site-search.js';

export const HEADER_HTML = `
  <div class="hero-decoration-layer" aria-hidden="true">
    <div class="hero-branch hero-branch-left"></div>
    <div class="hero-branch hero-branch-right"></div>
    <div class="hero-lights">
      <span class="hero-light hero-light-one"></span>
      <span class="hero-light hero-light-two"></span>
      <span class="hero-light hero-light-three"></span>
      <span class="hero-light hero-light-four"></span>
      <span class="hero-light hero-light-five"></span>
      <span class="hero-light hero-light-six"></span>
    </div>
    <div class="hero-snowbank"></div>
  </div>
  <div class="header-inner">
    <div class="header-top-row">
      <a href="/" class="header-title-wrap header-brand-link" id="header-brand-link" aria-label="XmasDB.com Home">
        <span class="title-lockup">
          <span class="title-ornament" aria-hidden="true"><span></span></span>
          <span class="title-rule" aria-hidden="true"></span>
          <h1 id="site-title" class="site-title">XmasDB.com</h1>
          <span class="title-rule" aria-hidden="true"></span>
        </span>
     </a>
     </div>
     <p id="site-description" class="site-description">A curated collection of Hallmark Christmas movies.</p>
     <div id="top-controls-row" class="top-controls-row header-controls-row">
       <div id="global-search-container" class="global-search-container" role="search">
         <div class="search-input-wrap">
           <svg class="search-icon" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
           <input type="text" id="global-search-input" class="global-search-input" placeholder="Search movies or actors..." autocomplete="off" spellcheck="false" aria-label="Search movies or actors" aria-autocomplete="list" aria-controls="search-autocomplete-list" aria-expanded="false" />
           <button type="button" id="search-clear-btn" class="search-clear-btn" aria-label="Clear search" style="display: none;">&times;</button>
         </div>
         <div id="search-autocomplete-dropdown" class="search-autocomplete-dropdown" style="display: none;" role="listbox" aria-label="Search suggestions"><ul id="search-autocomplete-list" class="search-autocomplete-list" role="presentation"></ul></div>
       </div>
       <a id="radarr-btn" class="btn-radarr" href="/radarr.html">RADARR / JSON LISTS</a>
     </div>
     <p id="header-festive-message" class="header-festive-message" aria-live="polite"><span id="header-countdown-text"></span><span aria-hidden="true"> · </span><span id="header-movie-count" class="header-movie-count" aria-live="polite">... movies</span></p>
  </div>
`;

export const FOOTER_HTML = `
  <div class="footer-inner">
    <div class="footer-main">
      <h2 class="footer-title">XmasDB.com</h2>
        <p class="footer-subtitle">A curated collection of Hallmark Christmas movies.</p>
      <nav class="footer-nav" aria-label="Footer navigation">
        <a id="footer-all-link" href="/" class="footer-link">Movies</a>
        <span class="footer-sep" aria-hidden="true">&bull;</span>
        <a id="footer-radarr-link" href="radarr.html" class="footer-link">Radarr / JSON Lists</a>
        <span class="footer-sep" aria-hidden="true">&bull;</span>
        <a id="footer-tmdb-link" href="https://www.themoviedb.org/" target="_blank" rel="noopener noreferrer" class="footer-link">TMDB</a>
        <span class="footer-sep" aria-hidden="true">&bull;</span>
        <button type="button" class="footer-link footer-modal-trigger" data-disclaimer-open>Disclaimer &amp; AI Transparency</button>
      </nav>
    </div>

        <div class="footer-bottom">
      <hr class="footer-divider" />
      <div class="footer-notes">
        <p id="tmdb-disclaimer" class="footer-note">This product uses the TMDB API but is not endorsed or certified by TMDB.</p>
        <p class="footer-note">XmasDB.com is an independent fan-curated movie database and is not affiliated with or endorsed by Hallmark.</p>
        <p class="footer-note">Privacy: We don't collect your data. No tracking. No analytics. No ads.</p>
        <p class="footer-copyright">&copy; <span id="footer-copyright-year">${new Date().getFullYear()}</span> XmasDB.com</p>
        </div>
      </div>
  </div>
  <div class="footer-disclaimer-modal" data-disclaimer-modal hidden>
    <div class="footer-disclaimer-backdrop" data-disclaimer-close></div>
    <section class="footer-disclaimer-dialog" role="dialog" aria-modal="true" aria-labelledby="footer-disclaimer-title" tabindex="-1">
      <button type="button" class="footer-disclaimer-close" data-disclaimer-close aria-label="Close disclaimer">&times;</button>
      <h2 id="footer-disclaimer-title">Disclaimer &amp; AI Transparency</h2>
      <p>This is a personal fan-made project and is not affiliated with, endorsed by, or sponsored by Hallmark.</p>
      <p>Movie, cast, and credit information is sourced from TMDB and may contain errors or omissions.</p>
      <p>AI-assisted tools may be used during development, data organization, and maintenance. AI is not a source of truth, and information should be verified against reliable sources.</p>
      <p>This site does not collect personal data, use tracking, analytics, or advertising.</p>
    </section>
  </div>
`;

/**
 * Renders the master site header into the target container or existing #site-header
 */
export function renderSiteHeader(target) {
  const container = target || document.getElementById('site-header');
  if (!container) return null;

  container.className = 'site-header homepage-hero';
  container.innerHTML = HEADER_HTML;
  return container;
}

/**
 * Renders the master site footer into the target container or existing #site-footer
 */
export function renderSiteFooter(target) {
  const container = target || document.getElementById('site-footer');
  if (!container) return null;

  container.className = 'site-footer';
  container.innerHTML = FOOTER_HTML;

  const modal = container.querySelector('[data-disclaimer-modal]');
  const dialog = modal?.querySelector('.footer-disclaimer-dialog');
  const trigger = container.querySelector('[data-disclaimer-open]');
  const close = () => {
    if (!modal) return;
    modal.hidden = true;
    trigger?.focus();
  };
  const open = () => {
    if (!modal || !dialog) return;
    modal.hidden = false;
    dialog.focus();
  };
  trigger?.addEventListener('click', open);
  modal?.querySelectorAll('[data-disclaimer-close]').forEach(button => button.addEventListener('click', close));
  dialog?.addEventListener('click', event => event.stopPropagation());
  modal?.addEventListener('keydown', event => {
    if (event.key === 'Escape') close();
  });

  const yearEl = container.querySelector('#footer-copyright-year');
  if (yearEl) {
    yearEl.textContent = String(new Date().getFullYear());
  }

  return container;
}

function initScrollToTop() {
  if (document.getElementById('scroll-to-top')) return;

  const button = document.createElement('button');
  button.type = 'button';
  button.id = 'scroll-to-top';
  button.className = 'scroll-to-top';
  button.setAttribute('aria-label', 'Scroll to top');
  button.textContent = '🎄 Top';
  document.body.appendChild(button);

  const updateVisibility = () => {
    button.classList.toggle('is-visible', window.scrollY > 400);
  };
  button.addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  });
  window.addEventListener('scroll', updateVisibility, { passive: true });
  updateVisibility();
}

/**
 * Updates movie count in both header and footer elements
 */
export function updateLayoutCounts(count) {
  if (typeof count !== 'number' && typeof count !== 'string') return;
  const num = parseInt(count, 10);
  if (isNaN(num)) return;

  const headerCountEl = document.getElementById('header-movie-count');
  if (headerCountEl) {
    headerCountEl.textContent = `${num} movies`;
  }

  const footerCountEl = document.getElementById('footer-movie-count');
  if (footerCountEl) {
    footerCountEl.textContent = `${num} movies in the collection`;
  }
}

function getChristmasCountdown(now = new Date()) {
  const year = now.getFullYear();
  const month = now.getMonth();
  const day = now.getDate();
  const targetYear = month === 11 && day > 25 ? year + 1 : year;
  const days = Math.round((Date.UTC(targetYear, 11, 25) - Date.UTC(year, month, day)) / 86400000);
  return `🎄 ${days} days until Christmas`;
}

let layoutInitialized = false;

/**
 * Fetches movies.json and populates count if not already set
 */
async function autoPopulateCounts() {
  const headerCountEl = document.getElementById('header-movie-count');
  const footerCountEl = document.getElementById('footer-movie-count');

  // If already populated with a real number, skip
  if (headerCountEl && !headerCountEl.textContent.includes('...')) {
    return;
  }

  try {
    const res = await fetch('/movies.json');
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data)) {
        updateLayoutCounts(data.length);
      }
    }
  } catch (err) {
    // Non-blocking fallback
  }
}

/**
 * Initializes the layout on DOM ready
 */
export function initSiteLayout() {
  if (layoutInitialized) return;
  layoutInitialized = true;

  const header = document.getElementById('site-header');
   if (header) {
     renderSiteHeader(header);
   }

   initSiteSearch();

  const footer = document.getElementById('site-footer');
  if (footer) {
    renderSiteFooter(footer);
  }

  // Ensure copyright year is set
  const yearEl = document.getElementById('footer-copyright-year');
  if (yearEl) {
    yearEl.textContent = String(new Date().getFullYear());
  }

  const countdownText = document.getElementById('header-countdown-text');
  if (countdownText) countdownText.textContent = getChristmasCountdown();
  setInterval(() => {
    if (countdownText) countdownText.textContent = getChristmasCountdown();
  }, 60000);

  autoPopulateCounts();
  initScrollToTop();
}

// Auto-run on DOMContentLoaded if running in browser
if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initSiteLayout);
  } else {
    initSiteLayout();
  }
}
