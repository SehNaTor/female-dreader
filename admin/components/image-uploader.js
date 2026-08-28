/**
 * Reusable Image Uploader Component
 * admin/components/image-uploader.js
 *
 * Drag-and-drop + click-to-upload component with Cloudinary integration.
 * Shared across Services, Products, and Gallery admin modals.
 *
 * Usage:
 *   const uploader = new ImageUploader('container-id', {
 *     existingUrl: item?.image_url || '',
 *     required: false,
 *     onUploadStart: () => modal.disableSubmit(),
 *     onUploadComplete: (url) => modal.enableSubmit(),
 *     onUploadError: (err) => modal.enableSubmit(),
 *   });
 *
 *   // Get the final URL for saving:
 *   const imageUrl = uploader.getImageUrl();
 *
 *   // Cleanup when modal closes:
 *   uploader.destroy();
 */

import { validateImageFile, compressImage, uploadToCloudinary } from '../js/cloudinary.js';

// Unique ID counter to prevent collisions
let instanceCounter = 0;

export class ImageUploader {
  /**
   * @param {string} containerId — DOM id of the container element
   * @param {Object} options
   * @param {string} [options.existingUrl=''] — current image_url for edit mode
   * @param {boolean} [options.required=false] — whether an image is mandatory
   * @param {Function} [options.onUploadStart] — called when upload begins
   * @param {Function} [options.onUploadComplete] — called with secure_url on success
   * @param {Function} [options.onUploadError] — called with error on failure
   */
  constructor(containerId, options = {}) {
    this.containerId = containerId;
    this.options = {
      existingUrl: '',
      required: false,
      onUploadStart: () => {},
      onUploadComplete: () => {},
      onUploadError: () => {},
      ...options,
    };

    this.instanceId = `img-uploader-${++instanceCounter}`;
    this.container = null;
    this.fileInput = null;
    this.dropzone = null;
    this.hiddenInput = null;

    // State
    this._currentUrl = this.options.existingUrl || '';
    this._uploadedUrl = '';
    this._previewObjectUrl = null;
    this._isUploading = false;
    this._lastFile = null; // Track last uploaded file to prevent duplicates
    this._destroyed = false;

    // Bound handlers for proper cleanup
    this._handleClick = this._handleClick.bind(this);
    this._handleFileChange = this._handleFileChange.bind(this);
    this._handleDragOver = this._handleDragOver.bind(this);
    this._handleDragLeave = this._handleDragLeave.bind(this);
    this._handleDrop = this._handleDrop.bind(this);
    this._handleReplace = this._handleReplace.bind(this);
    this._handleRemove = this._handleRemove.bind(this);
    this._handleRetry = this._handleRetry.bind(this);

    this._render();
    this._attachListeners();
  }

  // ── Public API ─────────────────────────────────────────────

  /**
   * Returns the final image URL to save.
   * Priority: newly uploaded URL > existing URL
   */
  getImageUrl() {
    if (this._uploadedUrl) return this._uploadedUrl;
    return this._currentUrl;
  }

  /**
   * Returns true if an upload is currently in progress.
   */
  isUploading() {
    return this._isUploading;
  }

  /**
   * Validates the uploader state. Returns { valid, error }.
   */
  validate() {
    if (this.options.required && !this.getImageUrl()) {
      return { valid: false, error: 'An image is required.' };
    }
    if (this._isUploading) {
      return { valid: false, error: 'Please wait for the image upload to complete.' };
    }
    return { valid: true };
  }

  /**
   * Cleans up all resources — object URLs, event listeners.
   */
  destroy() {
    if (this._destroyed) return;
    this._destroyed = true;

    // Revoke any object URLs
    this._revokePreviewUrl();

    // Remove listeners
    if (this.dropzone) {
      this.dropzone.removeEventListener('click', this._handleClick);
      this.dropzone.removeEventListener('dragover', this._handleDragOver);
      this.dropzone.removeEventListener('dragleave', this._handleDragLeave);
      this.dropzone.removeEventListener('drop', this._handleDrop);
    }

    if (this.fileInput) {
      this.fileInput.removeEventListener('change', this._handleFileChange);
    }
  }

  // ── Render ─────────────────────────────────────────────────

