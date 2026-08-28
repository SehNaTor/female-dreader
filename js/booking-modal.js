/* ==========================================================================
   FEMALE DREADER — BOOKING MODAL
   js/booking-modal.js

   Architecture: Modal-based booking. No page redirects.
   Flow: Service Card → Booking Modal → Supabase Insert → Success Modal
   ========================================================================== */

import { supabase } from './supabase.js';

/* ==========================================================================
   CONSTANTS
   ========================================================================== */

const MODAL_ID      = 'booking-modal';
const SUCCESS_ID    = 'booking-success-modal';
const OVERLAY_ID    = 'bm-overlay';
const PHONE_REGEX   = /^(\+?234|0)[7-9][0-1]\d{8}$/;

const FOCUSABLE_SELECTORS = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(', ');

/* ==========================================================================
   STATE
   ========================================================================== */

const state = {
  isOpen:             false,
  isSubmitting:       false,
  currentService:     null,
  lastFocusedElement: null,
  modalInjected:      false,
};

/* ==========================================================================
   HTML TEMPLATES
   ========================================================================== */

function buildOverlayHTML() {
  return `<div class="bm-overlay" id="${OVERLAY_ID}" aria-hidden="true"></div>`;
}

function buildModalHTML() {
  return `
    <div
      id="${MODAL_ID}"
      class="bm-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="bm-modal-title"
      aria-describedby="bm-modal-desc"
      hidden
    >
      <div class="bm-modal__inner">

        <button
          class="bm-close"
          id="bm-close-btn"
          aria-label="Close booking form"
          type="button"
        >
          <i class="fa-solid fa-xmark" aria-hidden="true"></i>
        </button>

        <div class="bm-service-summary" id="bm-service-summary" aria-label="Selected service details">
          <div class="bm-service-summary__img-wrap">
            <img
              class="bm-service-summary__img"
              id="bm-service-img"
              src=""
              alt=""
              loading="eager"
            >
            <div class="bm-service-summary__img-placeholder" id="bm-img-placeholder" aria-hidden="true" hidden>
              <i class="fa-solid fa-scissors"></i>
            </div>
          </div>
          <div class="bm-service-summary__info">
            <span class="bm-service-summary__category" id="bm-service-category"></span>
            <h2 class="bm-service-summary__name" id="bm-service-name">Book Appointment</h2>
            <div class="bm-service-summary__meta">
              <span class="bm-service-summary__price" id="bm-service-price" aria-label="Service price"></span>
              <span class="bm-service-summary__duration" id="bm-service-duration">
                <i class="fa-regular fa-clock" aria-hidden="true"></i>
                <span id="bm-service-duration-text"></span>
              </span>
            </div>
          </div>
        </div>

        <div class="bm-modal__content">
          <div class="bm-modal__header">
            <p class="bm-modal__eyebrow">
              <i class="fa-solid fa-calendar-plus" aria-hidden="true"></i>
              Book Your Appointment
            </p>
            <h2 class="bm-modal__title" id="bm-modal-title">Complete Your Booking</h2>
            <p class="bm-modal__desc" id="bm-modal-desc">
              Fill in your details and we'll confirm your appointment shortly.
            </p>
          </div>

          <form
            class="bm-form"
            id="bm-form"
            novalidate
            aria-label="Appointment booking form"
          >
            <div class="bm-form__grid">

            <div class="bm-field" id="bm-field-name">
              <label class="bm-label" for="bm-input-name">
                Full Name <span class="bm-required" aria-hidden="true">*</span>
              </label>
              <div class="bm-input-wrap">
                <i class="fa-regular fa-user bm-input-icon" aria-hidden="true"></i>
                <input
                  class="bm-input"
                  type="text"
                  id="bm-input-name"
                  name="customer_name"
                  placeholder="e.g. Amaka Johnson"
                  autocomplete="name"
                  required
                  aria-required="true"
                  aria-describedby="bm-error-name"
                >
              </div>
              <span class="bm-error" id="bm-error-name" role="alert" aria-live="polite"></span>
            </div>

            <div class="bm-field" id="bm-field-phone">
              <label class="bm-label" for="bm-input-phone">
                Phone Number <span class="bm-required" aria-hidden="true">*</span>
              </label>
              <div class="bm-input-wrap">
                <i class="fa-solid fa-phone bm-input-icon" aria-hidden="true"></i>
                <input
                  class="bm-input"
                  type="tel"
                  id="bm-input-phone"
                  name="phone_number"
                  placeholder="e.g. 08012345678"
                  autocomplete="tel"
                  required
                  aria-required="true"
                  aria-describedby="bm-error-phone"
                >
              </div>
              <span class="bm-error" id="bm-error-phone" role="alert" aria-live="polite"></span>
            </div>

            <div class="bm-field" id="bm-field-whatsapp">
              <label class="bm-label" for="bm-input-whatsapp">
                WhatsApp Number <span class="bm-required" aria-hidden="true">*</span>
              </label>
              <div class="bm-input-wrap">
                <i class="fa-brands fa-whatsapp bm-input-icon" aria-hidden="true"></i>
                <input
                  class="bm-input"
                  type="tel"
                  id="bm-input-whatsapp"
                  name="whatsapp_number"
                  placeholder="e.g. 08012345678"
                  autocomplete="tel"
                  required
                  aria-required="true"
                  aria-describedby="bm-error-whatsapp"
                >
              </div>
              <span class="bm-error" id="bm-error-whatsapp" role="alert" aria-live="polite"></span>
            </div>

            <div class="bm-field" id="bm-field-date">
              <label class="bm-label" for="bm-input-date">
                Preferred Date <span class="bm-required" aria-hidden="true">*</span>
              </label>
              <div class="bm-input-wrap">
                <i class="fa-regular fa-calendar bm-input-icon" aria-hidden="true"></i>
                <input
                  class="bm-input"
                  type="date"
                  id="bm-input-date"
                  name="appointment_date"
                  required
                  aria-required="true"
                  aria-describedby="bm-error-date"
                >
              </div>
              <span class="bm-error" id="bm-error-date" role="alert" aria-live="polite"></span>
            </div>

            <div class="bm-field" id="bm-field-time">
              <label class="bm-label" for="bm-input-time">
                Preferred Time <span class="bm-required" aria-hidden="true">*</span>
              </label>
              <div class="bm-input-wrap">
                <i class="fa-regular fa-clock bm-input-icon" aria-hidden="true"></i>
                <input
                  class="bm-input"
                  type="time"
                  id="bm-input-time"
                  name="appointment_time"
                  required
                  aria-required="true"
                  aria-describedby="bm-error-time"
                >
              </div>
              <span class="bm-error" id="bm-error-time" role="alert" aria-live="polite"></span>
            </div>

            <div class="bm-field bm-field--full" id="bm-field-notes">
              <label class="bm-label" for="bm-input-notes">
                Special Instructions
                <span class="bm-optional">(Optional)</span>
              </label>
              <div class="bm-input-wrap bm-input-wrap--textarea">
                <i class="fa-regular fa-note-sticky bm-input-icon bm-input-icon--top" aria-hidden="true"></i>
                <textarea
                  class="bm-input bm-textarea"
                  id="bm-input-notes"
                  name="notes"
                  placeholder="Any allergies, style references, or special requests..."
                  rows="3"
                  aria-describedby="bm-notes-hint"
                ></textarea>
              </div>
              <span class="bm-hint" id="bm-notes-hint">
                Share any details that will help us prepare for your appointment.
              </span>
            </div>

          </div>

          <div class="bm-submit-error" id="bm-submit-error" role="alert" aria-live="assertive" hidden>
            <i class="fa-solid fa-circle-exclamation" aria-hidden="true"></i>
            <div class="bm-submit-error__text">
              <strong>Booking Failed</strong>
              <span id="bm-submit-error-msg">Something went wrong. Please try again.</span>
            </div>
            <button class="bm-submit-error__dismiss" id="bm-error-dismiss" type="button" aria-label="Dismiss error">
              <i class="fa-solid fa-xmark" aria-hidden="true"></i>
            </button>
          </div>

            <button
              class="bm-submit-btn"
              id="bm-submit-btn"
              type="submit"
              aria-label="Confirm appointment booking"
            >
              <span class="bm-submit-btn__text">
                <i class="fa-solid fa-calendar-check" aria-hidden="true"></i>
                Confirm Booking
              </span>
              <span class="bm-submit-btn__spinner" aria-hidden="true" hidden>
                <span class="bm-spinner"></span>
                Processing...
              </span>
            </button>

          </form>
        </div>

      </div>
    </div>
  `;
}

