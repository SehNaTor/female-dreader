import { supabase } from './supabase.js';
import { formatPrice } from './order-utils.js';
import { cartManager } from './cart-manager.js';
import { CartUI } from './cart-ui.js';
import { CheckoutManager } from './checkout-manager.js';
import { toast } from './toast.js';

/* ======================================
   STATE
   ====================================== */
let allProducts = [];
let currentCategory = 'all';

/* ======================================
   DOM REFERENCES
   ====================================== */
const DOM = {
  featuredGrid    : document.getElementById('featured-grid'),
  featuredEmpty   : document.getElementById('featured-empty'),
  featuredError   : document.getElementById('featured-error'),
  featuredRetry   : document.getElementById('featured-retry'),

  catalogGrid     : document.getElementById('catalog-grid'),
  catalogEmpty    : document.getElementById('catalog-empty'),
  catalogError    : document.getElementById('catalog-error'),
  catalogRetry    : document.getElementById('catalog-retry'),
  catalogCount    : document.getElementById('catalog-count'),
  emptyReset      : document.getElementById('empty-reset'),

  filterPills     : document.querySelectorAll('.prd-filter__nav .prd-filter-pill'),
  filterSection   : document.getElementById('prd-filters'),

  /* Mobile filter dropdown elements */
  mobileToggle    : document.getElementById('prd-filter-mobile-toggle'),
  filterDropdown  : document.getElementById('prd-filter-dropdown'),
  dropdownGrid    : document.getElementById('prd-filter-dropdown-grid'),
  activeLabel     : null,

  /* Modals */
  detailsModal    : document.getElementById('prd-details-modal'),
  orderModal      : document.getElementById('prd-order-modal'),
};

/* Cache the active label span inside the mobile toggle */
if (DOM.mobileToggle) {
  DOM.activeLabel = DOM.mobileToggle.querySelector('.prd-filter__active-label');
}

/* ======================================
   INTERSECTION OBSERVER — CARD REVEAL
   Replaces immediate rendering with scroll-triggered GPU reveals.
   ====================================== */
const cardRevealObserver = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('prd-card--visible');
        cardRevealObserver.unobserve(entry.target);
      }
    });
  },
  { rootMargin: '50px 0px', threshold: 0.05 }
);

/* ======================================
   FETCH PRODUCTS
   ====================================== */
async function fetchProducts() {
  try {
    // Show loading state by injecting skeletons directly into main grids
    DOM.featuredEmpty.hidden = true;
    DOM.featuredError.hidden = true;
    DOM.featuredGrid.innerHTML = Array(4).fill('').map(() => `
      <div class="prd-skeleton prd-skeleton--featured" aria-hidden="true">
        <div class="prd-skeleton__img"></div>
        <div class="prd-skeleton__body">
          <div class="prd-skeleton__line prd-skeleton__line--sm"></div>
          <div class="prd-skeleton__line prd-skeleton__line--lg"></div>
          <div class="prd-skeleton__line prd-skeleton__line--md"></div>
          <div class="prd-skeleton__line prd-skeleton__line--price"></div>
          <div class="prd-skeleton__line prd-skeleton__line--btn"></div>
        </div>
      </div>
    `).join('');

    DOM.catalogEmpty.hidden = true;
    DOM.catalogError.hidden = true;
    DOM.catalogGrid.innerHTML = Array(8).fill('').map(() => `
      <div class="prd-skeleton" aria-hidden="true">
        <div class="prd-skeleton__img"></div>
        <div class="prd-skeleton__body">
          <div class="prd-skeleton__line prd-skeleton__line--sm"></div>
          <div class="prd-skeleton__line prd-skeleton__line--lg"></div>
          <div class="prd-skeleton__line prd-skeleton__line--md"></div>
          <div class="prd-skeleton__line prd-skeleton__line--price"></div>
          <div class="prd-skeleton__line prd-skeleton__line--btn"></div>
        </div>
      </div>
    `).join('');

    const { data, error } = await supabase
      .from('products')
      .select('id, name, description, image_url, category, price, stock, featured, status, display_order')
      .eq('status', 'active')
      .order('display_order', { ascending: true });

    // Diagnostic logging
    console.group('[Products] Supabase fetch');
    console.log('Query error:', error);
    console.log('Returned records:', data);
    console.log('Record count:', data ? data.length : 0);
    console.groupEnd();

    if (error) throw error;

    allProducts = data || [];
    window.__femaleDreaderProducts = allProducts;

    renderFeaturedProducts();
    renderCatalogProducts();

    /* After data loads, inject category counts into filter pills */
    updateFilterCounts();

  } catch (error) {
    console.error('[Products] Fetch failed:', error);

    DOM.featuredGrid.innerHTML = '';
    DOM.featuredError.hidden = false;

    DOM.catalogGrid.innerHTML = '';
    DOM.catalogError.hidden = false;
  }
}

/* ======================================
   RENDER LOGIC
   ====================================== */
