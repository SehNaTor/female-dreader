/**
 * Premium Navbar Module — Female Dreader
 * ============================================================
 * Modular, performance-optimised navigation controller.
 *
 * Architecture:
 *  - NavbarLoader      : Fetches and injects navbar.html
 *  - ScrollController  : Scroll-aware class toggling (rAF-debounced)
 *  - ActiveLinkCtrl    : Current-page link highlighting
 *  - HamburgerCtrl     : Hamburger ↔ X animation state
 *  - MobileMenuCtrl    : Drawer open/close, body-scroll-lock,
 *                        focus-trap, outside-click, Escape key
 *
 * No duplicate event listeners. All DOM refs cached. GPU-only animations.
 * Never hides the navbar. Admin panel is completely untouched.
 */

(function NavbarModule() {
  'use strict';

  /* ══════════════════════════════════════════════════════════════
     UTILITY HELPERS
     ══════════════════════════════════════════════════════════════ */

  /**
   * Measures the current scrollbar width and stores it as a CSS variable.
   * Used to prevent layout shift when body overflow is locked.
   */
  function measureScrollbarWidth() {
    const width = window.innerWidth - document.documentElement.clientWidth;
    document.documentElement.style.setProperty('--scrollbar-width', width + 'px');
  }

  /**
   * Returns all focusable elements inside a given container.
   * Used for focus trapping inside the mobile drawer.
   * @param {Element} container
   * @returns {Element[]}
   */
  function getFocusableElements(container) {
    return Array.from(
      container.querySelectorAll(
        'a[href], button:not([disabled]), input:not([disabled]), ' +
        'select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      )
    ).filter(el => !el.closest('[aria-hidden="true"]'));
  }

  /* ══════════════════════════════════════════════════════════════
     NAVBAR LOADER
     Fetches navbar.html and injects it into #navbar-container.
     ══════════════════════════════════════════════════════════════ */

  const NavbarLoader = {
    /**
     * Boot: Load the navbar component, then initialise all controllers.
     */
    init() {
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => this._load());
      } else {
        this._load();
      }
    },

    _load() {
      fetch('navbar.html')
        .then(res => {
          if (!res.ok) throw new Error(`Navbar fetch failed: ${res.status} ${res.statusText}`);
          return res.text();
        })
        .then(html => {
          const container = document.getElementById('navbar-container');
          if (!container) {
            console.warn('[NavbarModule] #navbar-container not found.');
            return;
          }
          container.innerHTML = html;
          this._onInjected();
        })
        .catch(err => console.error('[NavbarModule] Load error:', err));
    },

    _onInjected() {
      // Measure scrollbar width before anything opens a drawer
      measureScrollbarWidth();

      // Boot all controllers in order
      ScrollController.init();
      ActiveLinkCtrl.init();
      HamburgerCtrl.init();
      MobileMenuCtrl.init();
    }
  };

  /* ══════════════════════════════════════════════════════════════
     SCROLL CONTROLLER
     Adds .navbar--scrolled when page scrolls past threshold.
     Uses rAF debounce for 60fps performance. Never hides navbar.
     ══════════════════════════════════════════════════════════════ */

  const ScrollController = {
    THRESHOLD: 12,
    _ticking: false,
    _navbar: null,

    init() {
      this._navbar = document.getElementById('fd-navbar');
      if (!this._navbar) return;

      // Set initial state (in case page loads mid-scroll)
      this._update();

      window.addEventListener('scroll', () => this._onScroll(), { passive: true });
    },

    _onScroll() {
      if (this._ticking) return;
      this._ticking = true;
      window.requestAnimationFrame(() => {
        this._update();
        this._ticking = false;
      });
    },

    _update() {
      if (!this._navbar) return;
      const scrolled = window.scrollY > this.THRESHOLD;
      this._navbar.classList.toggle('navbar--scrolled', scrolled);
    }
  };

  /* ══════════════════════════════════════════════════════════════
     ACTIVE LINK CONTROLLER
     Highlights the link matching the current page URL.
     Works for both .nav-link (desktop) and .nav-drawer__link (mobile).
     ══════════════════════════════════════════════════════════════ */

  const ActiveLinkCtrl = {
    init() {
      const currentFile = window.location.pathname.split('/').pop() || 'index.html';

      // Desktop links
      document.querySelectorAll('.nav-link').forEach(link => {
        const href = link.getAttribute('href');
        if (href === currentFile) {
          link.classList.add('active-link');
          link.setAttribute('aria-current', 'page');
        }
      });

      // Mobile drawer links
      document.querySelectorAll('.nav-drawer__link').forEach(link => {
        const href = link.getAttribute('href');
        if (href === currentFile) {
          link.classList.add('active-link');
          link.setAttribute('aria-current', 'page');
        }
      });
    }
  };

  /* ══════════════════════════════════════════════════════════════
     HAMBURGER CONTROLLER
     Manages ARIA state on the hamburger button.
     Visual animation is pure CSS (no JS needed for the X morph).
     ══════════════════════════════════════════════════════════════ */

  const HamburgerCtrl = {
    _btn: null,

    init() {
      this._btn = document.getElementById('nav-hamburger');
    },

    setOpen(isOpen) {
      if (!this._btn) return;
      this._btn.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
      this._btn.setAttribute('aria-label', isOpen ? 'Close navigation menu' : 'Open navigation menu');
    }
  };

  /* ══════════════════════════════════════════════════════════════
     MOBILE MENU CONTROLLER
     Full-featured drawer controller:
     - Open / close with smooth animation
     - Body scroll lock (with scrollbar-width compensation)
     - Focus trap inside drawer
     - Close on: Escape key, outside click, nav link click, close button
     ══════════════════════════════════════════════════════════════ */

  const MobileMenuCtrl = {
    _isOpen: false,
    _hamburger: null,
    _overlay: null,
    _drawer: null,
    _closeBtn: null,
    _links: null,
    _previouslyFocused: null,

    init() {
      // Cache all DOM refs once
      this._hamburger = document.getElementById('nav-hamburger');
      this._overlay   = document.getElementById('nav-overlay');
      this._drawer    = document.getElementById('nav-drawer');
      this._closeBtn  = document.getElementById('nav-drawer-close');
      this._links     = document.querySelectorAll('.nav-drawer__link, .nav-drawer__cta, .nav-drawer__brand');

      if (!this._hamburger || !this._overlay || !this._drawer) return;

      // Bind events (all bound once — no duplicates)
      this._hamburger.addEventListener('click', () => this._toggle());
      this._overlay.addEventListener('click',   () => this.close());

      if (this._closeBtn) {
        this._closeBtn.addEventListener('click', () => this.close());
      }

      // Close on drawer link navigation
      this._links.forEach(link => {
        link.addEventListener('click', () => this.close());
      });

      // Keyboard: Escape closes, Tab trapped inside
      document.addEventListener('keydown', e => this._handleKeydown(e));
    },

    _toggle() {
      this._isOpen ? this.close() : this.open();
    },

    open() {
      if (this._isOpen) return;
      this._isOpen = true;

      // Remember where focus was
      this._previouslyFocused = document.activeElement;

      // Measure scrollbar before locking
      measureScrollbarWidth();

      // Lock body scroll
      document.body.classList.add('nav-scroll-locked');

      // Activate overlay & drawer
      this._overlay.classList.add('is-active');
      this._overlay.removeAttribute('aria-hidden');
      this._drawer.classList.add('is-open');
      this._drawer.setAttribute('aria-hidden', 'false');

      // Update hamburger state
      HamburgerCtrl.setOpen(true);

      // Move focus into drawer (after transition starts)
      requestAnimationFrame(() => {
        const focusTarget = this._drawer.querySelector('.nav-drawer__close') ||
                            this._drawer.querySelector('.nav-drawer__link');
        if (focusTarget) focusTarget.focus();
      });
    },

    close() {
      if (!this._isOpen) return;
      this._isOpen = false;

      // Unlock body scroll
      document.body.classList.remove('nav-scroll-locked');

      // Deactivate overlay & drawer
      this._overlay.classList.remove('is-active');
      this._overlay.setAttribute('aria-hidden', 'true');
      this._drawer.classList.remove('is-open');
      this._drawer.setAttribute('aria-hidden', 'true');

      // Update hamburger state
      HamburgerCtrl.setOpen(false);

      // Return focus to trigger element
      if (this._previouslyFocused) {
        this._previouslyFocused.focus();
        this._previouslyFocused = null;
      }
    },

    _handleKeydown(e) {
      if (!this._isOpen) return;

      if (e.key === 'Escape') {
        e.preventDefault();
        this.close();
        return;
      }

      // Focus trap: Tab cycles through drawer's focusable elements only
      if (e.key === 'Tab') {
        const focusables = getFocusableElements(this._drawer);
        if (focusables.length === 0) return;

        const first = focusables[0];
        const last  = focusables[focusables.length - 1];

        if (e.shiftKey) {
          // Shift+Tab: if we're at the first element, wrap to last
          if (document.activeElement === first) {
            e.preventDefault();
            last.focus();
          }
        } else {
          // Tab: if we're at the last element, wrap to first
          if (document.activeElement === last) {
            e.preventDefault();
            first.focus();
          }
        }
      }
    }
  };

  /* ══════════════════════════════════════════════════════════════
     BOOT
     ══════════════════════════════════════════════════════════════ */
  NavbarLoader.init();

})();