function buildSuccessHTML() {
  return `
    <div
      id="${SUCCESS_ID}"
      class="bm-success-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="bm-success-title"
      hidden
    >
      <div class="bm-success-modal__inner">

        <div class="bm-success-icon" aria-hidden="true">
          <i class="fa-solid fa-circle-check"></i>
        </div>

        <div class="bm-success-badge" aria-hidden="true">
          <i class="fa-solid fa-crown"></i>
          Booking Received
        </div>

        <h2 class="bm-success-title" id="bm-success-title">You're All Set!</h2>
        <p class="bm-success-subtitle">
          Your appointment request has been received. We'll reach out to confirm shortly.
        </p>

        <div class="bm-success-details" id="bm-success-details" aria-label="Booking summary">

          <div class="bm-success-detail">
            <span class="bm-success-detail__label">
              <i class="fa-solid fa-scissors" aria-hidden="true"></i>
              Service
            </span>
            <span class="bm-success-detail__value" id="bm-success-service"></span>
          </div>

          <div class="bm-success-detail">
            <span class="bm-success-detail__label">
              <i class="fa-regular fa-calendar" aria-hidden="true"></i>
              Date
            </span>
            <span class="bm-success-detail__value" id="bm-success-date"></span>
          </div>

          <div class="bm-success-detail">
            <span class="bm-success-detail__label">
              <i class="fa-regular fa-clock" aria-hidden="true"></i>
              Time
            </span>
            <span class="bm-success-detail__value" id="bm-success-time"></span>
          </div>

          <div class="bm-success-detail">
            <span class="bm-success-detail__label">
              <i class="fa-regular fa-user" aria-hidden="true"></i>
              Name
            </span>
            <span class="bm-success-detail__value" id="bm-success-name"></span>
          </div>

        </div>

        <p class="bm-success-message">
          <i class="fa-brands fa-whatsapp" aria-hidden="true"></i>
          Thank you for choosing <strong>Female Dreader</strong>. We look forward to seeing you!
        </p>

        <button
          class="bm-success-close-btn"
          id="bm-success-close"
          type="button"
          aria-label="Close confirmation and return to services"
        >
          <i class="fa-solid fa-check" aria-hidden="true"></i>
          Done
        </button>

      </div>
    </div>
  `;
}

