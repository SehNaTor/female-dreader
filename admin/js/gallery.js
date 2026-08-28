import { requireAuth } from './auth.js';
import { injectLayout } from '../components/layout.js';
import { supabase } from './supabase.js';
import { renderTable } from '../components/table.js';
import { showLoader } from '../components/loader.js';
import { Toast } from '../components/toast.js';
import { Modal } from '../components/modal.js';
import { executeDelete } from './crud.js';
import { ImageUploader } from '../components/image-uploader.js';

const GALLERY_CATEGORIES = ['Locs', 'Braiding', 'Ghana Weaving', 'All Back', 'Nails', 'Transformation'];

let galleryData = [];

const initGallery = async () => {
  const user = await requireAuth();
  if (!user) return;

  injectLayout('Gallery Management', 'gallery');

  await fetchGallery();

  document.getElementById('btn-add-gallery').addEventListener('click', () => {
    openGalleryModal();
  });

  document.getElementById('search-gallery').addEventListener('input', applyFilters);

  // Setup Event Delegation for Delete Buttons
  document.getElementById('gallery-table-container').addEventListener('click', (e) => {
    const deleteBtn = e.target.closest('.js-delete-gallery');
    if (deleteBtn) {
      const id = deleteBtn.getAttribute('data-id');
      if (!confirm('Are you sure you want to delete this image?')) return;
      executeDelete('gallery', id, fetchGallery);
    }
  });
};

const applyFilters = () => {
  const term = document.getElementById('search-gallery').value.toLowerCase();
  const filtered = galleryData.filter(g =>
    g.title && g.title.toLowerCase().includes(term)
  );
  renderGalleryTable(filtered);
};

const fetchGallery = async () => {
  showLoader('gallery-table-container');
  try {
    const { data, error } = await supabase
      .from('gallery')
      .select('*')
      .order('display_order', { ascending: true })
      .order('created_at', { ascending: false });

    if (error) throw error;
    galleryData = data || [];
    applyFilters();
  } catch (err) {
    console.error('Error fetching gallery:', err);
    Toast.show('Failed to load gallery. Please try again.', 'error');
  }
};

const renderGalleryTable = (data) => {
  const columns = ['Preview', 'Title', 'Description', 'Featured', 'Status', 'Actions'];

  const rowRender = (item) => {
    const isFeatured = item.featured ? '<span class="admin-badge admin-badge--info">Yes</span>' : '<span class="text-muted">No</span>';
    const statusBadge = item.status !== 'Inactive'
      ? '<span class="admin-badge admin-badge--success">Active</span>'
      : '<span class="admin-badge admin-badge--warning">Inactive</span>';

    const imgHtml = item.image_url
      ? `<img src="${item.image_url}" class="admin-table-img" style="width: 80px; height: 60px;" alt="${item.title || 'Gallery image'}">`
      : `<div class="admin-table-img" style="width: 80px; height: 60px; display:flex;align-items:center;justify-content:center;color:#94a3b8;"><i class="fa-regular fa-image"></i></div>`;

    return `
      <td>${imgHtml}</td>
      <td>
        <div style="font-weight:600;color:var(--admin-text-main);">${item.title || 'Untitled'}</div>
      </td>
      <td>
        <div style="font-size:0.85rem; color:var(--admin-text-muted); max-width: 250px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${item.description || '--'}</div>
      </td>
      <td>${isFeatured}</td>
      <td>${statusBadge}</td>
      <td>
        <div class="admin-table-actions">
          <button class="admin-btn-icon" onclick="window.editGallery('${item.id}')" aria-label="Edit">
            <i class="fa-regular fa-pen-to-square"></i>
          </button>
          <button class="admin-btn-icon js-delete-gallery" data-id="${item.id}" aria-label="Delete" style="color:var(--admin-danger);">
            <i class="fa-regular fa-trash-can"></i>
          </button>
        </div>
      </td>
    `;
  };

  renderTable('gallery-table-container', columns, data, rowRender, 'No images found in gallery. Click "Add Image" to upload.');
};

// --- Modal Logic ---

