/**
 * Booking Management Modal
 * admin/js/booking-modal.js
 *
 * A fully self-contained, accessible modal for managing a single booking.
 * Dispatches a 'bookingUpdated' CustomEvent on document after any successful
 * Supabase update so that bookings.js can refresh the table without a full refetch.
 *
 * Architecture:
 *   - BookingModal.open(booking)   → renders and opens the modal
 *   - BookingModal._close()        → cleans up DOM + listeners
 *   - All Supabase calls delegated to booking-service.js
 *   - WhatsApp button is a disabled placeholder — wired for future integration
 */

import {
  updateBookingStatus,
  rescheduleBooking,
  getStatusBadgeClass,
  BOOKING_STATUSES,
} from './booking-service.js';
import { Toast } from '../components/toast.js';

// ─────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────

const fmt = {
  date: (d) => {
    if (!d) return '—';
    const dt = new Date(d);
    return isNaN(dt.getTime())
      ? String(d)
      : dt.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  },
  time: (t) => {
    if (!t) return '—';
    const tStr = String(t);
    // Convert HH:MM → 12-hour with AM/PM
    const [h, m] = tStr.split(':').map(Number);
    if (isNaN(h) || isNaN(m)) return tStr;
    const ampm = h >= 12 ? 'PM' : 'AM';
    const hour = ((h + 11) % 12) + 1;
    return `${hour}:${String(m).padStart(2, '0')} ${ampm}`;
  },
  shortId: (id, ref) => {
    if (ref != null && String(ref).trim() !== '') {
      return String(ref).toUpperCase();
    }
    if (id == null) return '—';
    const str = String(id);
    return str.length > 8 ? str.substring(0, 8).toUpperCase() : str.toUpperCase();
  },
};

// ─────────────────────────────────────────────────────────────
// TIMELINE BUILDER
// ─────────────────────────────────────────────────────────────

const buildTimeline = (booking) => {
  /**
   * We use available timestamps. When a dedicated history table exists,
   * replace this array with real history rows — the HTML template below
   * stays identical.
   */
  const events = [
    {
      label: 'Booking Created',
      date: booking.created_at,
      icon: 'fa-calendar-plus',
      active: true,
    },
  ];

  const statusEventMap = {
    Confirmed:   { label: 'Booking Confirmed',   icon: 'fa-circle-check'  },
    Completed:   { label: 'Booking Completed',   icon: 'fa-star'          },
    Cancelled:   { label: 'Booking Cancelled',   icon: 'fa-ban'           },
    Rescheduled: { label: 'Booking Rescheduled', icon: 'fa-calendar-days' },
  };

  const currentEvent = statusEventMap[booking.status];
  if (currentEvent) {
    events.push({
      ...currentEvent,
      date: booking.updated_at || booking.created_at,
      active: true,
    });
  }

  return events
    .map(
      (ev, i) => `
      <div class="bm-timeline__item ${ev.active ? 'bm-timeline__item--active' : ''}">
        <div class="bm-timeline__dot">
          <i class="fa-solid ${ev.icon}"></i>
        </div>
        ${i < events.length - 1 ? '<div class="bm-timeline__line"></div>' : ''}
        <div class="bm-timeline__content">
          <span class="bm-timeline__label">${ev.label}</span>
          <span class="bm-timeline__date">${fmt.date(ev.date)}</span>
        </div>
      </div>
    `
    )
    .join('');
};

// ─────────────────────────────────────────────────────────────
// MODAL HTML BUILDER
// ─────────────────────────────────────────────────────────────

const getSafeString = (val, fallback = '—') => (val != null && String(val).trim() !== '') ? String(val).trim() : fallback;

