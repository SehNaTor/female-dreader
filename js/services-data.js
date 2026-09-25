/* ==========================================================================
   FEMALE DREADER — SERVICES & PRICING PAGE
   js/services-data.js

   Architecture:
   Single source of truth: services table in Supabase
   Columns: id, image_url, name, description, category,
            price, duration, featured, active, display_order

   Sections:
   1. Featured Services  — services WHERE featured = true
   2. All Services Catalog — services WHERE active = true (filterable by category)

   Booking: Modal launched directly from cards. No page redirect.

   Performance optimizations:
   - IntersectionObserver-based card reveal (no animation-delay stacking)
   - DocumentFragment batch DOM insertions
   - Debounced scroll events
   - GPU-composited animations via CSS classes
   - Mobile dropdown filter with outside-click dismissal
   ========================================================================== */

import { supabase } from './supabase.js';
import { initBookingModal } from './booking-modal.js';

/* ==========================================================================
   STATE
   ========================================================================== */

const state = {
  allServices:    [],
  filtered:       [],
  featured:       [],
  activeCategory: 'all',
  isLoading:      true,
  hasError:       false,
};

/* ==========================================================================
   DOM REFERENCES
   ========================================================================== */

const DOM = {
  featuredLoading : document.getElementById('featured-loading'),
  featuredGrid    : document.getElementById('featured-grid'),
  featuredEmpty   : document.getElementById('featured-empty'),
  featuredError   : document.getElementById('featured-error'),
  featuredRetry   : document.getElementById('featured-retry'),

  catalogLoading  : document.getElementById('catalog-loading'),
  catalogGrid     : document.getElementById('catalog-grid'),
  catalogEmpty    : document.getElementById('catalog-empty'),
  catalogError    : document.getElementById('catalog-error'),
  catalogRetry    : document.getElementById('catalog-retry'),
  catalogCount    : document.getElementById('catalog-count'),
  emptyReset      : document.getElementById('empty-reset'),

  filterPills     : document.querySelectorAll('.svc-filter__nav .svc-filter-pill'),
  filterSection   : document.getElementById('svc-filters'),

  /* Mobile filter dropdown elements */
  mobileToggle    : document.getElementById('filter-mobile-toggle'),
  filterDropdown  : document.getElementById('filter-dropdown'),
  dropdownGrid    : document.getElementById('filter-dropdown-grid'),
  activeLabel     : null, // set after mobile toggle is found
};

/* Cache the active label span inside the mobile toggle */
if (DOM.mobileToggle) {
  DOM.activeLabel = DOM.mobileToggle.querySelector('.svc-filter__active-label');
}

/* ==========================================================================
   VISIBILITY HELPERS
   ========================================================================== */

const hide = (el) => {
  if (!el) return;
  el.hidden = true;
  el.style.display = 'none';
};

const show = (el, display = 'block') => {
  if (!el) return;
  el.hidden = false;
  el.style.display = display;
};

/* ==========================================================================
   PANEL STATE MACHINE
   Always resets all panels before activating one.
   ========================================================================== */

const setFeaturedPanel = (panelState) => {
  hide(DOM.featuredLoading);
  hide(DOM.featuredGrid);
  hide(DOM.featuredEmpty);
  hide(DOM.featuredError);

  switch (panelState) {
    case 'loading': show(DOM.featuredLoading, 'grid'); break;
    case 'content': show(DOM.featuredGrid,    'grid'); break;
    case 'empty':   show(DOM.featuredEmpty,   'flex'); break;
    case 'error':   show(DOM.featuredError,   'flex'); break;
  }
};

const setCatalogPanel = (panelState) => {
  hide(DOM.catalogLoading);
  hide(DOM.catalogGrid);
  hide(DOM.catalogEmpty);
  hide(DOM.catalogError);

  switch (panelState) {
    case 'loading': show(DOM.catalogLoading, 'grid'); break;
    case 'content': show(DOM.catalogGrid,    'grid'); break;
    case 'empty':   show(DOM.catalogEmpty,   'flex'); break;
    case 'error':   show(DOM.catalogError,   'flex'); break;
  }
};

/* ==========================================================================
   UTILITIES
   ========================================================================== */

