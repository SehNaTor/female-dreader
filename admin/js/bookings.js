/**
 * Bookings Page Controller
 * admin/js/bookings.js
 */

import { requireAuth } from './auth.js';
import { injectLayout } from '../components/layout.js';
import { supabase } from './supabase.js';
import { renderTable } from '../components/table.js';
import { showLoader } from '../components/loader.js';
import { Toast } from '../components/toast.js';
import { BookingModal } from './booking-modal.js';
import { normalizeStatus, compareStatus, getStatusBadgeClass } from './status-utils.js';

// ─────────────────────────────────────────────────────────────
// STATE MANAGEMENT
// ─────────────────────────────────────────────────────────────

const mapBooking = (b) => ({
  ...b,
  service: b.service_name || b.service || 'Not Specified',
});

const BookingState = {
  data: [],
  set(bookings) {
    this.data = (bookings || []).map(mapBooking);
  },
  get(id) {
    return this.data.find((b) => String(b.id) === String(id));
  },
  update(updatedBooking) {
    const idx = this.data.findIndex((b) => String(b.id) === String(updatedBooking.id));
    if (idx !== -1) {
      this.data[idx] = mapBooking({ ...this.data[idx], ...updatedBooking });
    }
  },
  getAll() {
    return this.data;
  }
};

// ─────────────────────────────────────────────────────────────
// INIT
// ─────────────────────────────────────────────────────────────
const initBookings = async () => {
  console.log('[DEBUG] initBookings: Module initialization started.');
  const user = await requireAuth();
  if (!user) {
    console.log('[DEBUG] initBookings: Authentication failed.');
    return;
  }

  // Layout injection completely rewrites the DOM body.
  injectLayout('Bookings Management', 'bookings');

  // Set up robust global event delegation AFTER layout is injected
  setupEventDelegation();
  
  // Set up filter UI listeners
  const searchInput = document.getElementById('search-bookings');
  const statusSelect = document.getElementById('filter-status');
  if (searchInput) searchInput.addEventListener('input', applyFilters);
  if (statusSelect) statusSelect.addEventListener('change', applyFilters);

  // Live update listener
  document.addEventListener('bookingUpdated', (e) => {
    const updated = e.detail?.booking;
    if (!updated) return;
    BookingState.update(updated);
    applyFilters();
  });

  await fetchBookings();
  console.log('[DEBUG] initBookings: Module initialization complete.');
};

// ─────────────────────────────────────────────────────────────
// ROBUST EVENT DELEGATION
// ─────────────────────────────────────────────────────────────
const setupEventDelegation = () => {
  console.log('[DEBUG] setupEventDelegation: Registering global click listener on document.body.');
  
  // Using document.body ensures the listener survives any innerHTML replacements
  document.body.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-action="manage"]');
    if (!btn) return;
    
    console.log('[DEBUG] setupEventDelegation: Click detection triggered on Manage button.');
    
    // Prevent default behavior just in case
    e.preventDefault();
    e.stopPropagation();

    const id = btn.dataset.bookingId;
    console.log(`[DEBUG] setupEventDelegation: Button dataset parsed. Booking ID: ${id}`);
    
    openManageModal(id);
  });
};

// ─────────────────────────────────────────────────────────────
// DATA FETCHING
// ─────────────────────────────────────────────────────────────
const fetchBookings = async () => {
  console.log('[DEBUG] fetchBookings: Fetching data from Supabase...');
  showLoader('bookings-table-container');
  try {
    const { data, error } = await supabase
      .from('bookings')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    
    BookingState.set(data || []);
    console.log(`[DEBUG] fetchBookings: Successfully loaded ${BookingState.getAll().length} bookings.`);
    applyFilters();
  } catch (err) {
    console.error('[Bookings] Fetch error:', err);
    Toast.show('Failed to load bookings.', 'error');
  }
};