const buildModalHtml = (b) => {
  console.log('[DEBUG] buildModalHtml: Starting HTML generation');
  console.log('[DEBUG] buildModalHtml: Booking object:', b);
  console.log(`[DEBUG] buildModalHtml: Booking ID type: ${typeof b.id}, value: ${b.id}`);
  
  const safeId = getSafeString(b.id);
  const safeRef = b.booking_reference ? getSafeString(b.booking_reference) : null;
  const displayId = fmt.shortId(b.id, b.booking_reference);
  
  console.log(`[DEBUG] buildModalHtml: shortId input id: ${b.id}, ref: ${b.booking_reference}`);
  console.log(`[DEBUG] buildModalHtml: shortId output: ${displayId}`);

  const badgeClass = getStatusBadgeClass(b.status);
  const statusOptions = BOOKING_STATUSES.map(
    (s) => `<option value="${s}" ${b.status === s ? 'selected' : ''}>${s}</option>`
  ).join('');

  const notes = b.notes
    ? `<p class="bm-notes__text">${getSafeString(b.notes)}</p>`
    : `<p class="bm-notes__text bm-notes__text--empty"><i class="fa-solid fa-circle-info"></i> No special notes provided.</p>`;

  const custName = getSafeString(b.customer_name, 'Unknown');
  const avatarLetter = custName !== 'Unknown' ? custName.charAt(0).toUpperCase() : '?';

  const safePhone = getSafeString(b.phone_number);
  const safeWhatsapp = getSafeString(b.whatsapp_number, b.phone_number);
  
  const phoneLink = safePhone !== '—' 
    ? `<a href="tel:${safePhone.replace(/[^0-9+]/g,'')}" class="bm-field__link" title="Call"><i class="fa-solid fa-phone"></i></a>` 
    : '';
    
  const whatsappLink = safeWhatsapp !== '—'
    ? `<a href="https://wa.me/${safeWhatsapp.replace(/[^0-9+]/g,'')}" target="_blank" class="bm-field__link bm-field__link--whatsapp" title="WhatsApp"><i class="fa-brands fa-whatsapp"></i></a>`
    : '';

  return `
    <div class="bm-wrap">

      <!-- ── CUSTOMER BANNER ── -->
      <div class="bm-banner">
        <div class="bm-banner__avatar">${avatarLetter}</div>
        <div class="bm-banner__info">
          <h4 class="bm-banner__name" id="bm-customer-name">${custName}</h4>
          <span class="bm-banner__id">Booking #${displayId}</span>
        </div>
        <span class="admin-badge ${badgeClass} bm-banner__badge" id="bm-status-badge">${getSafeString(b.status, 'Pending')}</span>
      </div>

      <!-- ── BOOKING INFO GRID ── -->
      <div class="bm-section">
        <h5 class="bm-section__title"><i class="fa-solid fa-circle-info"></i> Booking Details</h5>
        <div class="bm-grid">
          <div class="bm-field">
            <span class="bm-field__label">Phone Number</span>
            <span class="bm-field__value">
              ${safePhone}
              ${phoneLink}
            </span>
          </div>
          <div class="bm-field">
            <span class="bm-field__label">WhatsApp Number</span>
            <span class="bm-field__value">
              ${safeWhatsapp}
              ${whatsappLink}
            </span>
          </div>
          <div class="bm-field">
            <span class="bm-field__label">Appointment Date</span>
            <span class="bm-field__value" id="bm-appt-date">${fmt.date(b.appointment_date)}</span>
          </div>
          <div class="bm-field">
            <span class="bm-field__label">Appointment Time</span>
            <span class="bm-field__value" id="bm-appt-time">${fmt.time(b.appointment_time)}</span>
          </div>
          <div class="bm-field bm-field--full">
            <span class="bm-field__label">Service</span>
            <span class="bm-field__value bm-field__value--highlight">${getSafeString(b.service)}</span>
          </div>
          ${b.category ? `
          <div class="bm-field">
            <span class="bm-field__label">Category</span>
            <span class="bm-field__value">${getSafeString(b.category)}</span>
          </div>` : ''}
          <div class="bm-field">
            <span class="bm-field__label">Booked On</span>
            <span class="bm-field__value">${fmt.date(b.created_at)}</span>
          </div>
          <div class="bm-field">
            <span class="bm-field__label">Booking ID</span>
            <span class="bm-field__value bm-field__value--mono">${safeId}</span>
          </div>
          ${safeRef ? `
          <div class="bm-field">
            <span class="bm-field__label">Reference</span>
            <span class="bm-field__value bm-field__value--mono">${safeRef}</span>
          </div>` : ''}
        </div>
      </div>

      <!-- ── SPECIAL NOTES ── -->
      <div class="bm-section">
        <h5 class="bm-section__title"><i class="fa-solid fa-note-sticky"></i> Special Notes</h5>
        <div class="bm-notes">${notes}</div>
      </div>

      <!-- ── STATUS MANAGEMENT ── -->
      <div class="bm-section">
        <h5 class="bm-section__title"><i class="fa-solid fa-sliders"></i> Status Management</h5>
        <div class="bm-status-row">
          <div class="admin-form-group" style="margin:0; flex:1;">
            <label class="admin-form-label" for="bm-status-select">Update Status</label>
            <select id="bm-status-select" class="admin-form-input">
              ${statusOptions}
            </select>
          </div>
          <button class="admin-btn admin-btn--gold bm-save-btn" id="bm-save-btn" type="button">
            <i class="fa-solid fa-floppy-disk"></i>
            <span>Save Changes</span>
          </button>
        </div>
      </div>

      <!-- ── QUICK ACTIONS ── -->
      <div class="bm-section">
        <h5 class="bm-section__title"><i class="fa-solid fa-bolt"></i> Quick Actions</h5>
        <div class="bm-actions">
          <button class="admin-btn bm-action-btn bm-action-btn--confirm" id="bm-confirm-btn" type="button" data-action="Confirmed">
            <i class="fa-solid fa-circle-check"></i> Confirm
          </button>
          <button class="admin-btn bm-action-btn bm-action-btn--complete" id="bm-complete-btn" type="button" data-action="Completed">
            <i class="fa-solid fa-star"></i> Complete
          </button>
          <button class="admin-btn bm-action-btn bm-action-btn--cancel" id="bm-cancel-btn" type="button" data-action="Cancelled">
            <i class="fa-solid fa-ban"></i> Cancel
          </button>
          <button class="admin-btn bm-action-btn bm-action-btn--reschedule" id="bm-reschedule-btn" type="button">
            <i class="fa-solid fa-calendar-days"></i> Reschedule
          </button>
        </div>
      </div>

      <!-- ── RESCHEDULE SECTION (hidden by default) ── -->
      <div class="bm-section bm-reschedule-section" id="bm-reschedule-section" aria-hidden="true">
        <h5 class="bm-section__title bm-section__title--reschedule">
          <i class="fa-solid fa-calendar-days"></i> Reschedule Appointment
        </h5>
        <div class="bm-grid">
          <div class="admin-form-group bm-reschedule-group" id="bm-date-group">
            <label class="admin-form-label" for="bm-new-date">New Appointment Date</label>
            <input type="date" id="bm-new-date" class="admin-form-input" min="${new Date().toISOString().split('T')[0]}">
            <span class="admin-form-error" id="bm-date-error">Please select a valid future date.</span>
          </div>
          <div class="admin-form-group bm-reschedule-group" id="bm-time-group">
            <label class="admin-form-label" for="bm-new-time">New Appointment Time</label>
            <input type="time" id="bm-new-time" class="admin-form-input">
            <span class="admin-form-error" id="bm-time-error">Please enter a valid time.</span>
          </div>
        </div>
        <div style="display:flex; justify-content:flex-end; margin-top:0.75rem;">
          <button class="admin-btn bm-action-btn bm-action-btn--reschedule" id="bm-apply-reschedule-btn" type="button">
            <i class="fa-solid fa-check"></i> Apply Reschedule
          </button>
        </div>
      </div>

      <!-- ── BOOKING TIMELINE ── -->
      <div class="bm-section">
        <h5 class="bm-section__title"><i class="fa-solid fa-timeline"></i> Booking Timeline</h5>
        <div class="bm-timeline" id="bm-timeline">
          ${buildTimeline(b)}
        </div>
      </div>

    </div>
  `;
};