const formatPrice = (price) => {
  if (price === null || price === undefined || price === '') return 'On Request';
  const numeric = parseFloat(String(price).replace(/[^0-9.]/g, ''));
  if (isNaN(numeric)) return String(price);
  return '\u20a6' + numeric.toLocaleString('en-NG');
};

const sanitize = (str) => {
  if (str === null || str === undefined) return '';
  const div = document.createElement('div');
  div.textContent = String(str);
  return div.innerHTML;
};

/* ==========================================================================
   LAZY IMAGE LOADING — IntersectionObserver
   Images use data-src, loaded when within 300px of viewport.
   Broken images replaced with a styled placeholder.
   ========================================================================== */

const imageObserver = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;

      const img = entry.target;
      const src = img.dataset.src;
      if (!src) return;

      img.src = src;

      img.addEventListener('load', () => {
        img.classList.add('img-loaded');
      }, { once: true });

      img.addEventListener('error', () => {
        const placeholder = document.createElement('div');
        placeholder.className = img.closest('.svc-featured-card')
          ? 'svc-featured-card__img-placeholder'
          : 'svc-card__img-placeholder';
        placeholder.setAttribute('aria-hidden', 'true');
        placeholder.innerHTML = '<i class="fa-solid fa-scissors"></i><span>Image unavailable</span>';
        img.replaceWith(placeholder);
      }, { once: true });

      imageObserver.unobserve(img);
    });
  },
  { rootMargin: '300px 0px', threshold: 0 }
);

/* ==========================================================================
   CARD REVEAL — IntersectionObserver
   Replaces animation-delay stacking with on-demand GPU-composited reveals.
   Cards start hidden (opacity:0, transform:translateY) and get the
   .svc-card--visible class when they enter the viewport.
   ========================================================================== */

const cardRevealObserver = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('svc-card--visible');
        cardRevealObserver.unobserve(entry.target);
      }
    });
  },
  { rootMargin: '50px 0px', threshold: 0.05 }
);

/* ==========================================================================
   CARD BUILDER — FEATURED SERVICE CARD
   ========================================================================== */

const buildFeaturedCard = (service) => {
  const name     = sanitize(service.name        ?? 'Service');
  const desc     = sanitize(service.description ?? '');
  const category = sanitize(service.category    ?? '');
  const price    = formatPrice(service.price);
  const duration = sanitize(service.duration    ?? '');
  const imgUrl   = service.image_url ?? '';

  const servicePayload = JSON.stringify({
    id:        service.id        ?? null,
    name:      service.name      ?? '',
    category:  service.category  ?? '',
    price:     service.price     ?? null,
    duration:  service.duration  ?? '',
    image_url: service.image_url ?? '',
  });

  const article = document.createElement('article');
  article.className = 'svc-featured-card';
  article.setAttribute('role', 'listitem');
  article.setAttribute('aria-label', 'Featured service: ' + name);

  article.innerHTML = `
    <div class="svc-featured-card__img-wrap">
      <div class="svc-featured-badge" aria-label="Featured service">
        <i class="fa-solid fa-crown" aria-hidden="true"></i>
        Featured
      </div>
      ${imgUrl
        ? `<img
             class="svc-featured-card__img img-lazy"
             data-src="${sanitize(imgUrl)}"
             src=""
             alt="${name} hairstyle at Female Dreader"
             loading="lazy"
             width="600"
             height="500"
           >`
        : `<div class="svc-featured-card__img-placeholder" aria-hidden="true">
             <i class="fa-solid fa-scissors"></i>
             <span>No image</span>
           </div>`
      }
      ${category
        ? `<span class="svc-featured-card__category">${category}</span>`
        : ''
      }
    </div>

    <div class="svc-featured-card__body">
      <h3 class="svc-featured-card__name">${name}</h3>
      ${desc
        ? `<p class="svc-featured-card__description">${desc}</p>`
        : ''
      }

      <div class="svc-featured-card__meta">
        <div class="svc-featured-card__price">
          <span class="svc-price-label">Starting from</span>
          <span class="svc-price-value" aria-label="Price: ${price}">${price}</span>
        </div>
        ${duration
          ? `<div class="svc-featured-card__duration">
               <i class="fa-regular fa-clock" aria-hidden="true"></i>
               ${duration}
             </div>`
          : ''
        }
      </div>

      <button
        type="button"
        class="svc-featured-card__book-btn"
        data-book-service='${servicePayload}'
        aria-label="Book ${name} appointment"
      >
        <i class="fa-solid fa-calendar-plus" aria-hidden="true"></i>
        Book Appointment
      </button>
    </div>
  `;

  const lazyImg = article.querySelector('.img-lazy');
  if (lazyImg) imageObserver.observe(lazyImg);

  return article;
};

