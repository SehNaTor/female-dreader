import { supabase } from './supabase.js';

/* ========================================
   STATE MANAGEMENT
   ======================================== */

let allGalleryItems = [];
let filteredItems = [];
let currentFilter = 'all';
let currentLightboxIndex = 0;
let allLightboxItems = [];

/* ========================================
   DOM ELEMENTS
   ======================================== */

const galleryGrid = document.getElementById('galleryGrid');
const galleryLoading = document.getElementById('galleryLoading');
const emptyState = document.getElementById('emptyState');
const errorState = document.getElementById('errorState');
const errorMessage = document.getElementById('errorMessage');
const filterPills = document.getElementById('filterPills');
const featuredWorksSection = document.getElementById('featuredWorksSection');
const featuredGrid = document.getElementById('featuredGrid');

// Lightbox elements
const lightbox = document.getElementById('lightbox');
const lightboxImage = document.getElementById('lightboxImage');
const lightboxTitle = document.getElementById('lightboxTitle');
const lightboxDescription = document.getElementById('lightboxDescription');
const lightboxCategory = document.getElementById('lightboxCategory');
const lightboxClose = document.getElementById('lightboxClose');
const lightboxPrev = document.getElementById('lightboxPrev');
const lightboxNext = document.getElementById('lightboxNext');
const lightboxOverlay = document.getElementById('lightboxOverlay');

/* ========================================
   INITIALIZATION
   ======================================== */

document.addEventListener('DOMContentLoaded', async () => {
  await fetchGalleryData();
  setupEventListeners();
  renderFeaturedWorks();
  renderGalleryGrid();
  setupIntersectionObserver();
});

/* ========================================
   FETCH DATA FROM SUPABASE
   ======================================== */

async function fetchGalleryData() {
  try {
    showLoadingState();

    const { data, error } = await supabase
      .from('gallery')
      .select('*')
      .eq('active', true)
      .order('display_order', { ascending: true });

    if (error) throw error;

    if (!data || data.length === 0) {
      showEmptyState();
      return;
    }

    allGalleryItems = data;
    filteredItems = data;
    updateLightboxItems();
    hideLoadingState();
  } catch (error) {
    console.error('Error fetching gallery data:', error);
    showErrorState('Failed to load gallery. Please try again.');
  }
}

/* ========================================
   UPDATE LIGHTBOX ITEMS
   ======================================== */

function updateLightboxItems() {
  allLightboxItems = filteredItems;
}

/* ========================================
   SETUP EVENT LISTENERS
   ======================================== */

function setupEventListeners() {
  // Filter pills
  filterPills.addEventListener('click', (e) => {
    if (e.target.classList.contains('filter-pill')) {
      handleFilterChange(e.target);
    }
  });

  // Lightbox navigation
  lightboxClose.addEventListener('click', closeLightbox);
  lightboxOverlay.addEventListener('click', closeLightbox);
  lightboxPrev.addEventListener('click', showPreviousImage);
  lightboxNext.addEventListener('click', showNextImage);

  // Keyboard navigation
  document.addEventListener('keydown', handleKeyboardNavigation);
}

/* ========================================
   FILTER FUNCTIONALITY
   ======================================== */