// ─────────────────────────────────────────────────────────────
// MODAL FOOTER HTML
// ─────────────────────────────────────────────────────────────

const buildFooterHtml = (bookingId) => `
  <div class="bm-footer">
    <button
      class="admin-btn bm-whatsapp-btn"
      id="bm-whatsapp-btn"
      type="button"
      disabled
      title="WhatsApp Cloud API integration coming soon"
      data-booking-id="${bookingId}"
    >
      <i class="fa-brands fa-whatsapp"></i>
      Send WhatsApp Notification
    </button>
    <button class="admin-btn admin-btn--outline bm-close-modal-btn" id="bm-close-btn" type="button">
      <i class="fa-solid fa-xmark"></i> Close
    </button>
  </div>
`;

// ─────────────────────────────────────────────────────────────
// BOOKING MODAL CLASS
// ─────────────────────────────────────────────────────────────

export class BookingModal {
  /**
   * @param {Object} booking - The full booking record from Supabase
   */
  constructor(booking) {
    if (!booking || typeof booking !== 'object' || !booking.id) {
      throw new Error('[BookingModal] Invalid booking data provided to constructor.');
    }
    
    this.booking = { ...booking };
    this._overlay = null;
    this._isBusy = false;
    this._rescheduleVisible = false;

    // Bind methods for clean listener removal
    this._onKeyDown = this._onKeyDown.bind(this);
    this._onOverlayClick = this._onOverlayClick.bind(this);
    
    console.log(`[DEBUG] BookingModal: Constructor initialized for booking ID ${this.booking.id}`);
  }

