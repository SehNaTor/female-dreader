/**
 * Reusable Modal Component
 * admin/components/modal.js
 * Automatically cleans up event listeners to prevent memory leaks.
 */

export class Modal {
  /**
   * @param {string} id
   * @param {string} title
   * @param {string} formHtml
   * @param {Function} onSubmitCallback
   * @param {Object} [options]
   * @param {Function} [options.onOpen] — called after modal DOM is visible
   * @param {Function} [options.onBeforeClose] — called before modal is destroyed (cleanup)
   */
  constructor(id, title, formHtml, onSubmitCallback, options = {}) {
    this.id = id;
    this.title = title;
    this.formHtml = formHtml;
    this.onSubmitCallback = onSubmitCallback;
    this.onOpenCallback = options.onOpen || null;
    this.onBeforeCloseCallback = options.onBeforeClose || null;
    this.overlay = null;
    this.form = null;
    
    // Bind methods for proper removal
    this.handleClose = this.handleClose.bind(this);
    this.handleSubmit = this.handleSubmit.bind(this);
    this.handleKeyDown = this.handleKeyDown.bind(this);
    
    this._render();
  }

  _render() {
    // Check if it already exists and remove it to avoid duplicates
    const existing = document.getElementById(this.id);
    if (existing) {
      existing.remove();
    }

    this.overlay = document.createElement('div');
    this.overlay.className = 'admin-modal-overlay';
    this.overlay.id = this.id;
    this.overlay.setAttribute('aria-hidden', 'true');

    this.overlay.innerHTML = `
      <div class="admin-modal" role="dialog" aria-modal="true" aria-labelledby="${this.id}-title">
        <div class="admin-modal__header">
          <h3 class="admin-modal__title" id="${this.id}-title">${this.title}</h3>
          <button type="button" class="admin-modal__close" aria-label="Close modal">
            <i class="fa-solid fa-xmark"></i>
          </button>
        </div>
        <form id="${this.id}-form" novalidate>
          <div class="admin-modal__body">
            ${this.formHtml}
          </div>
          <div class="admin-modal__footer">
            <button type="button" class="admin-btn admin-btn--outline admin-modal__cancel">Cancel</button>
            <button type="submit" class="admin-btn admin-btn--gold" id="${this.id}-submit">
              <span>Save Changes</span>
            </button>
          </div>
        </form>
      </div>
    `;

    document.body.appendChild(this.overlay);

    // Attach base listeners
    this.form = document.getElementById(`${this.id}-form`);
    
    const closeBtn = this.overlay.querySelector('.admin-modal__close');
    const cancelBtn = this.overlay.querySelector('.admin-modal__cancel');

    closeBtn.addEventListener('click', this.handleClose);
    cancelBtn.addEventListener('click', this.handleClose);
    this.overlay.addEventListener('click', (e) => {
      if (e.target === this.overlay) this.handleClose();
    });

    this.form.addEventListener('submit', this.handleSubmit);
    document.addEventListener('keydown', this.handleKeyDown);
  }

  handleKeyDown(e) {
    if (e.key === 'Escape') {
      this.handleClose();
    }
  }

  open() {
    // Pause Lenis while modal is open (prevents background scroll)
    if (window.FDScroll) window.FDScroll.pause();
    // Lock body scroll
    document.body.style.overflow = 'hidden';
    
    // Small delay to allow CSS transitions to work after appending to DOM
    requestAnimationFrame(() => {
      this.overlay.classList.add('active');
      this.overlay.setAttribute('aria-hidden', 'false');
      // Fire onOpen callback after DOM is visible
      if (this.onOpenCallback) {
        try { this.onOpenCallback(this); } catch(e) { console.error('Modal onOpen error:', e); }
      }
    });
  }

  close() {
    // Fire cleanup callback before closing
    if (this.onBeforeCloseCallback) {
      try { this.onBeforeCloseCallback(this); } catch(e) { console.error('Modal onBeforeClose error:', e); }
    }
    this.overlay.classList.remove('active');
    this.overlay.setAttribute('aria-hidden', 'true');
    // Restore body scroll & resume Lenis
    document.body.style.overflow = '';
    if (window.FDScroll) window.FDScroll.resume();
    
    // Remove from DOM after transition
    setTimeout(() => {
      this._destroy();
    }, 300);
  }

  handleClose(e) {
    if (e) e.preventDefault();
    this.close();
  }

  async handleSubmit(e) {
    e.preventDefault();
    if (this.onSubmitCallback) {
      const submitBtn = document.getElementById(`${this.id}-submit`);
      const originalText = submitBtn.innerHTML;
      
      // Loading State
      submitBtn.disabled = true;
      submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Saving...';
      
      try {
        await this.onSubmitCallback(this.form);
        this.close(); // Only close on success
      } catch (err) {
        console.error('Modal Submit Error:', err);
        // Error handling should be done via Toasts in the callback
      } finally {
        // Reset button state if modal wasn't destroyed
        if (document.body.contains(this.overlay)) {
          submitBtn.disabled = false;
          submitBtn.innerHTML = originalText;
        }
      }
    }
  }

  // ── Submit Button Control ──────────────────────────────────

  /**
   * Returns the submit button element.
   */
  getSubmitButton() {
    return document.getElementById(`${this.id}-submit`);
  }

  /**
   * Disables the Save button (e.g. during image upload).
   * @param {string} [text] — optional label override
   */
  disableSubmit(text) {
    const btn = this.getSubmitButton();
    if (btn) {
      btn.disabled = true;
      if (text) btn.innerHTML = text;
    }
  }

  /**
   * Re-enables the Save button.
   * @param {string} [text='Save Changes'] — optional label override
   */
  enableSubmit(text = '<span>Save Changes</span>') {
    const btn = this.getSubmitButton();
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = text;
    }
  }

  _destroy() {
    // Clean up to prevent memory leaks
    if (this.overlay && this.overlay.parentNode) {
      this.form.removeEventListener('submit', this.handleSubmit);
      document.removeEventListener('keydown', this.handleKeyDown);
      this.overlay.remove();
    }
  }
}
