/* ==========================================================================
   PREMIUM IMAGE VIEWER MODULE
   A modern, fullscreen image modal with swipe, click, and keyboard navigation.
   ========================================================================== */

export const ImageViewer = (() => {
  let modalEl = null;
  let imgEl = null;
  let closeBtn = null;
  let prevBtn = null;
  let nextBtn = null;
  let captionEl = null;
  let countEl = null;

  let currentImages = [];
  let currentIndex = 0;
  let touchStartX = 0;
  let touchEndX = 0;
  let isDragging = false;

  const createModalDOM = () => {
    if (document.getElementById('premium-image-viewer')) return;

    modalEl = document.createElement('dialog');
    modalEl.id = 'premium-image-viewer';
    modalEl.className = 'premium-modal';
    modalEl.setAttribute('aria-label', 'Image Viewer');

    modalEl.innerHTML = `
      <div class="premium-modal__backdrop"></div>
      <div class="premium-modal__header">
        <div class="premium-modal__count" id="premium-modal-count"></div>
        <button type="button" class="premium-modal__close" id="premium-modal-close" aria-label="Close viewer">
          <i class="fa-solid fa-xmark"></i>
        </button>
      </div>
      <div class="premium-modal__content-wrapper">
        <button type="button" class="premium-modal__nav premium-modal__nav--prev" id="premium-modal-prev" aria-label="Previous image">
          <i class="fa-solid fa-chevron-left"></i>
        </button>
        <div class="premium-modal__img-container">
          <img class="premium-modal__img" id="premium-modal-img" alt="Fullscreen transformation view" />
          <div class="premium-modal__loader" id="premium-modal-loader"></div>
        </div>
        <button type="button" class="premium-modal__nav premium-modal__nav--next" id="premium-modal-next" aria-label="Next image">
          <i class="fa-solid fa-chevron-right"></i>
        </button>
      </div>
      <div class="premium-modal__caption" id="premium-modal-caption"></div>
    `;

    document.body.appendChild(modalEl);

    imgEl = document.getElementById('premium-modal-img');
    closeBtn = document.getElementById('premium-modal-close');
    prevBtn = document.getElementById('premium-modal-prev');
    nextBtn = document.getElementById('premium-modal-next');
    captionEl = document.getElementById('premium-modal-caption');
    countEl = document.getElementById('premium-modal-count');

    setupEventListeners();
  };

  const updateModalContent = () => {
    if (currentImages.length === 0) return;
    
    const currentItem = currentImages[currentIndex];
    
    // Show loader and hide image until loaded
    imgEl.classList.remove('loaded');
    
    // Set image source
    imgEl.src = currentItem.image_url;
    imgEl.alt = currentItem.title || 'Transformation';
    
    // Once loaded, fade it in
    imgEl.onload = () => {
      imgEl.classList.add('loaded');
    };

    // Update text
    captionEl.textContent = currentItem.title || '';
    countEl.textContent = `${currentIndex + 1} / ${currentImages.length}`;

    // Manage nav button states
    prevBtn.style.visibility = currentImages.length > 1 ? 'visible' : 'hidden';
    nextBtn.style.visibility = currentImages.length > 1 ? 'visible' : 'hidden';
  };

  const showPrev = () => {
    currentIndex = (currentIndex - 1 + currentImages.length) % currentImages.length;
    updateModalContent();
  };

  const showNext = () => {
    currentIndex = (currentIndex + 1) % currentImages.length;
    updateModalContent();
  };

  const openViewer = (images, startIndex = 0) => {
    createModalDOM();
    currentImages = images;
    currentIndex = startIndex;
    
    updateModalContent();
    
    modalEl.showModal();
    document.body.style.overflow = 'hidden';
    modalEl.classList.add('is-open');
  };

  const closeViewer = () => {
    if (!modalEl) return;
    modalEl.classList.remove('is-open');
    setTimeout(() => {
      modalEl.close();
      document.body.style.overflow = '';
      imgEl.src = ''; // Clear memory
    }, 300); // match transition duration
  };

  const handleSwipe = () => {
    const swipeThreshold = 50;
    if (touchEndX < touchStartX - swipeThreshold) showNext();
    if (touchEndX > touchStartX + swipeThreshold) showPrev();
  };

  const setupEventListeners = () => {
    closeBtn.addEventListener('click', closeViewer);
    prevBtn.addEventListener('click', (e) => { e.stopPropagation(); showPrev(); });
    nextBtn.addEventListener('click', (e) => { e.stopPropagation(); showNext(); });

    // Click outside to close (backdrop is the dialog element itself)
    modalEl.addEventListener('click', (e) => {
      if (e.target === modalEl || e.target.classList.contains('premium-modal__content-wrapper')) {
        closeViewer();
      }
    });

    // Keyboard navigation
    modalEl.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        closeViewer();
      } else if (e.key === 'ArrowLeft') {
        showPrev();
      } else if (e.key === 'ArrowRight') {
        showNext();
      }
    });

    // Touch swipe support
    const imgContainer = document.querySelector('.premium-modal__img-container');
    imgContainer.addEventListener('touchstart', (e) => {
      touchStartX = e.changedTouches[0].screenX;
    }, { passive: true });

    imgContainer.addEventListener('touchend', (e) => {
      touchEndX = e.changedTouches[0].screenX;
      handleSwipe();
    }, { passive: true });
    
    // Mouse drag support for desktop
    imgContainer.addEventListener('mousedown', (e) => {
      isDragging = true;
      touchStartX = e.screenX;
    });
    
    imgContainer.addEventListener('mouseup', (e) => {
      if (!isDragging) return;
      isDragging = false;
      touchEndX = e.screenX;
      handleSwipe();
    });
    
    imgContainer.addEventListener('mouseleave', () => {
      isDragging = false;
    });
  };

  return { open: openViewer, close: closeViewer };
})();