  // ── PUBLIC API ──────────────────────────────────────────────

  open() {
    console.log('[DEBUG] BookingModal: Starting modal render sequence...');
    this._render();
    this._attachListeners();

    // Pause Lenis to prevent background scrolling while modal is open
    if (window.FDScroll) window.FDScroll.pause();
    // Lock body scroll
    document.body.style.overflow = 'hidden';

    requestAnimationFrame(() => {
      this._overlay.classList.add('active');
      this._overlay.setAttribute('aria-hidden', 'false');
      console.log('[DEBUG] BookingModal: Modal successfully displayed.');
    });
  }

  // ── RENDER ──────────────────────────────────────────────────

  _render() {
    const existing = document.getElementById('booking-manage-modal');
    if (existing) existing.remove();

    this._overlay = document.createElement('div');
    this._overlay.className = 'admin-modal-overlay';
    this._overlay.id = 'booking-manage-modal';
    this._overlay.setAttribute('role', 'dialog');
    this._overlay.setAttribute('aria-modal', 'true');
    this._overlay.setAttribute('aria-hidden', 'true');
    this._overlay.setAttribute('aria-labelledby', 'bm-modal-title');

    this._overlay.innerHTML = `
      <div class="admin-modal bm-modal" role="document">

        <!-- HEADER -->
        <div class="admin-modal__header">
          <div class="bm-modal-title-wrap">
            <h3 class="admin-modal__title" id="bm-modal-title">
              <i class="fa-regular fa-calendar-check"></i> Manage Booking
            </h3>
          </div>
          <button type="button" class="admin-modal__close" id="bm-header-close-btn" aria-label="Close modal">
            <i class="fa-solid fa-xmark"></i>
          </button>
        </div>

        <!-- BODY (scrollable) -->
        <div class="admin-modal__body bm-body">
          ${buildModalHtml(this.booking)}
        </div>

        <!-- FOOTER -->
        <div class="admin-modal__footer bm-footer-wrap">
          ${buildFooterHtml(this.booking.id)}
        </div>

      </div>
    `;

    document.body.appendChild(this._overlay);
  }

  // ── LISTENERS ───────────────────────────────────────────────

  _attachListeners() {
    // Close triggers
    this._overlay.querySelector('#bm-header-close-btn').addEventListener('click', () => this._close());
    this._overlay.querySelector('#bm-close-btn').addEventListener('click', () => this._close());
    this._overlay.addEventListener('click', this._onOverlayClick);
    document.addEventListener('keydown', this._onKeyDown);

    // Save status change
    this._overlay.querySelector('#bm-save-btn').addEventListener('click', () => this._handleSave());

    // Quick action buttons
    this._overlay.querySelector('#bm-confirm-btn').addEventListener('click',  () => this._handleQuickAction('Confirmed'));
    this._overlay.querySelector('#bm-complete-btn').addEventListener('click', () => this._handleQuickAction('Completed'));
    this._overlay.querySelector('#bm-cancel-btn').addEventListener('click',   () => this._handleQuickAction('Cancelled'));
    this._overlay.querySelector('#bm-reschedule-btn').addEventListener('click', () => this._toggleReschedule());

    // Apply reschedule
    this._overlay.querySelector('#bm-apply-reschedule-btn').addEventListener('click', () => this._handleReschedule());
  }

  _onOverlayClick(e) {
    if (e.target === this._overlay) this._close();
  }