// ─────────────────────────────────────────────────────────────
// FILTER + SEARCH
// ─────────────────────────────────────────────────────────────
const applyFilters = () => {
  const term = (document.getElementById('search-bookings')?.value ?? '').toLowerCase();
  const statusFilter = document.getElementById('filter-status')?.value ?? 'All';

  const filtered = BookingState.getAll().filter((b) => {
    const matchSearch =
      (b.customer_name  && b.customer_name.toLowerCase().includes(term)) ||
      (b.phone_number   && b.phone_number.includes(term)) ||
      (b.whatsapp_number && b.whatsapp_number.includes(term)) ||
      (b.service        && b.service.toLowerCase().includes(term));

    const matchStatus = statusFilter === 'All' || compareStatus(b.status, statusFilter);

    return matchSearch && matchStatus;
  });

  renderBookingsTable(filtered);
};

// ─────────────────────────────────────────────────────────────
// TABLE RENDER
// ─────────────────────────────────────────────────────────────
const renderBookingsTable = (data) => {
  const columns = ['Customer', 'Service', 'Date & Time', 'Status', 'Received', 'Actions'];

  const rowRender = (item) => {
    const normalizedStatus = normalizeStatus(item.status);
    const badgeClass  = getStatusBadgeClass(normalizedStatus);
    const statusBadge = `<span class="admin-badge ${badgeClass}">${normalizedStatus}</span>`;
    const createdDate = new Date(item.created_at).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
    });
    const apptDate = item.appointment_date
      ? new Date(item.appointment_date).toLocaleDateString()
      : '—';

    return `
      <td>
        <div style="font-weight:600;color:var(--admin-text-main);">${item.customer_name}</div>
        <div style="font-size:0.8rem;color:var(--admin-text-muted);">${item.phone_number || ''}</div>
      </td>
      <td>
        <div style="max-width:200px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;" title="${item.service}">
          ${item.service}
        </div>
      </td>
      <td>
        <div>${apptDate}</div>
        <div style="font-size:0.8rem;color:var(--admin-text-muted);">
          <i class="fa-regular fa-clock"></i> ${item.appointment_time || '—'}
        </div>
      </td>
      <td>${statusBadge}</td>
      <td>
        <span class="text-muted" style="font-size:0.85rem;">${createdDate}</span>
      </td>
      <td>
        <div class="admin-table-actions">
          <button
            type="button"
            class="admin-btn admin-btn--outline"
            style="padding:0.35rem 0.75rem;font-size:0.8rem;"
            data-booking-id="${item.id}"
            data-action="manage"
          >
            <i class="fa-solid fa-pen-to-square"></i> Manage
          </button>
        </div>
      </td>
    `;
  };

  renderTable('bookings-table-container', columns, data, rowRender, 'No bookings found.');
};

// ─────────────────────────────────────────────────────────────
// MANAGE MODAL
// ─────────────────────────────────────────────────────────────
const openManageModal = (bookingId) => {
  if (!bookingId) {
    console.error('[DEBUG] openManageModal: Booking ID is missing from dataset.');
    Toast.show('Button not found or invalid.', 'error');
    return;
  }

  console.log(`[DEBUG] openManageModal: Searching for booking ID ${bookingId} in authoritative state.`);
  const booking = BookingState.get(bookingId);
  
  if (!booking) {
    console.error(`[DEBUG] openManageModal: Booking not found for ID ${bookingId}. Looked in cache of ${BookingState.getAll().length} items.`);
    Toast.show('Booking not found in cache.', 'error');
    return;
  }
  
  console.log('[DEBUG] openManageModal: Booking lookup result successful. Initializing modal.');
  try {
    const modal = new BookingModal(booking);
    modal.open();
  } catch (err) {
    console.error('[DEBUG] openManageModal: Modal creation failure:', err);
    Toast.show('Failed to open booking details.', 'error');
  }
};

// ─────────────────────────────────────────────────────────────
// BOOTSTRAP
// ─────────────────────────────────────────────────────────────
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initBookings);
} else {
  initBookings();
}