/* ==========================================================================
   CARD BUILDER — CATALOG SERVICE CARD
   Uses IntersectionObserver for staggered reveal instead of CSS animation-delay
   ========================================================================== */

const buildCatalogCard = (service, staggerIndex = 0) => {
  const name     = sanitize(service.name        ?? 'Service');
  const desc     = sanitize(service.description ?? '');
  const category = sanitize(service.category    ?? '');
  const price    = formatPrice(service.price);
  const duration = sanitize(service.duration    ?? '');
  const imgUrl   = service.image_url ?? '';

  const servicePayload = JSON.stringify({
    id:        service.id        ?? null,
    name:      service.name      ?? '',
    category:  service.category  ?? '',
    price:     service.price     ?? null,
    duration:  service.duration  ?? '',
    image_url: service.image_url ?? '',
  });

  const article = document.createElement('article');
  article.className = 'svc-card';
  article.setAttribute('role', 'listitem');
  article.setAttribute('aria-label', name + ' \u2014 ' + price);
  article.dataset.category = service.category ?? '';

  /* Stagger the reveal animation via CSS custom property */
  const delay = Math.min(staggerIndex * 0.06, 0.4);
  article.style.setProperty('--reveal-delay', delay + 's');

  article.innerHTML = `
    <div class="svc-card__img-wrap">
      ${imgUrl
        ? `<img
             class="svc-card__img img-lazy"
             data-src="${sanitize(imgUrl)}"
             src=""
             alt="${name} hairstyle at Female Dreader"
             loading="lazy"
             width="400"
             height="900"
           >`
        : `<div class="svc-card__img-placeholder" aria-hidden="true">
             <i class="fa-solid fa-scissors"></i>
             <span>No image</span>
           </div>`
      }
      ${category
        ? `<span class="svc-card__category">${category}</span>`
        : ''
      }
    </div>

    <div class="svc-card__body">
      <h3 class="svc-card__name">${name}</h3>
      ${desc
        ? `<p class="svc-card__description">${desc}</p>`
        : ''
      }

      <div class="svc-card__meta">
        <span class="svc-card__price" aria-label="Price: ${price}">${price}</span>
        ${duration
          ? `<span class="svc-card__duration">
               <i class="fa-regular fa-clock" aria-hidden="true"></i>
               ${duration}
             </span>`
          : ''
        }
      </div>

      <button
        type="button"
        class="svc-card__book-btn"
        data-book-service='${servicePayload}'
        aria-label="Book ${name} appointment"
      >
        <i class="fa-solid fa-calendar-check" aria-hidden="true"></i>
        Book Appointment
      </button>
    </div>
  `;

  const lazyImg = article.querySelector('.img-lazy');
  if (lazyImg) imageObserver.observe(lazyImg);

  /* Observe for scroll-triggered reveal */
  cardRevealObserver.observe(article);

  return article;
};

/* ==========================================================================
   RENDER — FEATURED SERVICES
   ========================================================================== */

const renderFeatured = () => {
  if (state.featured.length === 0) {
    setFeaturedPanel('empty');
    return;
  }

  const fragment = document.createDocumentFragment();
  state.featured.forEach((service) => {
    fragment.appendChild(buildFeaturedCard(service));
  });

  DOM.featuredGrid.innerHTML = '';
  DOM.featuredGrid.appendChild(fragment);

  setFeaturedPanel('content');
};

/* ==========================================================================
   RENDER — SERVICES CATALOG
   Called on initial load AND on every category filter change.
   Uses DocumentFragment for batch DOM insertion (avoids layout thrashing).
   ========================================================================== */