  _onKeyDown(e) {
    if (e.key === 'Escape') this._close();
  }

  // ── CLOSE ───────────────────────────────────────────────────

  _close() {
    if (!this._overlay) return;
    this._overlay.classList.remove('active');
    this._overlay.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
    // Resume Lenis when modal closes
    if (window.FDScroll) window.FDScroll.resume();
    document.removeEventListener('keydown', this._onKeyDown);

    setTimeout(() => {
      if (this._overlay && this._overlay.parentNode) {
        this._overlay.remove();
        this._overlay = null;
      }
    }, 300);
  }

  // ── BUSY STATE ──────────────────────────────────────────────

  _setAllButtonsBusy(busy) {
    const btns = this._overlay.querySelectorAll('button:not(#bm-whatsapp-btn)');
    btns.forEach((btn) => {
      btn.disabled = busy;
    });
    this._isBusy = busy;
  }

  _setBtnLoading(btn, loading, originalHtml) {
    if (loading) {
      btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Saving...';
    } else {
      btn.innerHTML = originalHtml;
    }
  }

  // ── SAVE STATUS ─────────────────────────────────────────────

  async _handleSave() {
    if (this._isBusy) return;

    const select = this._overlay.querySelector('#bm-status-select');
    const newStatus = select.value;

    if (newStatus === this.booking.status) {
      Toast.show('No changes to save.', 'info');
      return;
    }

    const saveBtn = this._overlay.querySelector('#bm-save-btn');
    const original = saveBtn.innerHTML;

    this._setAllButtonsBusy(true);
    this._setBtnLoading(saveBtn, true);

    try {
      const updated = await updateBookingStatus(this.booking.id, newStatus);
      this.booking = { ...this.booking, ...updated };
      this._refreshBadgeAndStatus(newStatus);
      this._refreshTimeline();
      this._dispatchUpdate();
      Toast.show(`Status updated to ${newStatus}.`, 'success');
      this._close();
    } catch (err) {
      console.error('[BookingModal] Save error:', err);
      Toast.show('Failed to update status. Please try again.', 'error');
    } finally {
      if (this._overlay) {
        this._setAllButtonsBusy(false);
        this._setBtnLoading(saveBtn, false, original);
      }
    }
  }

  // ── QUICK ACTION ────────────────────────────────────────────

  async _handleQuickAction(status) {
    if (this._isBusy) return;
    if (status === this.booking.status) {
      Toast.show(`Booking is already ${status}.`, 'info');
      return;
    }

    const btnId = {
      Confirmed: '#bm-confirm-btn',
      Completed: '#bm-complete-btn',
      Cancelled: '#bm-cancel-btn',
    }[status];
    const btn = this._overlay.querySelector(btnId);
    const original = btn.innerHTML;

    this._setAllButtonsBusy(true);
    this._setBtnLoading(btn, true);

    try {
      const updated = await updateBookingStatus(this.booking.id, status);
      this.booking = { ...this.booking, ...updated };
      this._refreshBadgeAndStatus(status);
      // Sync the status dropdown
      this._overlay.querySelector('#bm-status-select').value = status;
      this._refreshTimeline();
      this._dispatchUpdate();
      Toast.show(`Booking ${status.toLowerCase()} successfully.`, 'success');
      this._close();
    } catch (err) {
      console.error('[BookingModal] Quick action error:', err);
      Toast.show(`Failed to mark as ${status}.`, 'error');
    } finally {
      if (this._overlay) {
        this._setAllButtonsBusy(false);
        this._setBtnLoading(btn, false, original);
      }
    }
  }

  // ── RESCHEDULE ──────────────────────────────────────────────