  _render() {
    this.container = document.getElementById(this.containerId);
    if (!this.container) {
      console.error(`ImageUploader: Container #${this.containerId} not found.`);
      return;
    }

    this.container.classList.add('img-uploader');

    // Decide initial view
    if (this._currentUrl) {
      this._renderPreviewState(this._currentUrl, true);
    } else {
      this._renderEmptyState();
    }
  }

  _renderEmptyState() {
    this.container.innerHTML = `
      <div class="img-uploader__dropzone" id="${this.instanceId}-dropzone">
        <input type="file" accept="image/*" class="img-uploader__input" id="${this.instanceId}-file-input">
        <div class="img-uploader__empty">
          <div class="img-uploader__icon">
            <i class="fa-solid fa-cloud-arrow-up"></i>
          </div>
          <div class="img-uploader__text">
            <span class="img-uploader__browse-link">Click to upload</span> or drag and drop
          </div>
          <div class="img-uploader__hint">PNG, JPG, WebP, GIF or SVG — Max 10 MB</div>
        </div>
      </div>
      <input type="hidden" name="image_url" value="${this._escapeAttr(this.getImageUrl())}">
      <div class="img-uploader__validation" id="${this.instanceId}-validation">
        <i class="fa-solid fa-circle-exclamation"></i>
        <span id="${this.instanceId}-validation-msg"></span>
      </div>
    `;

    this._cacheElements();
    this._attachListeners();
  }

  _renderPreviewState(url, isExisting = false) {
    const badge = isExisting
      ? `<div class="img-uploader__existing-badge"><i class="fa-solid fa-link"></i> Current Image</div>`
      : `<div class="img-uploader__success-badge"><i class="fa-solid fa-circle-check"></i> Uploaded</div>`;

    this.container.innerHTML = `
      <div class="img-uploader__dropzone img-uploader__dropzone--has-preview ${!isExisting ? 'img-uploader__dropzone--success' : ''}" id="${this.instanceId}-dropzone">
        <input type="file" accept="image/*" class="img-uploader__input" id="${this.instanceId}-file-input">
        <div class="img-uploader__preview-wrap">
          <img src="${this._escapeAttr(url)}" alt="Image preview" class="img-uploader__preview-img" loading="lazy">
          ${badge}
          <div class="img-uploader__preview-overlay">
            <button type="button" class="img-uploader__action-btn img-uploader__action-btn--replace" id="${this.instanceId}-replace-btn">
              <i class="fa-solid fa-arrow-up-from-bracket"></i> Replace
            </button>
            ${!isExisting ? `
              <button type="button" class="img-uploader__action-btn img-uploader__action-btn--remove" id="${this.instanceId}-remove-btn">
                <i class="fa-solid fa-xmark"></i> Remove
              </button>
            ` : ''}
          </div>
        </div>
      </div>
      <input type="hidden" name="image_url" value="${this._escapeAttr(this.getImageUrl())}">
      <div class="img-uploader__validation" id="${this.instanceId}-validation">
        <i class="fa-solid fa-circle-exclamation"></i>
        <span id="${this.instanceId}-validation-msg"></span>
      </div>
    `;

    this._cacheElements();
    this._attachListeners();

    // Attach action button listeners
    const replaceBtn = document.getElementById(`${this.instanceId}-replace-btn`);
    const removeBtn = document.getElementById(`${this.instanceId}-remove-btn`);

    if (replaceBtn) replaceBtn.addEventListener('click', this._handleReplace);
    if (removeBtn) removeBtn.addEventListener('click', this._handleRemove);
  }