const renderCatalog = () => {
  const category = state.activeCategory;

  state.filtered = category === 'all'
    ? [...state.allServices]
    : state.allServices.filter((service) => {
        const cat = (service.category ?? '').trim();
        return cat.toLowerCase() === category.toLowerCase();
      });

  if (DOM.catalogCount) {
    const count = state.filtered.length;
    DOM.catalogCount.textContent = count > 0
      ? count + ' service' + (count !== 1 ? 's' : '') + ' found'
      : '';
  }

  if (state.filtered.length === 0) {
    setCatalogPanel('empty');
    return;
  }

  /* Batch DOM insertion via DocumentFragment */
  const fragment = document.createDocumentFragment();
  state.filtered.forEach((service, idx) => {
    fragment.appendChild(buildCatalogCard(service, idx));
  });

  DOM.catalogGrid.innerHTML = '';
  DOM.catalogGrid.appendChild(fragment);

  setCatalogPanel('content');
};

/* ==========================================================================
   DATA FETCH — SUPABASE
   Single query from services table.
   ========================================================================== */

const fetchServices = async () => {
  state.isLoading = true;
  state.hasError  = false;

  setFeaturedPanel('loading');
  setCatalogPanel('loading');

  try {
    const { data, error } = await supabase
      .from('services')
      .select(`
        id,
        image_url,
        name,
        description,
        category,
        price,
        duration,
        featured,
        active,
        display_order
      `)
      .eq('active', true)
      .order('display_order', { ascending: true });

    if (error) throw error;

    state.allServices = Array.isArray(data) ? data : [];
    state.featured    = state.allServices.filter((s) => s.featured === true);
    state.isLoading   = false;
    state.hasError    = false;

    renderFeatured();
    renderCatalog();

    /* After data loads, inject category counts into filter pills */
    updateFilterCounts();

  } catch (err) {
    console.error('[Female Dreader Services] Fetch failed:', err);
    state.isLoading = false;
    state.hasError  = true;
    setFeaturedPanel('error');
    setCatalogPanel('error');
  }
};

/* ==========================================================================
   FILTER COUNTS — Badge showing how many services per category
   ========================================================================== */

const updateFilterCounts = () => {
  /* Count services per category */
  const counts = { all: state.allServices.length };
  state.allServices.forEach((s) => {
    const cat = (s.category ?? '').trim();
    if (cat) {
      counts[cat] = (counts[cat] || 0) + 1;
    }
  });

  /* Update desktop pills */
  DOM.filterPills.forEach((pill) => {
    const cat = pill.dataset.category;
    const count = cat === 'all' ? counts.all : (counts[cat] || 0);

    /* Remove existing count badge if any */
    const existing = pill.querySelector('.svc-filter-pill__count');
    if (existing) existing.remove();

    const badge = document.createElement('span');
    badge.className = 'svc-filter-pill__count';
    badge.textContent = count;
    pill.appendChild(badge);
  });

  /* Update dropdown pills */
  if (DOM.dropdownGrid) {
    DOM.dropdownGrid.querySelectorAll('.svc-filter-pill').forEach((pill) => {
      const cat = pill.dataset.category;
      const count = cat === 'all' ? counts.all : (counts[cat] || 0);

      const existing = pill.querySelector('.svc-filter-pill__count');
      if (existing) existing.remove();

      const badge = document.createElement('span');
      badge.className = 'svc-filter-pill__count';
      badge.textContent = count;
      pill.appendChild(badge);
    });
  }
};

/* ==========================================================================
   CATEGORY FILTER
   ========================================================================== */

const setActiveFilter = (category) => {
  state.activeCategory = category;

  /* Update desktop pills */
  DOM.filterPills.forEach((pill) => {
    const isActive = pill.dataset.category === category;
    pill.classList.toggle('svc-filter-pill--active', isActive);
    pill.setAttribute('aria-pressed', String(isActive));
  });

  /* Update dropdown pills */
  if (DOM.dropdownGrid) {
    DOM.dropdownGrid.querySelectorAll('.svc-filter-pill').forEach((pill) => {
      const isActive = pill.dataset.category === category;
      pill.classList.toggle('svc-filter-pill--active', isActive);
      pill.setAttribute('aria-pressed', String(isActive));
    });
  }

  /* Update mobile toggle label */
  if (DOM.activeLabel) {
    const activePill = document.querySelector(`.svc-filter__nav .svc-filter-pill[data-category="${category}"]`);
    const labelText = activePill
      ? activePill.textContent.replace(/\d+$/, '').trim()
      : 'All Services';
    DOM.activeLabel.textContent = labelText;
  }

  renderCatalog();
};

