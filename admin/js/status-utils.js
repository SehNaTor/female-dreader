/**
 * Centralized Booking Status Utility
 * admin/js/status-utils.js
 *
 * Single source of truth for:
 * - Normalizing status values
 * - Comparing statuses
 * - Dashboard statistics logic
 * - Filtering logic
 * - Badge rendering
 */

/** All valid booking statuses. */
export const BOOKING_STATUSES = ['Pending', 'Confirmed', 'Completed', 'Cancelled', 'Rescheduled'];

/**
 * Normalizes a status string: trims whitespace and capitalizes the first letter
 * to ensure exact matches in comparisons.
 * @param {string} status 
 * @returns {string} Normalized status
 */
export const normalizeStatus = (status) => {
  if (!status || typeof status !== 'string') return 'Pending';
  const trimmed = status.trim();
  if (!trimmed) return 'Pending';
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1).toLowerCase();
};

/**
 * Compares two status strings case-insensitively and ignoring whitespace.
 * @param {string} s1 
 * @param {string} s2 
 * @returns {boolean}
 */
export const compareStatus = (s1, s2) => {
  return normalizeStatus(s1) === normalizeStatus(s2);
};

/**
 * Returns the CSS modifier class for a status badge.
 * @param {string} status
 * @returns {string}
 */
export const getStatusBadgeClass = (status) => {
  const normalized = normalizeStatus(status);
  const map = {
    Pending:     'admin-badge--warning',
    Confirmed:   'admin-badge--info',
    Completed:   'admin-badge--success',
    Cancelled:   'admin-badge--danger',
    Rescheduled: 'admin-badge--purple',
  };
  return map[normalized] ?? 'admin-badge--warning';
};
