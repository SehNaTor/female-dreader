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

// Elements
const featuredGrid = document.getElementById('featured-grid');
const featuredEmpty = document.getElementById('featured-empty');
const featuredError = document.getElementById('featured-error');
const featuredRetryBtn = document.getElementById('featured-retry');

const catalogGrid = document.getElementById('catalog-grid');
const catalogEmpty = document.getElementById('catalog-empty');
const catalogError = document.getElementById('catalog-error');
const catalogRetryBtn = document.getElementById('catalog-retry');
const catalogCount = document.getElementById('catalog-count');
const emptyResetBtn = document.getElementById('empty-reset');

// Filter Elements
const filterPills = document.querySelectorAll('.prd-filter-pill');

// Modal Elements
const detailsModal = document.getElementById('prd-details-modal');
const orderModal = document.getElementById('prd-order-modal');

/* ======================================
   FETCH PRODUCTS
====================================== */
async function fetchProducts() {
  try {
    // Show loading state by injecting skeletons directly into main grids
    featuredEmpty.hidden = true;
    featuredError.hidden = true;
    featuredGrid.innerHTML = Array(4).fill('').map(() => `
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

    catalogEmpty.hidden = true;
    catalogError.hidden = true;
    catalogGrid.innerHTML = Array(8).fill('').map(() => `
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

  } catch (error) {
    console.error('[Products] Fetch failed:', error);

    featuredGrid.innerHTML = '';
    featuredError.hidden = false;

    catalogGrid.innerHTML = '';
    catalogError.hidden = false;
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

  return card;
}

function renderFeaturedProducts() {
  featuredGrid.innerHTML = '';
  
  const featured = allProducts.filter(p => p.featured === true);
  
  if (featured.length === 0) {
    featuredEmpty.hidden = false;
    return;
  }

  featured.forEach(product => {
    featuredGrid.appendChild(createProductCard(product));
  });

  featuredEmpty.hidden = true;
}

function renderCatalogProducts() {
  catalogGrid.innerHTML = '';
  
  const filtered = currentCategory === 'all' 
    ? allProducts 
    : allProducts.filter(p => p.category === currentCategory);

  catalogCount.textContent = `Showing ${filtered.length} product${filtered.length !== 1 ? 's' : ''}`;

  if (filtered.length === 0) {
    catalogEmpty.hidden = false;
    return;
  }

  filtered.forEach(product => {
    catalogGrid.appendChild(createProductCard(product));
  });

  catalogEmpty.hidden = true;
}

/* ======================================
   FILTER LOGIC
====================================== */
filterPills.forEach(pill => {
  pill.addEventListener('click', () => {
    // Remove active class from all
    filterPills.forEach(p => {
      p.classList.remove('prd-filter-pill--active');
      p.setAttribute('aria-pressed', 'false');
    });
    
    // Add active class to clicked
    pill.classList.add('prd-filter-pill--active');
    pill.setAttribute('aria-pressed', 'true');
    
    currentCategory = pill.dataset.category;
    
    // Scroll smoothly to catalog header if needed
    // document.getElementById('products-catalog').scrollIntoView({ behavior: 'smooth', block: 'start' });
    
    renderCatalogProducts();
  });
});

emptyResetBtn.addEventListener('click', () => {
  // Reset filter to 'all'
  document.getElementById('filter-all').click();
});

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
    closeModal(detailsModal);
    cartManager.clear();
    cartManager.addItem(product, 1);
    checkoutManager.open();
  });

  detailsModal.classList.add('is-active');
  detailsModal.setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';
}

function closeModal(modal) {
  modal.classList.remove('is-active');
  modal.setAttribute('aria-hidden', 'true');
  document.body.style.overflow = '';
}

// Close Modals Setup
document.querySelectorAll('[data-close-modal]').forEach(el => {
  el.addEventListener('click', () => closeModal(detailsModal));
});
document.querySelectorAll('[data-close-order]').forEach(el => {
  el.addEventListener('click', () => closeModal(orderModal));
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    if (detailsModal.classList.contains('is-active')) closeModal(detailsModal);
    if (orderModal.classList.contains('is-active')) closeModal(orderModal);
  }
});

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
if (featuredRetryBtn) featuredRetryBtn.addEventListener('click', fetchProducts);
if (catalogRetryBtn) catalogRetryBtn.addEventListener('click', fetchProducts);

/* ======================================
   INITIALIZE
====================================== */
document.addEventListener('DOMContentLoaded', () => {
  fetchProducts();
  cartManager.load();
  cartUi.render();
});