  _renderUploadingState(file) {
    // Create object URL for local preview
    this._revokePreviewUrl();
    this._previewObjectUrl = URL.createObjectURL(file);

    this.container.innerHTML = `
      <div class="img-uploader__dropzone img-uploader__dropzone--has-preview img-uploader__dropzone--uploading" id="${this.instanceId}-dropzone">
        <input type="file" accept="image/*" class="img-uploader__input" id="${this.instanceId}-file-input">
        <div class="img-uploader__preview-wrap">
          <img src="${this._previewObjectUrl}" alt="Uploading preview" class="img-uploader__preview-img">
          <div class="img-uploader__progress-wrap">
            <div class="img-uploader__spinner"></div>
            <div class="img-uploader__progress-bar-track">
              <div class="img-uploader__progress-bar-fill" id="${this.instanceId}-progress-fill"></div>
            </div>
            <div class="img-uploader__progress-text" id="${this.instanceId}-progress-text">Uploading… 0%</div>
          </div>
        </div>
      </div>
      <input type="hidden" name="image_url" value="${this._escapeAttr(this._currentUrl)}">
      <div class="img-uploader__validation" id="${this.instanceId}-validation">
        <i class="fa-solid fa-circle-exclamation"></i>
        <span id="${this.instanceId}-validation-msg"></span>
      </div>
    `;

    this._cacheElements();
    // Don't attach click/drop listeners during upload (dropzone has pointer-events: none)
  }

  _renderErrorState(errorMsg) {
    this.container.innerHTML = `
      <div class="img-uploader__dropzone img-uploader__dropzone--error" id="${this.instanceId}-dropzone">
        <input type="file" accept="image/*" class="img-uploader__input" id="${this.instanceId}-file-input">
        <div class="img-uploader__error-wrap">
          <div class="img-uploader__error-icon">
            <i class="fa-solid fa-triangle-exclamation"></i>
          </div>
          <div class="img-uploader__error-msg">${this._escapeHtml(errorMsg)}</div>
          <button type="button" class="img-uploader__retry-btn" id="${this.instanceId}-retry-btn">
            <i class="fa-solid fa-rotate-right"></i> Try Again
          </button>
        </div>
      </div>
      <input type="hidden" name="image_url" value="${this._escapeAttr(this._currentUrl)}">
      <div class="img-uploader__validation" id="${this.instanceId}-validation">
        <i class="fa-solid fa-circle-exclamation"></i>
        <span id="${this.instanceId}-validation-msg"></span>
      </div>
    `;

    this._cacheElements();
    this._attachListeners();

    const retryBtn = document.getElementById(`${this.instanceId}-retry-btn`);
    if (retryBtn) retryBtn.addEventListener('click', this._handleRetry);
  }

  // ── Element Caching ────────────────────────────────────────

  _cacheElements() {
    this.dropzone = document.getElementById(`${this.instanceId}-dropzone`);
    this.fileInput = document.getElementById(`${this.instanceId}-file-input`);
    this.hiddenInput = this.container.querySelector('input[name="image_url"]');
  }

  // ── Event Listeners ────────────────────────────────────────

  _attachListeners() {
    if (!this.dropzone || !this.fileInput) return;

    // Remove old listeners first to prevent duplication
    this.dropzone.removeEventListener('click', this._handleClick);
    this.dropzone.removeEventListener('dragover', this._handleDragOver);
    this.dropzone.removeEventListener('dragleave', this._handleDragLeave);
    this.dropzone.removeEventListener('drop', this._handleDrop);
    this.fileInput.removeEventListener('change', this._handleFileChange);

    // Re-attach
    this.dropzone.addEventListener('click', this._handleClick);
    this.dropzone.addEventListener('dragover', this._handleDragOver);
    this.dropzone.addEventListener('dragleave', this._handleDragLeave);
    this.dropzone.addEventListener('drop', this._handleDrop);
    this.fileInput.addEventListener('change', this._handleFileChange);
  }

  // ── Handlers ───────────────────────────────────────────────

  _handleClick(e) {
    // Don't trigger file picker if clicking action buttons
    if (e.target.closest('.img-uploader__action-btn') || e.target.closest('.img-uploader__retry-btn')) {
      return;
    }
    if (this.fileInput) this.fileInput.click();
  }

  _handleFileChange(e) {
    const file = e.target.files?.[0];
    if (file) this._processFile(file);
    // Reset input so re-selecting the same file triggers change
    if (this.fileInput) this.fileInput.value = '';
  }

  _handleDragOver(e) {
    e.preventDefault();
    e.stopPropagation();
    if (this.dropzone) {
      this.dropzone.classList.add('img-uploader__dropzone--drag-over');
    }
  }

  _handleDragLeave(e) {
    e.preventDefault();
    e.stopPropagation();
    if (this.dropzone) {
      this.dropzone.classList.remove('img-uploader__dropzone--drag-over');
    }
  }