/* ==========================================================================
   DOM INJECTION — Lazy, runs once on first booking click
   ========================================================================== */

function injectModals() {
  if (state.modalInjected) return;
  state.modalInjected = true;

  document.body.insertAdjacentHTML('beforeend', buildOverlayHTML());
  document.body.insertAdjacentHTML('beforeend', buildModalHTML());
  document.body.insertAdjacentHTML('beforeend', buildSuccessHTML());

  bindModalEvents();
}

/* ==========================================================================
   DOM REFS — resolved after injection
   ========================================================================== */

function getRefs() {
  return {
    overlay:            document.getElementById(OVERLAY_ID),
    modal:              document.getElementById(MODAL_ID),
    successModal:       document.getElementById(SUCCESS_ID),
    closeBtn:           document.getElementById('bm-close-btn'),
    form:               document.getElementById('bm-form'),
    submitBtn:          document.getElementById('bm-submit-btn'),
    submitText:         document.querySelector('#bm-submit-btn .bm-submit-btn__text'),
    submitSpinner:      document.querySelector('#bm-submit-btn .bm-submit-btn__spinner'),
    submitError:        document.getElementById('bm-submit-error'),
    submitErrorMsg:     document.getElementById('bm-submit-error-msg'),
    errorDismiss:       document.getElementById('bm-error-dismiss'),

    serviceImg:         document.getElementById('bm-service-img'),
    imgPlaceholder:     document.getElementById('bm-img-placeholder'),
    serviceName:        document.getElementById('bm-service-name'),
    serviceCategory:    document.getElementById('bm-service-category'),
    servicePrice:       document.getElementById('bm-service-price'),
    serviceDuration:    document.getElementById('bm-service-duration'),
    serviceDurationTxt: document.getElementById('bm-service-duration-text'),

    inputName:          document.getElementById('bm-input-name'),
    inputPhone:         document.getElementById('bm-input-phone'),
    inputWhatsapp:      document.getElementById('bm-input-whatsapp'),
    inputDate:          document.getElementById('bm-input-date'),
    inputTime:          document.getElementById('bm-input-time'),
    inputNotes:         document.getElementById('bm-input-notes'),

    errorName:          document.getElementById('bm-error-name'),
    errorPhone:         document.getElementById('bm-error-phone'),
    errorWhatsapp:      document.getElementById('bm-error-whatsapp'),
    errorDate:          document.getElementById('bm-error-date'),
    errorTime:          document.getElementById('bm-error-time'),

    successClose:       document.getElementById('bm-success-close'),
    successService:     document.getElementById('bm-success-service'),
    successDate:        document.getElementById('bm-success-date'),
    successTime:        document.getElementById('bm-success-time'),
    successName:        document.getElementById('bm-success-name'),
  };
}

