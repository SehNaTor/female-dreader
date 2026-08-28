import { supabase } from './supabase.js';
import { initBookingModal } from './booking-modal.js';

/* ======================================
   CONFIG
====================================== */
const ABOUT_IMAGES = {
  heroBg: 'https://res.cloudinary.com/dbtjm4x6y/image/upload/v1781955850/images/portfolio-photo2_tbud1k.jpg', // Placeholder for hero
  owner: 'https://res.cloudinary.com/dbtjm4x6y/image/upload/v1781955850/images/portfolio-photo1_tbud1k.jpg',
};

/* ======================================
   INITIALIZE IMAGES
====================================== */
function setImages() {
  const heroBg = document.getElementById('hero-bg-img');
  if (heroBg) {
    heroBg.style.backgroundImage = `url('${ABOUT_IMAGES.heroBg}')`;
  }

  const founderImg = document.getElementById('founder-img');
  if (founderImg) {
    founderImg.src = ABOUT_IMAGES.owner;
  }
}

/* ======================================
   SCROLL ANIMATIONS
====================================== */
function initScrollAnimations() {
  const elements = document.querySelectorAll('.fade-up-el');
  
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-visible');
        
        // If it's a counter, animate it
        const counters = entry.target.querySelectorAll('.counter');
        if (counters.length > 0) {
          animateCounters(counters);
        }
        
        observer.unobserve(entry.target);
      }
    });
  }, { rootMargin: '0px 0px -50px 0px' });

  elements.forEach(el => observer.observe(el));
}

function animateCounters(counters) {
  counters.forEach(counter => {
    const target = +counter.getAttribute('data-target');
    const duration = 2000; // 2 seconds
    const increment = target / (duration / 16); // 60fps
    
    let current = 0;
    const updateCounter = () => {
      current += increment;
      if (current < target) {
        counter.innerText = Math.ceil(current);
        requestAnimationFrame(updateCounter);
      } else {
        counter.innerText = target;
      }
    };
    updateCounter();
  });
}

/* ======================================
   SUPABASE DATA FETCHING
====================================== */
const formatPrice = (price) => {
  return new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 }).format(price);
};

async function fetchFeaturedServices() {
  const grid = document.getElementById('services-preview-grid');
  const loader = document.getElementById('services-loading');
  if (!grid) return;

  try {
    const { data, error } = await supabase
      .from('services')
      .select('*')
      .limit(3);

    if (error) throw error;
    
    loader.style.display = 'none';

    if (!data || data.length === 0) {
      grid.innerHTML = '<p>No featured services available at the moment.</p>';
      return;
    }

    let html = '';
    data.forEach(service => {
      const payload = JSON.stringify({
        id: service.id,
        name: service.name,
        price: formatPrice(service.price),
        duration: service.duration || 'N/A'
      }).replace(/'/g, "&apos;"); // sanitize for html attribute

      html += `
        <div class="svc-preview-card fade-up-el is-visible">
          <div class="svc-preview-img-wrapper">
            <img src="${service.image_url}" alt="${service.name}" class="svc-preview-img" loading="lazy">
          </div>
          <div class="svc-preview-body">
            <h3 class="svc-preview-title">${service.name}</h3>
            <p class="svc-preview-desc">${service.description}</p>
            <div class="svc-preview-meta">
              <span>${formatPrice(service.price)}</span>
              <span><i class="fa-regular fa-clock"></i> ${service.duration || 'N/A'}</span>
            </div>
            <button class="abt-btn abt-btn--primary svc-preview-btn" data-book-service='${payload}'>
              Book Appointment
            </button>
          </div>
        </div>
      `;
    });

    grid.innerHTML = html;

  } catch (error) {
    console.error('Error fetching services:', error);
    loader.style.display = 'none';
    grid.innerHTML = '<p style="color:red;">Unable to load featured services.</p>';
  }
}

async function fetchGalleryPreview() {
  const grid = document.getElementById('gallery-preview-grid');
  const loader = document.getElementById('gallery-loading');
  if (!grid) return;

  try {
    // Assuming 'gallery' table has an 'image_url' column. Adjust if needed.
    const { data, error } = await supabase
      .from('gallery')
      .select('*')
      .limit(6);

    if (error) throw error;
    
    loader.style.display = 'none';

    if (!data || data.length === 0) {
      grid.innerHTML = '<p>No gallery images available at the moment.</p>';
      return;
    }

    let html = '';
    data.forEach(item => {
      html += `
        <a href="gallery.html" class="gal-preview-item fade-up-el is-visible" aria-label="View Gallery">
          <img src="${item.image_url}" alt="Gallery Image" class="gal-preview-img" loading="lazy">
          <div class="gal-preview-overlay"><i class="fa-solid fa-expand"></i></div>
        </a>
      `;
    });

    grid.innerHTML = html;

  } catch (error) {
    console.error('Error fetching gallery:', error);
    loader.style.display = 'none';
    grid.innerHTML = '<p style="color:red;">Unable to load gallery images.</p>';
  }
}

/* ======================================
   INITIALIZATION
====================================== */
document.addEventListener('DOMContentLoaded', () => {
  initBookingModal();
  setImages();
  initScrollAnimations();
  fetchFeaturedServices();
  fetchGalleryPreview();
});