  _handleDrop(e) {
    e.preventDefault();
    e.stopPropagation();
    if (this.dropzone) {
      this.dropzone.classList.remove('img-uploader__dropzone--drag-over');
    }

    const file = e.dataTransfer?.files?.[0];
    if (file) this._processFile(file);
  }

  _handleReplace(e) {
    e.preventDefault();
    e.stopPropagation();
    if (this.fileInput) this.fileInput.click();
  }

  _handleRemove(e) {
    e.preventDefault();
    e.stopPropagation();
    // Remove the newly uploaded image, revert to existing or empty
    this._uploadedUrl = '';
    this._revokePreviewUrl();
    this._lastFile = null;

    if (this._currentUrl) {
      // Revert to existing image
      this._renderPreviewState(this._currentUrl, true);
    } else {
      // Go back to empty
      this._renderEmptyState();
    }

    this._updateHiddenInput();
  }

  _handleRetry(e) {
    e.preventDefault();
    e.stopPropagation();
    // Reset to empty state so user can pick a new file
    this._lastFile = null;
    if (this._currentUrl) {
      this._renderPreviewState(this._currentUrl, true);
    } else {
      this._renderEmptyState();
    }
  }

  // ── File Processing ────────────────────────────────────────

  async _processFile(file) {
    if (this._isUploading || this._destroyed) return;

    // Clear previous validation
    this._hideValidation();

    // 1. Validate
    const validation = validateImageFile(file);
    if (!validation.valid) {
      this._showValidation(validation.error);
      return;
    }

    // 2. Check for duplicate upload (same file name + size)
    if (this._lastFile && this._lastFile.name === file.name && this._lastFile.size === file.size) {
      this._showValidation('This image has already been uploaded.');
      return;
    }

    // 3. Begin upload
    this._isUploading = true;
    this._lastFile = file;
    this.options.onUploadStart();

    // 4. Render uploading state with local preview
    this._renderUploadingState(file);

    try {
      // 5. Compress if needed
      const processedFile = await compressImage(file);

      // 6. Upload to Cloudinary
      const result = await uploadToCloudinary(processedFile, (percent) => {
        this._updateProgress(percent);
      });

      if (this._destroyed) return;

      // 7. Success
      this._uploadedUrl = result.secure_url;
      this._isUploading = false;

      // Clean up the local preview object URL
      this._revokePreviewUrl();

      // Render the Cloudinary image preview
      this._renderPreviewState(result.secure_url, false);
      this._updateHiddenInput();
      this.options.onUploadComplete(result.secure_url);

    } catch (error) {
      if (this._destroyed) return;

      this._isUploading = false;
      this._revokePreviewUrl();
      this._renderErrorState(error.message || 'Upload failed. Please try again.');
      this._updateHiddenInput();
      this.options.onUploadError(error);
    }
  }

  // ── Progress Update ────────────────────────────────────────

  _updateProgress(percent) {
    if (this._destroyed) return;

    const fill = document.getElementById(`${this.instanceId}-progress-fill`);
    const text = document.getElementById(`${this.instanceId}-progress-text`);

    if (fill) fill.style.width = `${percent}%`;
    if (text) text.textContent = `Uploading… ${percent}%`;
  }

  // ── Hidden Input ───────────────────────────────────────────

  _updateHiddenInput() {
    if (this.hiddenInput) {
      this.hiddenInput.value = this.getImageUrl();
    }
  }

  // ── Validation Display ─────────────────────────────────────

  _showValidation(msg) {
    const el = document.getElementById(`${this.instanceId}-validation`);
    const msgEl = document.getElementById(`${this.instanceId}-validation-msg`);
    if (el && msgEl) {
      msgEl.textContent = msg;
      el.classList.add('img-uploader__validation--visible');
    }
  }

  _hideValidation() {
    const el = document.getElementById(`${this.instanceId}-validation`);
    if (el) el.classList.remove('img-uploader__validation--visible');
  }

  // ── Utilities ──────────────────────────────────────────────

  _revokePreviewUrl() {
    if (this._previewObjectUrl) {
      URL.revokeObjectURL(this._previewObjectUrl);
      this._previewObjectUrl = null;
    }
  }

  _escapeAttr(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  _escapeHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
}