function createProductCard(product) {
  const card = document.createElement('div');
  card.className = 'prd-card';
  card.setAttribute('role', 'listitem');
  card.dataset.id = product.id;

  card.innerHTML = `
    <div class="prd-card__img-wrapper">
      <img src="${product.image_url}" alt="${product.name}" class="prd-card__img" loading="lazy">
      <div class="prd-card__badge">${product.category}</div>
    </div>
    <div class="prd-card__body">
      <span class="prd-card__category">${product.category}</span>
      <h3 class="prd-card__title">${product.name}</h3>
      <p class="prd-card__desc">${product.description}</p>
      <div class="prd-card__footer">
        <span class="prd-card__price">${formatPrice(product.price)}</span>
        <div class="prd-card__actions">
          <button class="prd-card__secondary" data-buy-now data-product-id="${product.id}" aria-label="Buy now">Buy Now</button>
          <button class="prd-card__primary" data-add-to-cart data-product-id="${product.id}" aria-label="Add to cart">Add to Cart</button>
        </div>
      </div>
    </div>
  `;

  card.addEventListener('click', (event) => {
    if (event.target.closest('[data-add-to-cart], [data-buy-now]')) return;
    openDetailsModal(product);
  });

  /* Observe for scroll-triggered reveal */
  cardRevealObserver.observe(card);

  return card;
}

function renderFeaturedProducts() {
  const featured = allProducts.filter(p => p.featured === true);

  if (featured.length === 0) {
    DOM.featuredGrid.innerHTML = '';
    DOM.featuredEmpty.hidden = false;
    return;
  }

  /* Batch DOM insertion via DocumentFragment */
  const fragment = document.createDocumentFragment();
  featured.forEach(product => {
    fragment.appendChild(createProductCard(product));
  });

  DOM.featuredGrid.innerHTML = '';
  DOM.featuredGrid.appendChild(fragment);
  DOM.featuredEmpty.hidden = true;
}

function renderCatalogProducts() {
  const filtered = currentCategory === 'all'
    ? allProducts
    : allProducts.filter(p => p.category === currentCategory);

  DOM.catalogCount.textContent = `Showing ${filtered.length} product${filtered.length !== 1 ? 's' : ''}`;

  if (filtered.length === 0) {
    DOM.catalogGrid.innerHTML = '';
    DOM.catalogEmpty.hidden = false;
    return;
  }

  /* Batch DOM insertion via DocumentFragment */
  const fragment = document.createDocumentFragment();
  filtered.forEach(product => {
    fragment.appendChild(createProductCard(product));
  });

  DOM.catalogGrid.innerHTML = '';
  DOM.catalogGrid.appendChild(fragment);
  DOM.catalogEmpty.hidden = true;
}

/* ======================================
   FILTER COUNTS — Badge showing how many products per category
   ====================================== */
function updateFilterCounts() {
  /* Count products per category */
  const counts = { all: allProducts.length };
  allProducts.forEach((p) => {
    const cat = (p.category ?? '').trim();
    if (cat) {
      counts[cat] = (counts[cat] || 0) + 1;
    }
  });

  /* Update desktop pills */
  DOM.filterPills.forEach((pill) => {
    const cat = pill.dataset.category;
    const count = cat === 'all' ? counts.all : (counts[cat] || 0);

    const existing = pill.querySelector('.prd-filter-pill__count');
    if (existing) existing.remove();

    const badge = document.createElement('span');
    badge.className = 'prd-filter-pill__count';
    badge.textContent = count;
    pill.appendChild(badge);
  });

  /* Update dropdown pills */
  if (DOM.dropdownGrid) {
    DOM.dropdownGrid.querySelectorAll('.prd-filter-pill').forEach((pill) => {
      const cat = pill.dataset.category;
      const count = cat === 'all' ? counts.all : (counts[cat] || 0);

      const existing = pill.querySelector('.prd-filter-pill__count');
      if (existing) existing.remove();

      const badge = document.createElement('span');
      badge.className = 'prd-filter-pill__count';
      badge.textContent = count;
      pill.appendChild(badge);
    });
  }
}

/* ======================================
   FILTER LOGIC
   ====================================== */
function setActiveFilter(category) {
  currentCategory = category;

  /* Update desktop pills */
  DOM.filterPills.forEach(p => {
    const isActive = p.dataset.category === category;
    p.classList.toggle('prd-filter-pill--active', isActive);
    p.setAttribute('aria-pressed', String(isActive));
  });

  /* Update dropdown pills */
  if (DOM.dropdownGrid) {
    DOM.dropdownGrid.querySelectorAll('.prd-filter-pill').forEach(p => {
      const isActive = p.dataset.category === category;
      p.classList.toggle('prd-filter-pill--active', isActive);
      p.setAttribute('aria-pressed', String(isActive));
    });
  }

  /* Update mobile toggle label */
  if (DOM.activeLabel) {
    const activePill = document.querySelector(`.prd-filter__nav .prd-filter-pill[data-category="${category}"]`);
    const labelText = activePill
      ? activePill.textContent.replace(/\d+$/, '').trim()
      : 'All Products';
    DOM.activeLabel.textContent = labelText;
  }

  renderCatalogProducts();
}

function initFilters() {
  /* Desktop inline pills */
  DOM.filterPills.forEach(pill => {
    pill.addEventListener('click', () => setActiveFilter(pill.dataset.category));
  });
}

