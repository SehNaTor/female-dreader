/**
 * Reusable Loader Component
 * admin/components/loader.js
 */

export const showLoader = (containerId) => {
  const container = document.getElementById(containerId);
  if (container) {
    container.innerHTML = '<div class="admin-loader"></div>';
  }
};
