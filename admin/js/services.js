import { requireAuth } from './auth.js';
import { injectLayout } from '../components/layout.js';
import { supabase } from './supabase.js';
import { renderTable } from '../components/table.js';
import { showLoader } from '../components/loader.js';
import { Toast } from '../components/toast.js';
import { Modal } from '../components/modal.js';
import { executeDelete } from './crud.js';
import { ImageUploader } from '../components/image-uploader.js';
import { SERVICE_CATEGORIES } from '../../js/constants.js';

let servicesData = [];

const initServices = async () => {
  const user = await requireAuth();
  if (!user) return;

  injectLayout('Services Management', 'services');

  // Load Data
  await fetchServices();

  // Setup Add Button
  document.getElementById('btn-add-service').addEventListener('click', () => {
    openServiceModal();
  });

  // Setup Search
  document.getElementById('search-services').addEventListener('input', applyFilters);

  // Setup Event Delegation for Delete Buttons
  document.getElementById('services-table-container').addEventListener('click', (e) => {
    const deleteBtn = e.target.closest('.js-delete-service');
    if (deleteBtn) {
      const id = deleteBtn.getAttribute('data-id');
      if (!confirm('Are you sure you want to delete this service? This action cannot be undone.')) return;
      executeDelete('services', id, fetchServices);
    }
  });
};

const applyFilters = () => {
  const term = document.getElementById('search-services').value.toLowerCase();
  const filtered = servicesData.filter(s => 
    s.name.toLowerCase().includes(term) || 
    (s.category && s.category.toLowerCase().includes(term))
  );
  renderServicesTable(filtered);
};

const fetchServices = async () => {
  showLoader('services-table-container');
  try {
    const { data, error } = await supabase
      .from('services')
      .select('*')
      .order('display_order', { ascending: true })
      .order('created_at', { ascending: false });

    if (error) throw error;
    servicesData = data || [];
    applyFilters();
  } catch (err) {
    console.error('Error fetching services:', err);
    Toast.show('Failed to load services. Please try again.', 'error');
  }
};

const renderServicesTable = (data) => {
  const columns = ['Image', 'Name & Category', 'Price & Duration', 'Featured', 'Status', 'Actions'];
  
  const rowRender = (item) => {
    const isFeatured = item.featured ? '<span class="admin-badge admin-badge--info">Yes</span>' : '<span class="text-muted">No</span>';
    const statusBadge = item.is_active !== false 
      ? '<span class="admin-badge admin-badge--success">Active</span>' 
      : '<span class="admin-badge admin-badge--warning">Draft</span>';
      
    const imgHtml = item.image_url 
      ? `<img src="${item.image_url}" class="admin-table-img" alt="${item.name}">`
      : `<div class="admin-table-img" style="display:flex;align-items:center;justify-content:center;color:#94a3b8;"><i class="fa-solid fa-image"></i></div>`;

    return `
      <td>${imgHtml}</td>
      <td>
        <div style="font-weight:600;color:var(--admin-text-main);">${item.name}</div>
        <div style="font-size:0.8rem;color:var(--admin-text-muted);">${item.category || 'Uncategorized'}</div>
      </td>
      <td>
        <div>${item.price || 'N/A'}</div>
        <div style="font-size:0.8rem;color:var(--admin-text-muted);"><i class="fa-regular fa-clock"></i> ${item.duration || '--'}</div>
      </td>
      <td>${isFeatured}</td>
      <td>${statusBadge}</td>
      <td>
        <div class="admin-table-actions">
          <button class="admin-btn-icon" onclick="window.editService('${item.id}')" aria-label="Edit">
            <i class="fa-regular fa-pen-to-square"></i>
          </button>
          <button class="admin-btn-icon js-delete-service" data-id="${item.id}" aria-label="Delete" style="color:var(--admin-danger);">
            <i class="fa-regular fa-trash-can"></i>
          </button>
        </div>
      </td>
    `;
  };

  renderTable('services-table-container', columns, data, rowRender, 'No services found. Click "Add Service" to create one.');
};

// --- Modal Logic ---

