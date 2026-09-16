import { supabase } from './supabase.js';
import { initBookingModal } from './booking-modal.js';
import { initHeroAnimation } from './hero-animation.js';
import { TransformationsCarousel } from './gallery-carousel.js';

/* ==========================================================================
   HOMEPAGE SERVICES MODULE
   Fetches featured services from Supabase and renders them dynamically.
   Reuses svc-featured-card CSS classes from service.css (loaded in index.html).
   ========================================================================== */

const HomepageServices = (() => {

  /* --- DOM refs ---------------------------------------------------------- */

  const el = {
    section : document.getElementById('hp-services-section'),
    loading : document.getElementById('hp-svc-loading'),
    grid    : document.getElementById('hp-svc-grid'),
    empty   : document.getElementById('hp-svc-empty'),
    error   : document.getElementById('hp-svc-error'),
    retry   : document.getElementById('hp-svc-retry'),
    cta     : document.getElementById('hp-svc-cta'),
  };

  /* --- Utilities --------------------------------------------------------- */

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

  /* --- Lazy image observer ---------------------------------------------- */

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
          placeholder.className = 'svc-featured-card__img-placeholder';
          placeholder.setAttribute('aria-hidden', 'true');
          placeholder.innerHTML = '<i class="fa-solid fa-scissors"></i><span>Image unavailable</span>';
          img.replaceWith(placeholder);
        }, { once: true });

        imageObserver.unobserve(img);
      });
    },
    { rootMargin: '300px 0px', threshold: 0 }
  );

  /* --- Panel state machine ----------------------------------------------- */

  const hideEl = (node) => { if (node) { node.hidden = true; } };
  const showEl = (node, display = 'block') => {
    if (node) { node.hidden = false; node.style.display = display; }
  };

  const setPanel = (panelState) => {
    hideEl(el.loading);
    hideEl(el.grid);
    hideEl(el.empty);
    hideEl(el.error);
    hideEl(el.cta);

    switch (panelState) {
      case 'loading':
        showEl(el.loading, 'grid');
        break;
      case 'content':
        showEl(el.grid, 'grid');
        showEl(el.cta);
        break;
      case 'empty':
        showEl(el.empty, 'flex');
        break;
      case 'error':
        showEl(el.error, 'flex');
        break;
    }
  };

  /* --- Card builder ------------------------------------------------------ */

  const buildCard = (service) => {
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
    article.className = 'hp-svc-card';
    article.setAttribute('role', 'listitem');
    article.setAttribute('aria-label', 'Featured service: ' + name);

    article.innerHTML = `
      <div class="hp-svc-card__img-wrap">
        ${imgUrl
          ? `<img
               class="hp-svc-card__img img-lazy"
               data-src="${sanitize(imgUrl)}"
               src=""
               alt="${name} hairstyle at Female Dreader"
               loading="lazy"
               width="600"
               height="500"
             >`
          : `<div class="hp-svc-card__img-placeholder" aria-hidden="true">
               <i class="fa-solid fa-scissors"></i>
               <span>No image</span>
             </div>`
        }
        ${category
          ? `<span class="hp-svc-card__category">${category}</span>`
          : ''
        }
      </div>

      <div class="hp-svc-card__body">
        <h3 class="hp-svc-card__name">${name}</h3>
        ${desc
          ? `<p class="hp-svc-card__description">${desc}</p>`
          : ''
        }

        <div class="hp-svc-card__meta">
          <div class="hp-svc-card__price">
            <span class="hp-svc-price-label">Starting from</span>
            <span class="hp-svc-price-value" aria-label="Price: ${price}">${price}</span>
          </div>
          ${duration
            ? `<div class="hp-svc-card__duration">
                 <i class="fa-regular fa-clock" aria-hidden="true"></i>
                 ${duration}
               </div>`
            : ''
          }
        </div>

        <button
          type="button"
          class="hp-svc-card__book-btn"
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

  /* --- Fetch & render ---------------------------------------------------- */

  const fetchAndRender = async () => {
    setPanel('loading');

    try {
      const { data, error } = await supabase
        .from('services')
        .select('id, image_url, name, description, category, price, duration, display_order')
        .eq('active', true)
        .eq('show_on_homepage', true)
        .order('display_order', { ascending: true })
        .limit(3);

      if (error) throw error;

      const services = Array.isArray(data) ? data : [];

      if (services.length === 0) {
        setPanel('empty');
        return;
      }

      el.grid.innerHTML = '';
      services.forEach((service) => el.grid.appendChild(buildCard(service)));
      setPanel('content');

    } catch (err) {
      console.error('[Female Dreader] Homepage services fetch failed:', err);
      setPanel('error');
    }
  };

  /* --- Public init ------------------------------------------------------- */

  const init = () => {
    if (!el.section) return;
    if (el.retry) el.retry.addEventListener('click', fetchAndRender);
    fetchAndRender();
  };

  return { init };

})();

/* ==========================================================================
   HOMEPAGE INIT — single DOMContentLoaded, all listeners registered once
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {

  /* -- Booking modal (event delegation, page-global) ---------------------- */
  initBookingModal();

  /* -- Homepage services: fetch from Supabase and render ------------------ */
  HomepageServices.init();

  /* -- Hero typing animation ---------------------------------------------- */
  initHeroAnimation();

  /* -- Global Scroll Reveal Animations ------------------------------------ */
  const animatedElements = document.querySelectorAll('.fade-in, .so-item');
  if (animatedElements.length > 0) {
    const globalRevealObserver = new IntersectionObserver((entries, observer) => {
      entries.forEach((entry, index) => {
        if (entry.isIntersecting) {
          const el = entry.target;
          if (el.classList.contains('fade-in')) {
            setTimeout(() => el.classList.add('visible'), index * 100);
          } else {
            el.classList.add('animate-in');
          }
          observer.unobserve(el);
        }
      });
    }, { root: null, rootMargin: '0px 0px -50px 0px', threshold: 0.1 });

    animatedElements.forEach(el => globalRevealObserver.observe(el));
  }

  /* -- Service Cards: Staggered Viewport Reveal Animation ----------------- */
  const svcGrid = document.getElementById('hp-svc-grid');
  if (svcGrid) {
    const cardRevealObserver = new IntersectionObserver((entries, observer) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('hp-svc-card--visible');
          observer.unobserve(entry.target);
        }
      });
    }, { root: null, rootMargin: '0px 0px -40px 0px', threshold: 0.05 });

    /* Observe cards added dynamically by Supabase render */
    const svcGridMutationObserver = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === 1 && node.classList.contains('hp-svc-card')) {
            /* Stagger the animation delay per card index */
            const index = Array.from(svcGrid.children).indexOf(node);
            node.style.transitionDelay = `${index * 0.12}s`;
            cardRevealObserver.observe(node);
          }
        });
      });
    });

    svcGridMutationObserver.observe(svcGrid, { childList: true });
  }

  /* -- Why Choose Female Dreader cards ---------------------------------- */
  const whyChooseCards = document.querySelectorAll('.why-choose-grid .value-card');
  if (whyChooseCards.length > 0) {
    const whyChooseObserver = new IntersectionObserver((entries, observer) => {
      entries.forEach((entry, index) => {
        if (!entry.isIntersecting) return;
        const card = entry.target;
        card.style.transitionDelay = `${index * 0.12}s`;
        card.classList.add('is-visible');
        observer.unobserve(card);
      });
    }, { rootMargin: '0px 0px -15% 0px', threshold: 0.2 });

    whyChooseCards.forEach((card) => whyChooseObserver.observe(card));
  }

  /* -- Transformations Carousel (Dynamic Supabase fetching) ---------------- */
  TransformationsCarousel.init();

  /* -- Testimonials ------------------------------------------------------- */
  const form      = document.getElementById('testimonial-form');
  const clientNameInput  = document.getElementById('client-name');
  const clientRatingInput = document.getElementById('client-rating');
  const clientReviewInput = document.getElementById('client-review');
  const submitBtn  = document.getElementById('submit-review-btn');
  const notificationArea = document.getElementById('form-notification');
  const testimonialGrid  = document.getElementById('testimonial-grid');
  const loadingIndicator = document.getElementById('testimonial-loading');
  let notificationTimeout = null;

  const sanitizeText = (value) => {
    if (value === null || value === undefined) return '';
    const div = document.createElement('div');
    div.textContent = String(value);
    return div.innerHTML;
  };

  const hideNotification = () => {
    if (!notificationArea) return;
    notificationArea.classList.remove('is-visible', 'success', 'error', 'info');
    notificationArea.hidden = true;
    notificationArea.innerHTML = '';
    if (notificationTimeout) {
      window.clearTimeout(notificationTimeout);
      notificationTimeout = null;
    }
  };

  /* Purpose: Presents polished feedback for testimonial submission states.
     Parameters: message (string), type (success/error/info), autoDismiss (boolean).
     Returns: None. */
  const showNotification = (message, type = 'info', autoDismiss = true) => {
    if (!notificationArea) return;
    hideNotification();

    notificationArea.hidden = false;
    notificationArea.classList.add('form-notification', type, 'is-visible');

    const icon = document.createElement('span');
    icon.className = 'form-notification__icon';
    icon.setAttribute('aria-hidden', 'true');
    icon.textContent = type === 'success' ? '✓' : type === 'error' ? '!' : 'i';

    const content = document.createElement('span');
    content.className = 'form-notification__content';
    content.textContent = message;

    const closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.className = 'form-notification__close';
    closeBtn.setAttribute('aria-label', 'Dismiss notification');
    closeBtn.innerHTML = '&times;';
    closeBtn.addEventListener('click', hideNotification);

    notificationArea.append(icon, content, closeBtn);

    if (autoDismiss) {
      notificationTimeout = window.setTimeout(() => hideNotification(), 3800);
    }
  };

  const generateStars = (ratingNum) => {
    const r = Math.max(1, Math.min(5, parseInt(ratingNum, 10) || 5));
    return '★'.repeat(r) + '☆'.repeat(5 - r);
  };

  const setSubmitButtonState = (isLoading) => {
    if (!submitBtn) return;
    submitBtn.disabled = isLoading;
    submitBtn.classList.toggle('is-loading', isLoading);

    const label = submitBtn.querySelector('.submit-btn__label');
    const spinner = submitBtn.querySelector('.submit-btn__spinner');

    if (label) label.hidden = isLoading;
    if (spinner) spinner.hidden = !isLoading;
  };

  /* Purpose: Builds a polished testimonial card with a lightweight avatar and metadata.
     Parameters: testimonial (object) containing the review content and author details.
     Returns: HTMLElement for the rendered testimonial card. */
  const createTestimonialCard = (testimonial) => {
    const card = document.createElement('article');
    card.className = 'testimonial-card';
    const authorName = sanitizeText(testimonial.name || 'Client');
    const initials = authorName
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() || '')
      .join('') || 'C';

    const dateString = testimonial.created_at
      ? `<span class="testimonial-date">${new Date(testimonial.created_at).toLocaleDateString('en-NG', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        })}</span>`
      : '';

    card.innerHTML = `
      <div class="testimonial-card__header">
        <div class="testimonial-avatar" aria-hidden="true">${initials}</div>
        <div class="testimonial-card__meta">
          <p class="testimonial-author">${authorName}</p>
          ${dateString ? `<p class="testimonial-date">${dateString}</p>` : ''}
        </div>
        <div class="testimonial-rating" aria-label="Rated ${generateStars(testimonial.rating)}">${generateStars(testimonial.rating)}</div>
      </div>
      <p class="testimonial-text">“${sanitizeText(testimonial.review)}”</p>
    `;

    requestAnimationFrame(() => card.classList.add('is-visible'));
    return card;
  };

  const renderEmptyState = () => {
    if (!testimonialGrid) return;
    testimonialGrid.innerHTML = '';
    const emptyState = document.createElement('div');
    emptyState.className = 'testimonial-empty';
    emptyState.textContent = 'No testimonials yet. Be the first to leave one!';
    testimonialGrid.appendChild(emptyState);
  };

  const renderErrorState = () => {
    if (!testimonialGrid) return;
    testimonialGrid.innerHTML = '';
    const errorState = document.createElement('div');
    errorState.className = 'testimonial-error';
    errorState.textContent = 'Unable to load testimonials right now. Please try again in a moment.';
    testimonialGrid.appendChild(errorState);
  };

  const prependOptimisticCard = (testimonial) => {
    if (!testimonialGrid) return;
    const card = createTestimonialCard(testimonial);
    const existingEmptyState = testimonialGrid.querySelector('.testimonial-empty, .testimonial-error');
    if (existingEmptyState) {
      testimonialGrid.innerHTML = '';
    }
    testimonialGrid.prepend(card);
  };

  /* Purpose: Retrieves testimonials and renders them in the public list.
     Parameters: showLoading (boolean) controls the loading state.
     Returns: Promise resolving when the list has been rendered. */
  const fetchTestimonials = async ({ showLoading = true } = {}) => {
    if (!supabase || !testimonialGrid) return;

    if (showLoading && loadingIndicator) {
      loadingIndicator.hidden = false;
    }

    testimonialGrid.innerHTML = '';

    try {
      const { data, error } = await supabase
        .from('testimonials')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      const testimonials = Array.isArray(data) ? data : [];
      if (testimonials.length === 0) {
        renderEmptyState();
      } else {
        const fragment = document.createDocumentFragment();
        testimonials.forEach((testimonial, index) => {
          const card = createTestimonialCard(testimonial);
          card.style.transitionDelay = `${Math.min(index * 0.08, 0.4)}s`;
          fragment.appendChild(card);
        });
        testimonialGrid.appendChild(fragment);
      }

    } catch (err) {
      console.error('Error fetching testimonials:', err);
      renderErrorState();
    } finally {
      if (loadingIndicator) {
        loadingIndicator.hidden = true;
      }
    }
  };

  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!supabase) {
        showNotification('Testimonial database not configured properly.', 'error');
        return;
      }

      const name   = clientNameInput.value.trim();
      const rating = parseInt(clientRatingInput.value, 10);
      const review = clientReviewInput.value.trim();

      if (!name || !rating || !review) {
        showNotification('Please fill out all required fields.', 'error');
        return;
      }

      setSubmitButtonState(true);
      showNotification('Submitting your testimonial...', 'info', false);

      try {
        const { data, error } = await supabase
          .from('testimonials')
          .insert([{ name, rating, review }])
          .select('*')
          .single();

        if (error) throw error;

        const insertedTestimonial = data || {
          name,
          rating,
          review,
          created_at: new Date().toISOString(),
        };

        prependOptimisticCard(insertedTestimonial);
        form.reset();

        window.setTimeout(() => {
          showNotification('Thank you! Your testimonial has been submitted successfully. It will now appear below.', 'success');
          setSubmitButtonState(false);
        }, 1800);

        window.setTimeout(() => {
          fetchTestimonials({ showLoading: false });
        }, 2200);

      } catch (err) {
        console.error('Error submitting testimonial:', err);
        setSubmitButtonState(false);
        showNotification('Failed to submit your testimonial. Please try again.', 'error');
      }
    });
  }

  if (supabase) {
    fetchTestimonials();
  } else if (testimonialGrid && loadingIndicator) {
    loadingIndicator.hidden = true;
    testimonialGrid.innerHTML = '<div class="testimonial-error">Please connect your Supabase credentials to view and submit testimonials.</div>';
  }

});
