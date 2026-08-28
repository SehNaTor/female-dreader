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

  filterPills     : document.querySelectorAll('.svc-filter-pill'),
  filterSection   : document.getElementById('svc-filters'),
};

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

  const delay = Math.min(staggerIndex * 0.065, 0.45);
  article.style.animationDelay = delay + 's';

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

  DOM.featuredGrid.innerHTML = '';
  state.featured.forEach((service) => {
    DOM.featuredGrid.appendChild(buildFeaturedCard(service));
  });

  setFeaturedPanel('content');
};

/* ==========================================================================
   RENDER — SERVICES CATALOG
   Called on initial load AND on every category filter change.
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

  DOM.catalogGrid.innerHTML = '';
  state.filtered.forEach((service, idx) => {
    DOM.catalogGrid.appendChild(buildCatalogCard(service, idx));
  });

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

  } catch (err) {
    console.error('[Female Dreader Services] Fetch failed:', err);
    state.isLoading = false;
    state.hasError  = true;
    setFeaturedPanel('error');
    setCatalogPanel('error');
  }
};

/* ==========================================================================
   CATEGORY FILTER
   ========================================================================== */

const setActiveFilter = (category) => {
  state.activeCategory = category;

  DOM.filterPills.forEach((pill) => {
    const isActive = pill.dataset.category === category;
    pill.classList.toggle('svc-filter-pill--active', isActive);
    pill.setAttribute('aria-pressed', String(isActive));
  });

  renderCatalog();
};

const initFilters = () => {
  DOM.filterPills.forEach((pill) => {
    pill.addEventListener('click', () => setActiveFilter(pill.dataset.category));
  });
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
  initEmptyReset();
  initRetryButtons();
  initStickyFilter();
  initKeyboardNav();
  initBookingModal();
  fetchServices();
});