/* ==========================================================================
   UTILITIES
   ========================================================================== */

function sanitize(str) {
  if (str === null || str === undefined) return '';
  const div = document.createElement('div');
  div.textContent = String(str);
  return div.innerHTML;
}

function formatPrice(price) {
  if (price === null || price === undefined || price === '') return 'On Request';
  const numeric = parseFloat(String(price).replace(/[^0-9.]/g, ''));
  if (isNaN(numeric)) return String(price);
  return '\u20a6' + numeric.toLocaleString('en-NG');
}

function formatDateDisplay(dateStr) {
  if (!dateStr) return '';
  const [year, month, day] = dateStr.split('-');
  const date = new Date(+year, +month - 1, +day);
  return date.toLocaleDateString('en-NG', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function formatTimeDisplay(timeStr) {
  if (!timeStr) return '';
  const [h, m] = timeStr.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const hour = h % 12 || 12;
  return hour + ':' + String(m).padStart(2, '0') + ' ' + ampm;
}

function getTodayISO() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return y + '-' + m + '-' + d;
}

/* ==========================================================================
   VIEWPORT SAFE HEIGHT
   Purpose: Keeps the modal within the visible viewport on mobile browsers.
   Returns: None. Updates the CSS custom property used by the modal layout.
   ========================================================================== */

function syncViewportHeight() {
  const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 1;
  document.documentElement.style.setProperty('--vh', `${viewportHeight * 0.01}px`);
}

function initViewportHeightSync() {
  syncViewportHeight();
  window.addEventListener('resize', syncViewportHeight, { passive: true });
  window.addEventListener('orientationchange', syncViewportHeight, { passive: true });
}

/* ==========================================================================
   FOCUS TRAP
   ========================================================================== */

function trapFocus(container, event) {
  const focusables = Array.from(container.querySelectorAll(FOCUSABLE_SELECTORS));
  if (focusables.length === 0) return;

  const first = focusables[0];
  const last  = focusables[focusables.length - 1];

  if (event.shiftKey) {
    if (document.activeElement === first) {
      event.preventDefault();
      last.focus();
    }
  } else {
    if (document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }
}

/* ==========================================================================
   FIELD VALIDATION HELPERS
   ========================================================================== */

function setFieldError(inputEl, errorEl, message) {
  const field = inputEl.closest('.bm-field');
  inputEl.setAttribute('aria-invalid', 'true');
  field.classList.add('bm-field--error');
  field.classList.remove('bm-field--valid');
  errorEl.textContent = message;
}

function clearFieldError(inputEl, errorEl) {
  const field = inputEl.closest('.bm-field');
  inputEl.removeAttribute('aria-invalid');
  field.classList.remove('bm-field--error');
  field.classList.add('bm-field--valid');
  errorEl.textContent = '';
}

/* ==========================================================================
   INDIVIDUAL FIELD VALIDATORS
   ========================================================================== */

function validateName(input, errorEl) {
  const val = input.value.trim();
  if (!val) return setFieldError(input, errorEl, 'Full name is required.');
  if (val.length < 2) return setFieldError(input, errorEl, 'Please enter at least 2 characters.');
  clearFieldError(input, errorEl);
  return true;
}

function validatePhone(input, errorEl) {
  const val = input.value.trim().replace(/\s+/g, '');
  if (!val) return setFieldError(input, errorEl, 'Phone number is required.');
  if (!PHONE_REGEX.test(val)) return setFieldError(input, errorEl, 'Enter a valid Nigerian number (e.g. 08012345678).');
  clearFieldError(input, errorEl);
  return true;
}

function validateWhatsapp(input, errorEl) {
  const val = input.value.trim().replace(/\s+/g, '');
  if (!val) return setFieldError(input, errorEl, 'WhatsApp number is required.');
  if (!PHONE_REGEX.test(val)) return setFieldError(input, errorEl, 'Enter a valid Nigerian WhatsApp number.');
  clearFieldError(input, errorEl);
  return true;
}

function validateDate(input, errorEl) {
  const val = input.value;
  if (!val) return setFieldError(input, errorEl, 'Please select a preferred date.');
  if (val < getTodayISO()) return setFieldError(input, errorEl, 'Appointment date cannot be in the past.');
  clearFieldError(input, errorEl);
  return true;
}

function validateTime(input, errorEl) {
  if (!input.value) return setFieldError(input, errorEl, 'Please select a preferred time.');
  clearFieldError(input, errorEl);
  return true;
}

/* ==========================================================================
   FULL FORM VALIDATION
   ========================================================================== */

function validateForm(refs) {
  const results = [
    validateName(refs.inputName,         refs.errorName),
    validatePhone(refs.inputPhone,       refs.errorPhone),
    validateWhatsapp(refs.inputWhatsapp, refs.errorWhatsapp),
    validateDate(refs.inputDate,         refs.errorDate),
    validateTime(refs.inputTime,         refs.errorTime),
  ];
  return results.every(Boolean);
}

/* ==========================================================================
   INLINE VALIDATION ON BLUR / INPUT
   ========================================================================== */

function bindInlineValidation(refs) {
  const pairs = [
    [refs.inputName,     refs.errorName,     validateName],
    [refs.inputPhone,    refs.errorPhone,    validatePhone],
    [refs.inputWhatsapp, refs.errorWhatsapp, validateWhatsapp],
    [refs.inputDate,     refs.errorDate,     validateDate],
    [refs.inputTime,     refs.errorTime,     validateTime],
  ];

  pairs.forEach(([input, error, validator]) => {
    input.addEventListener('blur', () => {
      if (input.value.trim()) validator(input, error);
    });
    input.addEventListener('input', () => {
      if (input.getAttribute('aria-invalid') === 'true') {
        validator(input, error);
      }
    });
  });
}

/* ==========================================================================
   SERVICE SUMMARY POPULATION
   ========================================================================== */

function populateServiceSummary(refs, service) {
  const hasService = service && (service.id || service.name);

  if (!hasService) {
    refs.serviceName.textContent     = 'Choose Any Service';
    refs.serviceCategory.textContent = 'General Booking';
    refs.servicePrice.textContent    = '';
    refs.serviceDuration.hidden      = true;
    refs.serviceImg.hidden           = true;
    refs.imgPlaceholder.hidden       = false;
    return;
  }

  const name     = service.name     || 'Service';
  const category = service.category || '';
  const price    = formatPrice(service.price);
  const duration = service.duration || '';
  const imgUrl   = service.image_url || '';

  refs.serviceName.textContent     = sanitize(name);
  refs.serviceCategory.textContent = sanitize(category);
  refs.servicePrice.textContent    = price;

  if (duration) {
    refs.serviceDurationTxt.textContent = sanitize(duration);
    refs.serviceDuration.hidden = false;
  } else {
    refs.serviceDuration.hidden = true;
  }

  if (imgUrl) {
    refs.serviceImg.src            = imgUrl;
    refs.serviceImg.alt            = sanitize(name) + ' hairstyle at Female Dreader';
    refs.serviceImg.hidden         = false;
    refs.imgPlaceholder.hidden     = true;
  } else {
    refs.serviceImg.hidden         = true;
    refs.imgPlaceholder.hidden     = false;
  }
}

/* ==========================================================================
   FORM RESET
   ========================================================================== */

function resetForm(refs) {
  refs.form.reset();
  refs.submitError.hidden = true;

  refs.form.querySelectorAll('.bm-field').forEach((field) => {
    field.classList.remove('bm-field--error', 'bm-field--valid');
  });

  refs.form.querySelectorAll('[aria-invalid]').forEach((input) => {
    input.removeAttribute('aria-invalid');
  });

  refs.form.querySelectorAll('.bm-error').forEach((err) => {
    err.textContent = '';
  });

  setSubmitIdle(refs);
}

/* ==========================================================================
   SUBMIT BUTTON STATES
   ========================================================================== */

function setSubmitLoading(refs) {
  refs.submitBtn.disabled       = true;
  refs.submitText.hidden        = true;
  refs.submitSpinner.hidden     = false;
  refs.submitBtn.setAttribute('aria-busy', 'true');
}

function setSubmitIdle(refs) {
  refs.submitBtn.disabled       = false;
  refs.submitText.hidden        = false;
  refs.submitSpinner.hidden     = true;
  refs.submitBtn.removeAttribute('aria-busy');
}

/* ==========================================================================
   OPEN / CLOSE — BOOKING MODAL
   ========================================================================== */

function openModal(service) {
  injectModals();

  const refs = getRefs();
  state.isOpen             = true;
  state.currentService     = service;
  state.lastFocusedElement = document.activeElement;
  syncViewportHeight();

  populateServiceSummary(refs, service);
  resetForm(refs);

  refs.inputDate.min    = getTodayISO();
  refs.modal.hidden     = false;
  refs.overlay.hidden   = false;
  document.body.classList.add('bm-body-locked');
  // Pause Lenis to prevent background scrolling while modal is open
  if (window.FDScroll) window.FDScroll.pause();

  requestAnimationFrame(() => {
    refs.modal.classList.add('bm-modal--open');
    refs.overlay.classList.add('bm-overlay--open');
    refs.inputName.focus();
  });
}

function closeModal() {
  const refs = getRefs();
  state.isOpen = false;

  refs.modal.classList.remove('bm-modal--open');
  refs.overlay.classList.remove('bm-overlay--open');
  document.body.classList.remove('bm-body-locked');
  // Resume Lenis when modal closes
  if (window.FDScroll) window.FDScroll.resume();

  setTimeout(() => {
    refs.modal.hidden   = true;
    refs.overlay.hidden = true;
  }, 350);

  if (state.lastFocusedElement) {
    state.lastFocusedElement.focus();
    state.lastFocusedElement = null;
  }
}

/* ==========================================================================
   OPEN / CLOSE — SUCCESS MODAL
   ========================================================================== */

function openSuccessModal(bookingData) {
  const refs = getRefs();

  refs.successService.textContent = bookingData.service_name  || 'General Appointment';
  refs.successDate.textContent    = formatDateDisplay(bookingData.appointment_date);
  refs.successTime.textContent    = formatTimeDisplay(bookingData.appointment_time);
  refs.successName.textContent    = bookingData.customer_name || '';

  refs.successModal.hidden = false;

  requestAnimationFrame(() => {
    refs.successModal.classList.add('bm-success-modal--open');
    if (refs.successClose) refs.successClose.focus();
  });
}

function closeSuccessModal() {
  const refs = getRefs();
  refs.successModal.classList.remove('bm-success-modal--open');

  setTimeout(() => {
    refs.successModal.hidden = true;
    if (state.lastFocusedElement) {
      state.lastFocusedElement.focus();
      state.lastFocusedElement = null;
    }
  }, 350);
}

/* ==========================================================================
   SUPABASE SUBMISSION
   ========================================================================== */

async function submitBooking(refs) {
  if (state.isSubmitting) return;

  if (!validateForm(refs)) {
    const firstError = refs.form.querySelector('[aria-invalid="true"]');
    if (firstError) firstError.focus();
    return;
  }

  state.isSubmitting = true;
  setSubmitLoading(refs);
  refs.submitError.hidden = true;

  const service = state.currentService || {};

  const payload = {
    service_id:       service.id        || null,
    service_name:     service.name      || null,
    customer_name:    refs.inputName.value.trim(),
    phone_number:     refs.inputPhone.value.trim().replace(/\s+/g, ''),
    whatsapp_number:  refs.inputWhatsapp.value.trim().replace(/\s+/g, ''),
    appointment_date: refs.inputDate.value,
    appointment_time: refs.inputTime.value,
    notes:            refs.inputNotes.value.trim() || null,
    status:           'pending',
  };

  try {
    const { error } = await supabase.from('bookings').insert([payload]);

    if (error) throw error;

    state.isSubmitting = false;
    closeModal();
    openSuccessModal(payload);

  } catch (err) {
    console.error('[Female Dreader] Booking submission failed:', err);
    state.isSubmitting = false;
    setSubmitIdle(refs);

    const message = (err && err.message) ? err.message : 'Something went wrong. Please check your connection and try again.';
    refs.submitErrorMsg.textContent = message;
    refs.submitError.hidden = false;
    if (window.FDScroll) {
      window.FDScroll.scrollTo(refs.submitError, { offset: -20 });
    } else {
      refs.submitError.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }
}

/* ==========================================================================
   EVENT BINDING
   ========================================================================== */

function bindModalEvents() {
  const refs = getRefs();

  refs.closeBtn.addEventListener('click', closeModal);
  refs.overlay.addEventListener('click', closeModal);

  refs.form.addEventListener('submit', (e) => {
    e.preventDefault();
    submitBooking(refs);
  });

  refs.errorDismiss.addEventListener('click', () => {
    refs.submitError.hidden = true;
  });

  refs.successClose.addEventListener('click', closeSuccessModal);

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      const successOpen = !getRefs().successModal.hidden;
      if (successOpen) { closeSuccessModal(); return; }
      if (state.isOpen) closeModal();
      return;
    }

    if (e.key === 'Tab' && state.isOpen) {
      const r = getRefs();
      const activeContainer = !r.successModal.hidden ? r.successModal : r.modal;
      trapFocus(activeContainer, e);
    }
  });

  bindInlineValidation(refs);
}

/* ==========================================================================
   EVENT DELEGATION — "Book Appointment" clicks (page-level)
   ========================================================================== */

function handleBookingClick(event) {
  const trigger = event.target.closest('[data-book-service]');
  if (!trigger) return;

  event.preventDefault();

  let serviceData = {};
  try {
    serviceData = JSON.parse(trigger.dataset.bookService || '{}');
  } catch (_) {
    serviceData = {};
  }

  openModal(serviceData);
}

/* ==========================================================================
   PUBLIC API
   ========================================================================== */

let _bookingModalInitialised = false;

export function initBookingModal() {
  if (_bookingModalInitialised) return;
  _bookingModalInitialised = true;
  initViewportHeightSync();
  document.addEventListener('click', handleBookingClick);
}

export { openModal };
