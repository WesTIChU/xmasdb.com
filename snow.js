/**
  * Subtle Christmas Snow Effect
  * 
  * Lightweight vanilla JavaScript snow generator.
  * Creates 24-28 subtle, small snowflakes drifting gently down the screen.
  * Honors `prefers-reduced-motion: reduce`.
  */

(() => {
  if (typeof window === 'undefined') return;

  const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  if (motionQuery.matches) {
    return;
  }

  function initSnow() {
    if (document.getElementById('snow-layer')) return;

    const container = document.createElement('div');
    container.id = 'snow-layer';
    container.className = 'snow-container';
    container.setAttribute('aria-hidden', 'true');

    // 25 subtle flakes visible across the screen
    const FLAKE_COUNT = 26;

    for (let i = 0; i < FLAKE_COUNT; i++) {
      const flake = document.createElement('div');
      flake.className = 'snowflake';

      // Random small size (2.5px to 5.2px)
      const size = (Math.random() * 2.7 + 2.5).toFixed(1);
      // Random horizontal position (1% to 99%)
      const left = (Math.random() * 98 + 1).toFixed(1);
      // Random gentle falling duration (10s to 18s)
      const duration = (Math.random() * 8 + 10).toFixed(1);
      // Staggered negative delay so snow is already smoothly falling on page load
      const delay = -(Math.random() * 18).toFixed(1);
      // Subtle opacity (0.40 to 0.80) - gentle over white, luminous over evergreen header/footer
      const opacity = (Math.random() * 0.4 + 0.4).toFixed(2);
      // Slight horizontal drift offset (-12px to +14px)
      const drift = (Math.random() * 26 - 12).toFixed(0);

      flake.style.width = `${size}px`;
      flake.style.height = `${size}px`;
      flake.style.left = `${left}%`;
      flake.style.opacity = opacity;
      flake.style.animationDuration = `${duration}s`;
      flake.style.animationDelay = `${delay}s`;
      flake.style.setProperty('--drift', `${drift}px`);

      container.appendChild(flake);
    }

    document.body.appendChild(container);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initSnow);
  } else {
    initSnow();
  }

  if (motionQuery.addEventListener) {
    motionQuery.addEventListener('change', (e) => {
      const layer = document.getElementById('snow-layer');
      if (e.matches && layer) {
        layer.remove();
      } else if (!e.matches && !layer) {
        initSnow();
      }
    });
  }
})();
