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

export const HEADER_HTML = `
  <div class="hero-branch hero-branch-left" aria-hidden="true"></div>
  <div class="hero-branch hero-branch-right" aria-hidden="true"></div>
  <div class="hero-lights" aria-hidden="true">
    <span class="hero-light hero-light-one"></span>
    <span class="hero-light hero-light-two"></span>
    <span class="hero-light hero-light-three"></span>
    <span class="hero-light hero-light-four"></span>
    <span class="hero-light hero-light-five"></span>
    <span class="hero-light hero-light-six"></span>
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
    <p id="header-festive-message" class="header-festive-message" aria-live="polite">
      <span class="festive-main-message"></span>
      <span id="header-movie-count" class="header-movie-count" aria-live="polite">... Hallmark Christmas movies ready and waiting.</span>
    </p>
  </div>
  <div class="hero-snowbank" aria-hidden="true"></div>
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
    headerCountEl.textContent = document.getElementById('site-header')?.classList.contains('homepage-hero')
      ? `${num} Hallmark Christmas movies ready and waiting.`
      : `${num} Movies`;
  }

  const footerCountEl = document.getElementById('footer-movie-count');
  if (footerCountEl) {
    footerCountEl.textContent = `${num} movies in the collection`;
  }
}

function getChristmasMessage(now = new Date()) {
  const year = now.getFullYear();
  const month = now.getMonth();
  const day = now.getDate();
    if (month === 11) {
    if (day === 24) return "✨ It's Christmas Eve - one more movie?";
    if (day === 25) return '🎄 Merry Christmas!';
    if (day === 26) return "🎁 Christmas isn't over yet…";
    if (day >= 27 && day <= 30) return '✨ Keep the festive feeling going.';
    if (day === 31) return "🥂 Happy New Year's Eve!";
  }
  if (month === 0 && day === 1) return '🎆 Happy New Year!';
  const targetYear = month === 11 && day > 25 ? year + 1 : year;
  const days = Math.round((Date.UTC(targetYear, 11, 25) - Date.UTC(year, month, day)) / 86400000);
  if (days <= 7) return `🎄 Only ${days} ${days === 1 ? 'sleep' : 'sleeps'} until Christmas!`;
  if (days <= 24) return `${days} days until Christmas - Christmas movie season is in full swing. 🎬`;
  if (days <= 49) return `${days} days until Christmas - Hallmark season is officially underway. 🎄`;
  if (days <= 99) return `${days} days until Christmas — time for a little festive magic. ✨`;
  return "Too early for Christmas movies? We don't think so. 🎄";
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

  const footer = document.getElementById('site-footer');
  if (footer) {
    renderSiteFooter(footer);
  }

  // Ensure copyright year is set
  const yearEl = document.getElementById('footer-copyright-year');
  if (yearEl) {
    yearEl.textContent = String(new Date().getFullYear());
  }

  const festiveMessage = document.getElementById('header-festive-message');
  const festiveText = festiveMessage?.querySelector('.festive-main-message');
  if (festiveText) {
    festiveText.textContent = getChristmasMessage();
  } else if (festiveMessage) {
    festiveMessage.textContent = getChristmasMessage();
  }

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
