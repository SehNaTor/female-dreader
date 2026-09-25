/**
 * scroll-init.js
 * =============================================================================
 * Auto-initializing Lenis bootstrap for PLAIN SCRIPT pages (non-module).
 *
 * Usage in HTML (load AFTER the Lenis CDN script):
 *   <script src="https://cdn.jsdelivr.net/npm/lenis@1.1.14/dist/lenis.min.js"></script>
 *   <script src="js/scroll/scroll-init.js"></script>
 *
 * This script does NOT use ES6 import/export so it works as a plain <script>.
 * It exposes window.FDScroll for non-module pages (navbar.js, etc.) to use.
 *
 * For ES6 module pages, import from lenis-controller.js directly instead.
 */
(function FDScrollInit() {
  'use strict';

  // ── Singleton guard ──────────────────────────────────────────────────────────
  if (window.FDScroll && window.FDScroll._initialized) return;

  let _instance = null;
  let _rafId    = null;

  // ── Reduced-motion guard ─────────────────────────────────────────────────────
  function prefersReducedMotion() {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  // ── RAF loop (single loop, no duplicates) ────────────────────────────────────
  function raf(time) {
    if (_instance) _instance.raf(time);
    _rafId = requestAnimationFrame(raf);
  }

  function startRaf() {
    if (_rafId !== null) return;
    _rafId = requestAnimationFrame(raf);
  }

  function stopRaf() {
    if (_rafId !== null) {
      cancelAnimationFrame(_rafId);
      _rafId = null;
    }
  }

  // ── Core init ────────────────────────────────────────────────────────────────
  function init() {
    if (_instance) return _instance;

    if (typeof window.Lenis === 'undefined') {
      console.warn('[FDScroll] Lenis not loaded. Native scrolling active.');
      return null;
    }

    if (prefersReducedMotion()) {
      console.info('[FDScroll] Reduced-motion preference detected. Lenis disabled.');
      return null;
    }

    _instance = new window.Lenis({
      duration:           1.2,
      easing:             t => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      orientation:        'vertical',
      gestureOrientation: 'vertical',
      smoothWheel:        true,
      wheelMultiplier:    1.0,
      touchMultiplier:    1.5,
      infinite:           false,
      autoRaf:            false,
    });

    startRaf();
    console.info('[FDScroll] Lenis initialized.');
    return _instance;
  }

  // ── Scroll lock / unlock for modals ─────────────────────────────────────────
  function pause() {
    if (_instance) _instance.stop();
  }

  function resume() {
    if (_instance) _instance.start();
  }

  // ── Lenis-aware scrollTo ─────────────────────────────────────────────────────
  // Replaces native scrollIntoView / window.scrollTo with Lenis equivalents.
  function scrollTo(target, options) {
    options = options || {};
    if (_instance) {
      var resolved =
        typeof target === 'string' ? document.querySelector(target) : target;
      _instance.scrollTo(resolved !== null ? resolved : target, {
        offset:    options.offset    || 0,
        duration:  options.duration  || 1.2,
        immediate: options.immediate || false,
      });
    } else {
      // Fallback
      var el =
        typeof target === 'string'  ? document.querySelector(target) :
        typeof target === 'number'  ? null : target;
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      } else if (typeof target === 'number') {
        window.scrollTo({ top: target, behavior: 'smooth' });
      }
    }
  }

  // ── Expose global API ─────────────────────────────────────────────────────────
  window.FDScroll = {
    _initialized: true,
    init:     init,
    pause:    pause,
    resume:   resume,
    scrollTo: scrollTo,
    getInstance: function() { return _instance; },
    destroy: function() {
      stopRaf();
      if (_instance) { _instance.destroy(); _instance = null; }
    }
  };

  // ── Auto-boot ─────────────────────────────────────────────────────────────────
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