function handleFilterChange(button) {
  // Update active state
  document.querySelectorAll('.filter-pill').forEach(pill => {
    pill.classList.remove('active');
  });
  button.classList.add('active');

  // Update current filter
  currentFilter = button.getAttribute('data-category');

  // Filter items
  if (currentFilter === 'all') {
    filteredItems = allGalleryItems;
  } else {
    filteredItems = allGalleryItems.filter(
      item => item.category === currentFilter
    );
  }

  updateLightboxItems();

  // Re-render gallery
  renderGalleryGrid();
  renderFeaturedWorks();

  // Scroll to gallery section
  // Scroll to gallery section using Lenis if available
  if (window.FDScroll) {
    window.FDScroll.scrollTo(document.querySelector('.gallery-section'), { offset: -80 });
  } else {
    document.querySelector('.gallery-section').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}

/* ========================================
   RENDER FEATURED WORKS
   ======================================== */

function renderFeaturedWorks() {
  const featuredItems = filteredItems.filter(item => item.featured);

  if (featuredItems.length === 0) {
    featuredWorksSection.style.display = 'none';
    return;
  }

  featuredWorksSection.style.display = 'block';
  featuredGrid.innerHTML = '';

  featuredItems.forEach(item => {
    const card = createFeaturedCard(item);
    featuredGrid.appendChild(card);
  });
}

function createFeaturedCard(item) {
  const card = document.createElement('div');
  card.className = 'featured-card';

  const imageWrapper = document.createElement('div');
  imageWrapper.className = 'featured-card-image';

  const img = document.createElement('img');
  img.src = item.image_url;
  img.alt = item.title;
  img.loading = 'lazy';
  imageWrapper.appendChild(img);

  const badge = document.createElement('div');
  badge.className = 'featured-badge';
  badge.textContent = 'Featured';
  imageWrapper.appendChild(badge);

  card.appendChild(imageWrapper);

  const info = document.createElement('div');
  info.className = 'featured-card-info';

  const category = document.createElement('div');
  category.className = 'featured-card-category';
  category.textContent = item.category;
  info.appendChild(category);

  const title = document.createElement('h3');
  title.className = 'featured-card-title';
  title.textContent = item.title;
  info.appendChild(title);

  const description = document.createElement('p');
  description.className = 'featured-card-description';
  description.textContent = item.description;
  info.appendChild(description);

  card.appendChild(info);

  // Add click handler for featured cards
  card.addEventListener('click', () => {
    const itemIndex = allLightboxItems.findIndex(i => i.id === item.id);
    if (itemIndex !== -1) {
      currentLightboxIndex = itemIndex;
      openLightbox();
    }
  });

  return card;
}

/* ========================================
   RENDER GALLERY GRID
   ======================================== */

function renderGalleryGrid() {
  galleryGrid.innerHTML = '';

  if (filteredItems.length === 0) {
    showEmptyState();
    return;
  }

  hideEmptyState();

  filteredItems.forEach((item, index) => {
    const card = createGalleryCard(item, index);
    galleryGrid.appendChild(card);
  });
}

function createGalleryCard(item, index) {
  const card = document.createElement('div');
  card.className = 'gallery-card';
  card.setAttribute('data-gallery-index', index);

  const imageWrapper = document.createElement('div');
  imageWrapper.className = 'gallery-card-image';

  const img = document.createElement('img');
  img.src = item.image_url;
  img.alt = item.title;
  img.loading = 'lazy';
  img.className = 'gallery-image-lazy';
  imageWrapper.appendChild(img);

  const overlay = document.createElement('div');
  overlay.className = 'gallery-card-overlay';
  const icon = document.createElement('i');
  icon.className = 'fas fa-expand gallery-card-overlay-icon';
  overlay.appendChild(icon);
  imageWrapper.appendChild(overlay);

  const badge = document.createElement('div');
  badge.className = 'gallery-card-category-badge';
  badge.textContent = item.category;
  imageWrapper.appendChild(badge);

  card.appendChild(imageWrapper);

  const info = document.createElement('div');
  info.className = 'gallery-card-info';

  const title = document.createElement('h3');
  title.className = 'gallery-card-title';
  title.textContent = item.title;
  info.appendChild(title);

  const description = document.createElement('p');
  description.className = 'gallery-card-description';
  description.textContent = item.description;
  info.appendChild(description);

  card.appendChild(info);

  // Add click handler for lightbox
  card.addEventListener('click', () => {
    const itemIndex = allLightboxItems.findIndex(i => i.id === item.id);
    if (itemIndex !== -1) {
      currentLightboxIndex = itemIndex;
      openLightbox();
    }
  });

  // Add keyboard support
  card.setAttribute('tabindex', '0');
  card.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      card.click();
    }
  });

  return card;
}