/* ======================================
   MOBILE FILTER DROPDOWN
   Toggle button opens a dropdown with filter pills for small screens.
   ====================================== */
function initMobileFilter() {
  if (!DOM.mobileToggle || !DOM.filterDropdown || !DOM.dropdownGrid) return;

  /* Clone pills from the inline nav into the dropdown grid */
  DOM.filterPills.forEach((pill) => {
    const clone = pill.cloneNode(true);
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
    if (e.key === 'Escape' && DOM.filterDropdown.classList.contains('is-open')) {
      closeMobileDropdown();
    }
  });
}

function openMobileDropdown() {
  DOM.filterDropdown.classList.add('is-open');
  DOM.mobileToggle.classList.add('is-open');
  DOM.mobileToggle.setAttribute('aria-expanded', 'true');
}

function closeMobileDropdown() {
  DOM.filterDropdown.classList.remove('is-open');
  DOM.mobileToggle.classList.remove('is-open');
  DOM.mobileToggle.setAttribute('aria-expanded', 'false');
}

/* ======================================
   STICKY FILTER BAR — SCROLL SHADOW
   ====================================== */
function initStickyFilter() {
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
}

/* ======================================
   EMPTY STATE RESET
   ====================================== */
function initEmptyReset() {
  if (!DOM.emptyReset) return;
  DOM.emptyReset.addEventListener('click', () => setActiveFilter('all'));
}

/* ======================================
   MODAL LOGIC
   ====================================== */
function openDetailsModal(product) {
  document.getElementById('modal-product-img').src = product.image_url;
  document.getElementById('modal-product-img').alt = product.name;
  document.getElementById('modal-product-category').textContent = product.category;
  document.getElementById('modal-product-name').textContent = product.name;
  document.getElementById('modal-product-price').textContent = formatPrice(product.price);
  document.getElementById('modal-product-desc').textContent = product.description;

  const orderBtn = document.getElementById('modal-order-btn');
  const newOrderBtn = orderBtn.cloneNode(true);
  orderBtn.parentNode.replaceChild(newOrderBtn, orderBtn);

  newOrderBtn.addEventListener('click', () => {
    closeModal(DOM.detailsModal);
    cartManager.clear();
    cartManager.addItem(product, 1);
    checkoutManager.open();
  });

  DOM.detailsModal.classList.add('is-active');
  DOM.detailsModal.setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';
}

function closeModal(modal) {
  modal.classList.remove('is-active');
  modal.setAttribute('aria-hidden', 'true');
  document.body.style.overflow = '';
}

function initModals() {
  document.querySelectorAll('[data-close-modal]').forEach(el => {
    el.addEventListener('click', () => closeModal(DOM.detailsModal));
  });
  document.querySelectorAll('[data-close-order]').forEach(el => {
    el.addEventListener('click', () => closeModal(DOM.orderModal));
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (DOM.detailsModal.classList.contains('is-active')) closeModal(DOM.detailsModal);
      if (DOM.orderModal.classList.contains('is-active')) closeModal(DOM.orderModal);
    }
  });
}

/* ======================================
   CHECKOUT INTEGRATION
   ====================================== */
window.__femaleDreaderProducts = [];

const cartUi = new CartUI({
  onCheckoutStart: () => {
    checkoutManager.open();
  },
  onContinueShopping: () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
});

const checkoutManager = new CheckoutManager({
  onSuccess: (order) => {
    const successStage = document.getElementById('checkout-success-stage');
    const formStage = document.getElementById('prd-order-form');
    if (successStage) {
      successStage.hidden = false;
      successStage.innerHTML = `
        <div class="checkout-success-stage__card">
          <h4>Order confirmed</h4>
          <p>Your order number is <strong>${order.order_number}</strong>.</p>
          <p>We will contact you soon to confirm your delivery and next steps.</p>
        </div>
      `;
    }
    if (formStage) {
      formStage.style.display = 'none';
    }
    toast.show(`Order ${order.order_number} received`, 'success');
  },
  onCancel: () => {
    const successStage = document.getElementById('checkout-success-stage');
    const formStage = document.getElementById('prd-order-form');
    if (successStage) successStage.hidden = true;
    if (formStage) formStage.style.display = '';
  }
});

cartManager.subscribe(() => {
  const drawer = document.getElementById('cart-drawer-content');
  if (drawer) {
    drawer.innerHTML = cartUi.buildDrawerMarkup(cartManager.getSnapshot());
  }
});

/* ======================================
   RETRY BUTTONS
   ====================================== */
function initRetryButtons() {
  if (DOM.featuredRetry) DOM.featuredRetry.addEventListener('click', fetchProducts);
  if (DOM.catalogRetry) DOM.catalogRetry.addEventListener('click', fetchProducts);
}

/* ======================================
   INITIALIZE
   ====================================== */
document.addEventListener('DOMContentLoaded', () => {
  initFilters();
  initMobileFilter();
  initEmptyReset();
  initRetryButtons();
  initStickyFilter();
  initModals();
  fetchProducts();
  cartManager.load();
  cartUi.render();
});
