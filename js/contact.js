/* ======================================
   CONTACT PAGE JAVASCRIPT
   ====================================== */

document.addEventListener('DOMContentLoaded', () => {
  // 1. Scroll Animations
  initScrollAnimations();

  // 2. Form Handling
  initContactForm();
});

/* ======================================
   SCROLL ANIMATIONS
====================================== */
function initScrollAnimations() {
  const animatedElements = document.querySelectorAll('.fade-up-el');
  
  if (!animatedElements.length) return;

  const observerOptions = {
    root: null,
    rootMargin: '0px',
    threshold: 0.15
  };

  const observer = new IntersectionObserver((entries, observer) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-visible');
        // Optional: stop observing once animated
        observer.unobserve(entry.target);
      }
    });
  }, observerOptions);

  animatedElements.forEach(el => observer.observe(el));
}

/* ======================================
   FORM HANDLING
====================================== */
function initContactForm() {
  const form = document.getElementById('contact-form');
  const notification = document.getElementById('form-notification');
  const submitBtn = form?.querySelector('.btn-submit');
  const btnText = submitBtn?.querySelector('.btn-text');
  const btnLoader = submitBtn?.querySelector('.btn-loader');
  const btnIcon = submitBtn?.querySelector('.fa-paper-plane');

  if (!form) return;

  // Real-time validation for floating labels
  const inputs = form.querySelectorAll('input, textarea');
  inputs.forEach(input => {
    input.addEventListener('blur', () => {
      if (!input.checkValidity()) {
        input.classList.add('is-invalid');
      } else {
        input.classList.remove('is-invalid');
      }
    });

    input.addEventListener('input', () => {
      if (input.classList.contains('is-invalid') && input.checkValidity()) {
        input.classList.remove('is-invalid');
      }
    });
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    // Clear previous notification
    notification.className = 'form-notification';
    notification.textContent = '';
    
    // Basic HTML5 Validation
    if (!form.checkValidity()) {
      inputs.forEach(input => {
        if (!input.checkValidity()) {
          input.classList.add('is-invalid');
        }
      });
      showNotification('Please fill in all required fields correctly.', 'error');
      return;
    }

    // Prepare loading state
    setLoadingState(true);

    // Simulate API call / submission
    try {
      // Simulate network latency (1.5s)
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // Success
      showNotification('Thank you! Your message has been sent successfully. We will get back to you shortly.', 'success');
      form.reset();
      
      // Remove valid classes
      inputs.forEach(input => input.classList.remove('is-invalid'));
      
    } catch (error) {
      showNotification('An error occurred while sending your message. Please try again or contact us directly.', 'error');
    } finally {
      setLoadingState(false);
    }
  });

  function setLoadingState(isLoading) {
    if (isLoading) {
      submitBtn.disabled = true;
      btnText.classList.add('hidden');
      btnIcon?.classList.add('hidden');
      btnLoader.classList.remove('hidden');
    } else {
      submitBtn.disabled = false;
      btnText.classList.remove('hidden');
      btnIcon?.classList.remove('hidden');
      btnLoader.classList.add('hidden');
    }
  }

  function showNotification(message, type) {
    notification.textContent = message;
    notification.className = `form-notification ${type}`;
    // Auto hide success message after 5 seconds
    if (type === 'success') {
      setTimeout(() => {
        notification.classList.remove('success');
      }, 5000);
    }
  }
}