  _toggleReschedule() {
    this._rescheduleVisible = !this._rescheduleVisible;
    const section = this._overlay.querySelector('#bm-reschedule-section');
    const btn = this._overlay.querySelector('#bm-reschedule-btn');

    if (this._rescheduleVisible) {
      section.classList.add('bm-reschedule-section--visible');
      section.setAttribute('aria-hidden', 'false');
      btn.innerHTML = '<i class="fa-solid fa-xmark"></i> Hide Reschedule';
      // Scroll into view using Lenis if available
      if (window.FDScroll) {
        window.FDScroll.scrollTo(section, { offset: -20 });
      } else {
        section.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    } else {
      section.classList.remove('bm-reschedule-section--visible');
      section.setAttribute('aria-hidden', 'true');
      btn.innerHTML = '<i class="fa-solid fa-calendar-days"></i> Reschedule';
      this._clearRescheduleErrors();
    }
  }

  async _handleReschedule() {
    if (this._isBusy) return;

    const dateInput = this._overlay.querySelector('#bm-new-date');
    const timeInput = this._overlay.querySelector('#bm-new-time');
    const applyBtn  = this._overlay.querySelector('#bm-apply-reschedule-btn');

    this._clearRescheduleErrors();

    let valid = true;

    // Validate date
    if (!dateInput.value) {
      this._showFieldError('bm-date-group', 'bm-date-error', 'Please select a new appointment date.');
      valid = false;
    } else {
      const selected = new Date(dateInput.value);
      const today    = new Date();
      today.setHours(0, 0, 0, 0);
      if (selected < today) {
        this._showFieldError('bm-date-group', 'bm-date-error', 'Appointment date cannot be in the past.');
        valid = false;
      }
    }

    // Validate time
    if (!timeInput.value) {
      this._showFieldError('bm-time-group', 'bm-time-error', 'Please select a new appointment time.');
      valid = false;
    }

    if (!valid) return;

    const original = applyBtn.innerHTML;
    this._setAllButtonsBusy(true);
    this._setBtnLoading(applyBtn, true);

    try {
      const updated = await rescheduleBooking(this.booking.id, dateInput.value, timeInput.value);
      this.booking = { ...this.booking, ...updated };

      // Refresh displayed date/time
      const apptDateEl = this._overlay.querySelector('#bm-appt-date');
      const apptTimeEl = this._overlay.querySelector('#bm-appt-time');
      if (apptDateEl) apptDateEl.textContent = fmt.date(dateInput.value);
      if (apptTimeEl) apptTimeEl.textContent = fmt.time(timeInput.value);

      this._refreshBadgeAndStatus('Rescheduled');
      this._overlay.querySelector('#bm-status-select').value = 'Rescheduled';
      this._refreshTimeline();
      this._dispatchUpdate();
      Toast.show('Booking rescheduled successfully.', 'success');
      this._close();
    } catch (err) {
      console.error('[BookingModal] Reschedule error:', err);
      Toast.show('Failed to reschedule booking. Please try again.', 'error');
    } finally {
      if (this._overlay) {
        this._setAllButtonsBusy(false);
        this._setBtnLoading(applyBtn, false, original);
      }
    }
  }

  // ── VALIDATION HELPERS ──────────────────────────────────────

  _showFieldError(groupId, errorId, message) {
    const group = this._overlay.querySelector(`#${groupId}`);
    const error = this._overlay.querySelector(`#${errorId}`);
    if (group) group.classList.add('error');
    if (error) {
      error.textContent = message;
      error.style.display = 'block';
    }
  }

  _clearRescheduleErrors() {
    ['bm-date-group', 'bm-time-group'].forEach((id) => {
      const el = this._overlay.querySelector(`#${id}`);
      if (el) el.classList.remove('error');
    });
    ['bm-date-error', 'bm-time-error'].forEach((id) => {
      const el = this._overlay.querySelector(`#${id}`);
      if (el) el.style.display = 'none';
    });
  }

  // ── UI REFRESH HELPERS ──────────────────────────────────────

  _refreshBadgeAndStatus(status) {
    const badge = this._overlay.querySelector('#bm-status-badge');
    if (badge) {
      badge.className = `admin-badge ${getStatusBadgeClass(status)} bm-banner__badge`;
      badge.textContent = status;
    }
  }

  _refreshTimeline() {
    const timeline = this._overlay.querySelector('#bm-timeline');
    if (timeline) {
      timeline.innerHTML = buildTimeline(this.booking);
    }
  }

  // ── CUSTOM EVENT ────────────────────────────────────────────

  /**
   * Dispatches a 'bookingUpdated' event so bookings.js can update
   * its in-memory data and re-render the table without a network refetch.
   */
  _dispatchUpdate() {
    document.dispatchEvent(
      new CustomEvent('bookingUpdated', {
        bubbles: true,
        detail: { booking: { ...this.booking } },
      })
    );
  }
}
