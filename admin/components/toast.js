/**
 * Reusable Toast Notification System
 * admin/components/toast.js
 */

export const Toast = {
  container: null,

  init() {
    if (this.container) return;
    this.container = document.createElement('div');
    this.container.className = 'admin-toast-container';
    document.body.appendChild(this.container);
  },

  show(message, type = 'info', duration = 3500) {
    this.init();

    const toast = document.createElement('div');
    toast.className = `admin-toast admin-toast--${type}`;

    let icon = 'fa-circle-info';
    if (type === 'success') icon = 'fa-circle-check';
    if (type === 'error') icon = 'fa-circle-exclamation';

    toast.innerHTML = `
      <i class="fa-solid ${icon}"></i>
      <span class="admin-toast__msg">${message}</span>
    `;

    this.container.appendChild(toast);

    // Trigger animation
    requestAnimationFrame(() => {
      toast.classList.add('show');
    });

    // Remove after duration
    setTimeout(() => {
      toast.classList.add('hide');
      setTimeout(() => {
        if (toast.parentNode === this.container) {
          this.container.removeChild(toast);
        }
      }, 300); // Wait for transition
    }, duration);
  }
};