const initFilters = () => {
  /* Desktop inline pills */
  DOM.filterPills.forEach((pill) => {
    pill.addEventListener('click', () => setActiveFilter(pill.dataset.category));
  });
};

/* ==========================================================================
   MOBILE FILTER DROPDOWN
   Toggle button opens a dropdown with filter pills for small screens.
   ========================================================================== */

const initMobileFilter = () => {
  if (!DOM.mobileToggle || !DOM.filterDropdown || !DOM.dropdownGrid) return;

  /* Clone pills from the inline nav into the dropdown grid */
  DOM.filterPills.forEach((pill) => {
    const clone = pill.cloneNode(true);
    /* Remove the id to avoid duplicates */
    clone.removeAttribute('id');

    clone.addEventListener('click', () => {
      setActiveFilter(clone.dataset.category);
      closeMobileDropdown();
    });

    DOM.dropdownGrid.appendChild(clone);
  });

  /* Toggle dropdown open/close */
  DOM.mobileToggle.addEventListener('click', (e) => {
    e.stopPropagation();
    const isOpen = DOM.filterDropdown.classList.contains('is-open');
    if (isOpen) {
      closeMobileDropdown();
    } else {
      openMobileDropdown();
    }
  });

  /* Close on outside click */
  document.addEventListener('click', (e) => {
    if (!DOM.filterSection.contains(e.target)) {
      closeMobileDropdown();
    }
  });

  /* Close on Escape key */
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeMobileDropdown();
    }
  });
};

const openMobileDropdown = () => {
  DOM.filterDropdown.classList.add('is-open');
  DOM.mobileToggle.classList.add('is-open');
  DOM.mobileToggle.setAttribute('aria-expanded', 'true');
};

const closeMobileDropdown = () => {
  DOM.filterDropdown.classList.remove('is-open');
  DOM.mobileToggle.classList.remove('is-open');
  DOM.mobileToggle.setAttribute('aria-expanded', 'false');
};

/* ==========================================================================
   EMPTY STATE RESET BUTTON
   ========================================================================== */

const initEmptyReset = () => {
  if (!DOM.emptyReset) return;
  DOM.emptyReset.addEventListener('click', () => setActiveFilter('all'));
};

/* ==========================================================================
   RETRY BUTTONS
   ========================================================================== */

const initRetryButtons = () => {
  if (DOM.featuredRetry) DOM.featuredRetry.addEventListener('click', fetchServices);
  if (DOM.catalogRetry)  DOM.catalogRetry.addEventListener('click', fetchServices);
};

/* ==========================================================================
   STICKY FILTER BAR — SCROLL SHADOW
   ========================================================================== */

const initStickyFilter = () => {
  if (!DOM.filterSection) return;

  const sentinel = document.createElement('div');
  sentinel.style.cssText = 'position:absolute;top:0;height:1px;width:1px;pointer-events:none;opacity:0;';
  sentinel.setAttribute('aria-hidden', 'true');
  document.body.prepend(sentinel);

  const observer = new IntersectionObserver(
    ([entry]) => {
      DOM.filterSection.classList.toggle('scrolled', !entry.isIntersecting);
    },
    { threshold: 0, rootMargin: '0px' }
  );

  observer.observe(sentinel);
};

/* ==========================================================================
   KEYBOARD NAVIGATION — FOCUS VISIBILITY
   ========================================================================== */

const initKeyboardNav = () => {
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Tab') document.body.classList.add('keyboard-nav');
  });
  document.addEventListener('mousedown', () => {
    document.body.classList.remove('keyboard-nav');
  });
};

/* ==========================================================================
   ENTRY POINT
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {
  initFilters();
  initMobileFilter();
  initEmptyReset();
  initRetryButtons();
  initStickyFilter();
  initKeyboardNav();
  initBookingModal();
  fetchServices();
});