const getServiceFormHtml = (service = null) => {
  const isEdit = !!service;
  const s = service || {};
  
  return `
    <div style="display:grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
      <div class="admin-form-group" style="grid-column: 1 / -1;">
        <label class="admin-form-label">Service Name *</label>
        <input type="text" name="name" class="admin-form-input" required value="${s.name || ''}" placeholder="e.g. Knotless Braids">
      </div>
      
      <div class="admin-form-group">
        <label class="admin-form-label">Category *</label>
        ${(function() {
          const saved = (s.category || '').trim();
          const isInList = SERVICE_CATEGORIES.includes(saved);
          const isLegacy = saved && !isInList;
          
          const options = SERVICE_CATEGORIES.map(cat => {
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
        <label class="admin-form-label">Price</label>
        <input type="text" name="price" class="admin-form-input" value="${s.price || ''}" placeholder="e.g. ₦25,000">
      </div>

      <div class="admin-form-group">
        <label class="admin-form-label">Duration</label>
        <input type="text" name="duration" class="admin-form-input" value="${s.duration || ''}" placeholder="e.g. 3 Hours">
      </div>
      
      <div class="admin-form-group">
        <label class="admin-form-label">Display Order</label>
        <input type="number" name="display_order" class="admin-form-input" value="${s.display_order || 0}">
      </div>

      <div class="admin-form-group" style="grid-column: 1 / -1;">
        <label class="admin-form-label">Image</label>
        <div id="service-image-uploader"></div>
      </div>

      <div class="admin-form-group" style="grid-column: 1 / -1;">
        <label class="admin-form-label">Description</label>
        <textarea name="description" class="admin-form-input" rows="3">${s.description || ''}</textarea>
      </div>
      
      <div class="admin-form-group">
        <label class="admin-checkbox-wrap">
          <input type="checkbox" name="featured" ${s.featured ? 'checked' : ''}>
          <span class="admin-checkbox-label">Feature on Homepage</span>
        </label>
      </div>

      <div class="admin-form-group">
        <label class="admin-checkbox-wrap">
          <input type="checkbox" name="is_active" ${s.is_active !== false ? 'checked' : ''}>
          <span class="admin-checkbox-label">Active (Visible)</span>
        </label>
      </div>
    </div>
  `;
};

const openServiceModal = (serviceId = null) => {
  const service = serviceId ? servicesData.find(s => s.id === serviceId) : null;
  const title = service ? 'Edit Service' : 'Add New Service';
  
  let activeUploader = null;

  const modal = new Modal('service-modal', title, getServiceFormHtml(service), async (form) => {
    // Validate uploader state
    if (activeUploader) {
      const uploaderValidation = activeUploader.validate();
      if (!uploaderValidation.valid) {
        Toast.show(uploaderValidation.error, 'error');
        throw new Error('Validation failed');
      }
    }

    // Collect data
    const formData = new FormData(form);

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

    if (!formData.get('name').trim()) {
      Toast.show('Service name is required', 'error');
      throw new Error('Validation failed');
    }

    // Get image URL from uploader (hidden input) or fallback
    const imageUrl = activeUploader ? activeUploader.getImageUrl() : (formData.get('image_url') || '').trim();

    const payload = {
      name: formData.get('name').trim(),
      category: category,
      price: formData.get('price').trim(),
      duration: formData.get('duration').trim(),
      description: formData.get('description').trim(),
      image_url: imageUrl,
      display_order: parseInt(formData.get('display_order')) || 0,
      featured: formData.get('featured') === 'on',
      is_active: formData.get('is_active') === 'on'
    };

    try {
      if (service) {
        // Update
        const { error } = await supabase.from('services').update(payload).eq('id', service.id);
        if (error) throw error;
        Toast.show('Service updated successfully', 'success');
      } else {
        // Insert
        const { error } = await supabase.from('services').insert([payload]);
        if (error) throw error;
        Toast.show('Service created successfully', 'success');
      }
      
      // Refresh
      await fetchServices();
      document.getElementById('search-services').value = '';

    } catch (err) {
      console.error(err);
      Toast.show(err.message || 'An error occurred while saving.', 'error');
      throw err;
    }
  }, {
    onOpen: () => {
      // Initialize ImageUploader after modal DOM is ready
      activeUploader = new ImageUploader('service-image-uploader', {
        existingUrl: service?.image_url || '',
        required: false,
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
      // Cleanup uploader resources
      if (activeUploader) {
        activeUploader.destroy();
        activeUploader = null;
      }
    }
  });

  modal.open();
};

// Make handlers globally available for inline onclicks in table
window.editService = (id) => openServiceModal(id);

// Initialize
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initServices);
} else {
  initServices();
}