/* ========================================
   LAZY LOADING WITH INTERSECTION OBSERVER
   ======================================== */

function setupIntersectionObserver() {
  const observerOptions = {
    root: null,
    rootMargin: '50px',
    threshold: 0.01
  };

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const img = entry.target;
        // Image already has src, so no need to set it again
        // This is just for progressive rendering enhancement
        img.style.opacity = '1';
        observer.unobserve(img);
      }
    });
  }, observerOptions);

  // Observe all lazy-loaded images
  document.querySelectorAll('.gallery-image-lazy').forEach(img => {
    observer.observe(img);
  });
}

/* ========================================
   LIGHTBOX FUNCTIONALITY
   ======================================== */

function openLightbox() {
  if (allLightboxItems.length === 0) return;

  const item = allLightboxItems[currentLightboxIndex];
  
  lightboxImage.src = item.image_url;
  lightboxImage.alt = item.title;
  lightboxTitle.textContent = item.title;
  lightboxDescription.textContent = item.description;
  lightboxCategory.textContent = item.category;

  lightbox.classList.add('active');
  document.body.style.overflow = 'hidden';

  updateLightboxNavigation();
}

function closeLightbox() {
  lightbox.classList.remove('active');
  document.body.style.overflow = 'auto';
}

function showPreviousImage() {
  currentLightboxIndex = (currentLightboxIndex - 1 + allLightboxItems.length) % allLightboxItems.length;
  openLightbox();
}

function showNextImage() {
  currentLightboxIndex = (currentLightboxIndex + 1) % allLightboxItems.length;
  openLightbox();
}

function updateLightboxNavigation() {
  // Show/hide navigation buttons based on number of items
  if (allLightboxItems.length <= 1) {
    lightboxPrev.style.display = 'none';
    lightboxNext.style.display = 'none';
  } else {
    lightboxPrev.style.display = 'flex';
    lightboxNext.style.display = 'flex';
  }
}

/* ========================================
   KEYBOARD NAVIGATION
   ======================================== */

function handleKeyboardNavigation(e) {
  if (!lightbox.classList.contains('active')) return;

  switch (e.key) {
    case 'Escape':
      closeLightbox();
      break;
    case 'ArrowLeft':
      showPreviousImage();
      break;
    case 'ArrowRight':
      showNextImage();
      break;
  }
}

/* ========================================
   STATE MANAGEMENT - UI STATES
   ======================================== */

function showLoadingState() {
  galleryLoading.style.display = 'block';
  galleryGrid.style.display = 'none';
  emptyState.style.display = 'none';
  errorState.style.display = 'none';
}

function hideLoadingState() {
  galleryLoading.style.display = 'none';
  galleryGrid.style.display = 'grid';
}

function showEmptyState() {
  galleryLoading.style.display = 'none';
  galleryGrid.style.display = 'none';
  emptyState.style.display = 'flex';
  errorState.style.display = 'none';
}

function hideEmptyState() {
  emptyState.style.display = 'none';
}

function showErrorState(message) {
  galleryLoading.style.display = 'none';
  galleryGrid.style.display = 'none';
  emptyState.style.display = 'none';
  errorState.style.display = 'flex';
  errorMessage.textContent = message;
}

/* ========================================
   ACCESSIBILITY IMPROVEMENTS
   ======================================== */

// Announce gallery updates to screen readers
function announceUpdate(message) {
  const announcement = document.createElement('div');
  announcement.setAttribute('role', 'status');
  announcement.setAttribute('aria-live', 'polite');
  announcement.className = 'sr-only';
  announcement.textContent = message;
  document.body.appendChild(announcement);
  setTimeout(() => announcement.remove(), 1000);
}

/* ========================================
   ERROR LOGGING & MONITORING
   ======================================== */

function logError(error) {
  console.error('[Gallery Error]', error);
  // Could send to analytics service here
}

// Export for testing or external use
export {
  fetchGalleryData,
  handleFilterChange,
  openLightbox,
  closeLightbox
};