const getGalleryFormHtml = (galleryItem = null) => {
  const g = galleryItem || {};

  return `
    <div style="display:grid; grid-template-columns: 1fr; gap: 1rem;">
      <div class="admin-form-group">
        <label class="admin-form-label">Category *</label>
        ${(function() {
          const saved = (g.category || '').trim();
          const isInList = GALLERY_CATEGORIES.includes(saved);
          const isLegacy = saved && !isInList;
          
          const options = GALLERY_CATEGORIES.map(cat => {
            const sel = cat === saved ? 'selected' : '';
            return `<option value="${cat}" ${sel}>${cat}</option>`;
          }).join('');
          
          const legacyOption = isLegacy 
            ? `<option value="${saved}" selected>${saved} — (Legacy: please update)</option>` 
            : '';
            
          return `<select name="category" class="admin-form-select admin-form-input" data-required="true" aria-label="Category">
            <option value="">— Select a Category —</option>
            ${legacyOption}${options}
          </select>
          <span class="admin-form-error" aria-live="polite">Please select a category.</span>`;
        })()}
      </div>

      <div class="admin-form-group">
        <label class="admin-form-label">Image *</label>
        <div id="gallery-image-uploader"></div>
      </div>

      <div class="admin-form-group">
        <label class="admin-form-label">Title</label>
        <input type="text" name="title" class="admin-form-input" value="${g.title || ''}" placeholder="e.g. Bridal Braids">
      </div>
      
      <div class="admin-form-group">
        <label class="admin-form-label">Description</label>
        <textarea name="description" class="admin-form-input" rows="3">${g.description || ''}</textarea>
      </div>

      <div class="admin-form-group">
        <label class="admin-form-label">Display Order</label>
        <input type="number" name="display_order" class="admin-form-input" value="${g.display_order || 0}">
      </div>
      
      <div class="admin-form-group">
        <label class="admin-checkbox-wrap">
          <input type="checkbox" name="featured" ${g.featured ? 'checked' : ''}>
          <span class="admin-checkbox-label">Feature on Homepage</span>
        </label>
      </div>

      <div class="admin-form-group">
        <label class="admin-checkbox-wrap">
          <input type="checkbox" name="status" ${g.status !== 'Inactive' ? 'checked' : ''}>
          <span class="admin-checkbox-label">Active (Visible)</span>
        </label>
      </div>
    </div>
  `;
};

const openGalleryModal = (galleryId = null) => {
  const item = galleryId ? galleryData.find(g => g.id === galleryId) : null;
  const title = item ? 'Edit Image' : 'Add New Image';

  let activeUploader = null;

  const modal = new Modal('gallery-modal', title, getGalleryFormHtml(item), async (form) => {
    const formData = new FormData(form);

    // Validate uploader state
    if (activeUploader) {
      const uploaderValidation = activeUploader.validate();
      if (!uploaderValidation.valid) {
        Toast.show(uploaderValidation.error, 'error');
        throw new Error('Validation failed');
      }
    }

    // Validate required fields
    const select = form.querySelector('select[name="category"]');
    const category = select ? select.value.trim() : '';
    const group = select ? select.closest('.admin-form-group') : null;

    if (!category) {
      if (group) group.classList.add('error');
      if (select) select.focus();
      Toast.show('Please select a category', 'error');
      throw new Error('Validation failed');
    } else {
      if (group) group.classList.remove('error');
    }

    // Get image URL from uploader or fallback
    const imageUrl = activeUploader ? activeUploader.getImageUrl() : (formData.get('image_url') || '').trim();

    if (!imageUrl) {
      Toast.show('An image is required for gallery items', 'error');
      throw new Error('Validation failed');
    }

    const payload = {
      category: category,
      image_url: imageUrl,
      title: formData.get('title').trim(),
      description: formData.get('description').trim(),
      display_order: parseInt(formData.get('display_order')) || 0,
      featured: formData.get('featured') === 'on',
      status: formData.get('status') === 'on' ? 'Active' : 'Inactive'
    };

    try {
      if (item) {
        const { error } = await supabase.from('gallery').update(payload).eq('id', item.id);
        if (error) throw error;
        Toast.show('Gallery image updated successfully', 'success');
      } else {
        const { error } = await supabase.from('gallery').insert([payload]);
        if (error) throw error;
        Toast.show('Image added to gallery', 'success');
      }

      await fetchGallery();
      document.getElementById('search-gallery').value = '';

    } catch (err) {
      console.error(err);
      Toast.show(err.message || 'An error occurred while saving.', 'error');
      throw err;
    }
  }, {
    onOpen: () => {
      activeUploader = new ImageUploader('gallery-image-uploader', {
        existingUrl: item?.image_url || '',
        required: true,
        onUploadStart: () => modal.disableSubmit('<i class="fa-solid fa-spinner fa-spin"></i> Uploading…'),
        onUploadComplete: (url) => {
          modal.enableSubmit();
          Toast.show('Image uploaded successfully', 'success');
        },
        onUploadError: (err) => {
          modal.enableSubmit();
          Toast.show(err.message || 'Image upload failed', 'error');
        },
      });
    },
    onBeforeClose: () => {
      if (activeUploader) {
        activeUploader.destroy();
        activeUploader = null;
      }
    }
  });

  modal.open();
};

window.editGallery = (id) => openGalleryModal(id);

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initGallery);
} else {
  initGallery();
}
