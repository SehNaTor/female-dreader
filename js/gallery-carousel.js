import { GalleryService } from './gallery-data.js';
import { ImageViewer } from './image-viewer.js';

export const TransformationsCarousel = (() => {
  const el = {
    container: null,
    track: null,
    loading: null,
    empty: null,
    error: null,
    retryBtn: null
  };

  let galleryItems = [];

  const initDOM = () => {
    el.container = document.getElementById('hp-transformations-carousel');
    if (!el.container) return false;

    // Render initial structure
    el.container.innerHTML = `
      <div id="hp-trans-loading" class="transformations-state">
        <div class="hp-svc-skeleton__img" style="aspect-ratio: 4/5; width: 100%; border-radius: 12px; margin-bottom: 1rem;"></div>
        <div class="hp-svc-skeleton__line hp-svc-skeleton__line--lg" style="margin: 0 auto;"></div>
      </div>
      <div id="hp-trans-empty" class="transformations-state" hidden>
        <i class="fa-regular fa-image transformations-state__icon"></i>
        <p class="transformations-state__title">More Transformations Coming Soon</p>
      </div>
      <div id="hp-trans-error" class="transformations-state" hidden>
        <i class="fa-solid fa-triangle-exclamation transformations-state__icon transformations-state__icon--error"></i>
        <p class="transformations-state__title">Unable to Load Images</p>
        <button type="button" id="hp-trans-retry" class="btn btn-primary">Try Again</button>
      </div>
      <div id="hp-trans-track" class="transformations-track" hidden role="list"></div>
    `;

    el.loading = document.getElementById('hp-trans-loading');
    el.empty = document.getElementById('hp-trans-empty');
    el.error = document.getElementById('hp-trans-error');
    el.track = document.getElementById('hp-trans-track');
    el.retryBtn = document.getElementById('hp-trans-retry');

    el.retryBtn.addEventListener('click', loadData);

    return true;
  };

  const setPanel = (state) => {
    el.loading.hidden = true;
    el.empty.hidden = true;
    el.error.hidden = true;
    el.track.hidden = true;

    if (state === 'loading') el.loading.hidden = false;
    else if (state === 'empty') el.empty.hidden = false;
    else if (state === 'error') el.error.hidden = false;
    else if (state === 'content') el.track.hidden = false;
  };

  const createCardDOM = (item, index) => {
    const card = document.createElement('div');
    card.className = 'transformation-card';
    card.setAttribute('role', 'listitem');
    card.tabIndex = 0; // Make focusable
    
    // Accessibility
    card.setAttribute('aria-label', item.title || 'Recent hairstyle transformation');

    card.innerHTML = `
      <img src="" data-src="${item.image_url}" alt="${item.title || 'Hairstyle'}" class="transformation-card__img" loading="lazy" />
      <div class="transformation-card__overlay">
        <i class="fa-solid fa-expand transformation-card__icon"></i>
      </div>
    `;

    // Click to open modal
    card.addEventListener('click', () => {
      ImageViewer.open(galleryItems, index);
    });

    // Keyboard support
    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        ImageViewer.open(galleryItems, index);
      }
    });

    return card;
  };

  const renderTrack = () => {
    el.track.innerHTML = '';
    galleryItems.forEach((item, index) => {
      el.track.appendChild(createCardDOM(item, index));
    });

    // Setup lazy loading observer
    const imgObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const img = entry.target;
          img.src = img.dataset.src;
          img.onload = () => img.classList.add('loaded');
          imgObserver.unobserve(img);
        }
      });
    }, { root: el.track, rootMargin: '200px' });

    el.track.querySelectorAll('.transformation-card__img').forEach(img => {
      imgObserver.observe(img);
    });
    
    // Mouse dragging functionality for carousel
    let isDown = false;
    let startX;
    let scrollLeft;

    el.track.addEventListener('mousedown', (e) => {
      isDown = true;
      el.track.classList.add('active-drag');
      startX = e.pageX - el.track.offsetLeft;
      scrollLeft = el.track.scrollLeft;
    });

    el.track.addEventListener('mouseleave', () => {
      isDown = false;
      el.track.classList.remove('active-drag');
    });

    el.track.addEventListener('mouseup', () => {
      isDown = false;
      el.track.classList.remove('active-drag');
    });

    el.track.addEventListener('mousemove', (e) => {
      if (!isDown) return;
      e.preventDefault();
      const x = e.pageX - el.track.offsetLeft;
      const walk = (x - startX) * 2; // scroll-fast multiplier
      el.track.scrollLeft = scrollLeft - walk;
    });
    
    // Touch swipe is handled natively by CSS scroll-snap
  };

  const loadData = async () => {
    setPanel('loading');
    try {
      galleryItems = await GalleryService.fetchFeaturedTransformations();
      if (galleryItems.length === 0) {
        setPanel('empty');
      } else {
        renderTrack();
        setPanel('content');
      }
    } catch (err) {
      setPanel('error');
    }
  };

  const init = () => {
    if (initDOM()) {
      loadData();
    }
  };

  return { init };
})();
