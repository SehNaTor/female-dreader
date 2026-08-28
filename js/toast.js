/* ======================================
   TOAST NOTIFICATIONS
   Lightweight, reusable feedback system.
   ====================================== */

class ToastSystem {
  constructor() {
    this.container = null;
    this.init();
  }

  init() {
    if (this.container) return;

    this.container = document.createElement('div');
    this.container.className = 'prd-toast-container';
    this.container.setAttribute('aria-live', 'polite');
    document.body.appendChild(this.container);
  }

  show(message, type = 'info', timeout = 2200) {
    const item = document.createElement('div');
    item.className = `prd-toast prd-toast--${type}`;
    item.innerHTML = `
      <span class="prd-toast__icon" aria-hidden="true"></span>
      <span class="prd-toast__message">${message}</span>
    `;

    this.container.appendChild(item);

    requestAnimationFrame(() => {
      item.classList.add('is-visible');
    });

    window.setTimeout(() => {
      item.classList.remove('is-visible');
      window.setTimeout(() => item.remove(), 220);
    }, timeout);
  }
}

export const toast = new ToastSystem();
