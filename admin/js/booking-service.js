/**
 * Booking Service
 * admin/js/booking-service.js
 *
 * All Supabase interactions for the bookings domain.
 * Keep business logic here; UI rendering belongs in booking-modal.js / bookings.js.
 */

import { supabase } from './supabase.js';
import { BOOKING_STATUSES, getStatusBadgeClass, normalizeStatus, compareStatus } from './status-utils.js';

// Re-export for backward compatibility
export { BOOKING_STATUSES, getStatusBadgeClass, normalizeStatus, compareStatus };

// ─────────────────────────────────────────────────────────────
// READ
// ─────────────────────────────────────────────────────────────

/**
 * Fetches a single booking by ID.
 * @param {string} id
 * @returns {Promise<Object|null>}
 */
export const getBookingById = async (id) => {
  const { data, error } = await supabase
    .from('bookings')
    .select('*')
    .eq('id', id)
    .single();
  if (error) throw error;
  return data;
};

// ─────────────────────────────────────────────────────────────
// WRITE
// ─────────────────────────────────────────────────────────────

/**
 * Updates the status field of a booking.
 * @param {string} id       - Booking UUID
 * @param {string} status   - One of BOOKING_STATUSES
 * @returns {Promise<Object>} - The updated booking row
 */
export const updateBookingStatus = async (id, status) => {
  const { data, error } = await supabase
    .from('bookings')
    .update({ status })
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
};

/**
 * Reschedules a booking — updates date, time, and sets status to Rescheduled.
 * @param {string} id               - Booking UUID
 * @param {string} appointmentDate  - ISO date string  (YYYY-MM-DD)
 * @param {string} appointmentTime  - Time string (HH:MM)
 * @returns {Promise<Object>} - The updated booking row
 */
export const rescheduleBooking = async (id, appointmentDate, appointmentTime) => {
  const { data, error } = await supabase
    .from('bookings')
    .update({
      appointment_date: appointmentDate,
      appointment_time: appointmentTime,
      status: 'Rescheduled',
    })
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
};
