/**
 * lenis-controller.js
 * =============================================================================
 * Centralized Lenis smooth-scroll singleton for Female Dreader.
 *
 * Usage (ES6 module):
 *   import { getLenis, initLenis, destroyLenis, scrollTo } from './lenis-controller.js';
 *
 * The module guarantees:
 *  - Only ONE Lenis instance ever exists (singleton guard).
 *  - Auto-starts on first import.
 *  - Provides pause/resume for modal compatibility.
 *  - Provides a Lenis-aware scrollTo() to replace native scrollIntoView().
 *  - Tears itself down cleanly on destroy().
 *  - Never crashes if Lenis CDN failed to load.
 */

// ─── Singleton state ──────────────────────────────────────────────────────────
let _instance = null;
let _rafId    = null;

// ─── Reduced-motion guard ─────────────────────────────────────────────────────
const prefersReducedMotion = () =>
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// ─── RAF loop ─────────────────────────────────────────────────────────────────
function _raf(time) {
  if (_instance) _instance.raf(time);
  _rafId = requestAnimationFrame(_raf);
}

function _startRaf() {
  if (_rafId !== null) return;   // already running — no duplicates
  _rafId = requestAnimationFrame(_raf);
}

function _stopRaf() {
  if (_rafId !== null) {
    cancelAnimationFrame(_rafId);
    _rafId = null;
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Returns the active Lenis instance (or null if not initialized).
 * @returns {Lenis|null}
 */
export function getLenis() {
  return _instance;
}

/**
 * Initializes Lenis once. Subsequent calls are no-ops.
 * Safe to call from any page or module.
 */
export function initLenis() {
  // Guard: already initialized
  if (_instance) return _instance;

  // Guard: Lenis library not loaded
  if (typeof window.Lenis === 'undefined') {
    console.warn('[Lenis] Lenis library not found. Smooth scroll inactive.');
    return null;
  }

  // Respect user's reduced-motion preference
  if (prefersReducedMotion()) {
    console.info('[Lenis] Reduced-motion detected. Lenis disabled.');
    return null;
  }

  _instance = new window.Lenis({
    duration:        1.2,
    easing:          t => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
    orientation:     'vertical',
    gestureOrientation: 'vertical',
    smoothWheel:     true,
    wheelMultiplier: 1.0,
    touchMultiplier: 1.5,
    infinite:        false,
    autoRaf:         false,   // We manage the RAF ourselves to avoid duplicates
  });

  _startRaf();

  console.info('[Lenis] Initialized.');
  return _instance;
}

/**
 * Pauses Lenis scrolling (e.g. when a modal opens).
 * Does NOT stop the RAF — keeps Lenis ticking so it can resume instantly.
 */
export function pauseLenis() {
  if (_instance) _instance.stop();
}

/**
 * Resumes Lenis scrolling (e.g. when a modal closes).
 */
export function resumeLenis() {
  if (_instance) _instance.start();
}

/**
 * Destroys the Lenis instance and RAF loop.
 * Only call if you explicitly need to tear down scrolling (e.g. SPA navigation).
 */
export function destroyLenis() {
  _stopRaf();
  if (_instance) {
    _instance.destroy();
    _instance = null;
  }
}

/**
 * Smooth-scrolls to a target using Lenis.
 * Falls back to native scrollIntoView if Lenis is unavailable.
 *
 * @param {string|number|HTMLElement} target
 *   - A CSS selector string  e.g. '#section-id'
 *   - A DOM element
 *   - A numeric pixel offset
 * @param {Object} [options]
 *   - offset   {number}   px offset from target (default 0)
 *   - duration {number}   override duration in seconds
 *   - immediate {boolean} jump without animation
 */
export function scrollTo(target, options = {}) {
  if (_instance) {
    // Resolve selector to element so Lenis can handle it
    const resolved =
      typeof target === 'string' ? document.querySelector(target) : target;
    _instance.scrollTo(resolved ?? target, {
      offset:    options.offset    ?? 0,
      duration:  options.duration  ?? 1.2,
      immediate: options.immediate ?? false,
    });
  } else {
    // Graceful fallback for reduced-motion or CDN failure
    const el =
      typeof target === 'string' ? document.querySelector(target) :
      typeof target === 'number' ? null : target;

    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else if (typeof target === 'number') {
      window.scrollTo({ top: target, behavior: 'smooth' });
    }
  }
}