/* ======================================
   GOOGLE MAPS INITIALIZATION
====================================== */
// This function is called by the Google Maps script callback
window.initMap = function() {
  const mapElement = document.getElementById('google-map');
  if (!mapElement) return;

  // Clear loading state
  mapElement.innerHTML = '';

  // Female Dreader coordinates (Approximate - Surulere, Lagos)
  const businessLocation = { lat: 6.5000, lng: 3.3500 }; 

  try {
    const map = new google.maps.Map(mapElement, {
      zoom: 15,
      center: businessLocation,
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: true,
      styles: [
        {
          "featureType": "all",
          "elementType": "geometry.fill",
          "stylers": [{"weight": "2.00"}]
        },
        {
          "featureType": "all",
          "elementType": "geometry.stroke",
          "stylers": [{"color": "#9c9c9c"}]
        },
        {
          "featureType": "all",
          "elementType": "labels.text",
          "stylers": [{"visibility": "on"}]
        },
        {
          "featureType": "landscape",
          "elementType": "all",
          "stylers": [{"color": "#f2f2f2"}]
        },
        {
          "featureType": "landscape",
          "elementType": "geometry.fill",
          "stylers": [{"color": "#ffffff"}]
        },
        {
          "featureType": "landscape.man_made",
          "elementType": "geometry.fill",
          "stylers": [{"color": "#ffffff"}]
        },
        {
          "featureType": "poi",
          "elementType": "all",
          "stylers": [{"visibility": "off"}]
        },
        {
          "featureType": "road",
          "elementType": "all",
          "stylers": [{"saturation": -100}, {"lightness": 45}]
        },
        {
          "featureType": "road",
          "elementType": "geometry.fill",
          "stylers": [{"color": "#eeeeee"}]
        },
        {
          "featureType": "road",
          "elementType": "labels.text.fill",
          "stylers": [{"color": "#7b7b7b"}]
        },
        {
          "featureType": "road",
          "elementType": "labels.text.stroke",
          "stylers": [{"color": "#ffffff"}]
        },
        {
          "featureType": "road.highway",
          "elementType": "all",
          "stylers": [{"visibility": "simplified"}]
        },
        {
          "featureType": "road.arterial",
          "elementType": "labels.icon",
          "stylers": [{"visibility": "off"}]
        },
        {
          "featureType": "transit",
          "elementType": "all",
          "stylers": [{"visibility": "off"}]
        },
        {
          "featureType": "water",
          "elementType": "all",
          "stylers": [{"color": "#46bcec"}, {"visibility": "on"}]
        },
        {
          "featureType": "water",
          "elementType": "geometry.fill",
          "stylers": [{"color": "#c8d7d4"}]
        },
        {
          "featureType": "water",
          "elementType": "labels.text.fill",
          "stylers": [{"color": "#070707"}]
        },
        {
          "featureType": "water",
          "elementType": "labels.text.stroke",
          "stylers": [{"color": "#ffffff"}]
        }
      ]
    });

    const marker = new google.maps.Marker({
      position: businessLocation,
      map: map,
      title: 'Female Dreader Studio',
      animation: google.maps.Animation.DROP
    });

    const infoWindowContent = `
      <div style="padding: 10px; font-family: 'Inter', sans-serif;">
        <h4 style="margin: 0 0 5px 0; font-family: 'Playfair Display', serif; color: #1a1a1a;">Female Dreader Studio</h4>
        <p style="margin: 0 0 10px 0; font-size: 14px; color: #666;">46 Akinkumi Street, Off Karounwi<br>Itire, Surulere, Lagos, Nigeria</p>
        <a href="https://maps.google.com/?q=46+Akinkumi+Street,+Itire,+Surulere,+Lagos" target="_blank" style="color: #d4af37; text-decoration: none; font-weight: bold; font-size: 14px;">Get Directions</a>
      </div>
    `;

    const infoWindow = new google.maps.InfoWindow({
      content: infoWindowContent,
    });

    marker.addListener('click', () => {
      infoWindow.open(map, marker);
    });

  } catch (error) {
    console.error("Google Maps initialization error:", error);
    handleMapFallback(mapElement);
  }
};

// Handle fallback if map fails to load
window.gm_authFailure = function() {
  const mapElement = document.getElementById('google-map');
  if (mapElement) {
    handleMapFallback(mapElement);
  }
};

function handleMapFallback(mapElement) {
  mapElement.innerHTML = `
    <div style="width: 100%; height: 100%; display: flex; flex-direction: column; justify-content: center; align-items: center; background-color: #f5f5f5; color: #666; padding: 2rem; text-align: center;">
      <i class="fa-solid fa-map-location-dot" style="font-size: 3rem; margin-bottom: 1rem; color: #d4af37;"></i>
      <h3 style="font-family: 'Playfair Display', serif; margin-bottom: 0.5rem; color: #1a1a1a;">Female Dreader Studio</h3>
      <p style="margin-bottom: 1rem;">46 Akinkumi Street, Off Karounwi, Itire, Surulere, Lagos, Nigeria</p>
    </div>
  `;
}
