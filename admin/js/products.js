import { requireAuth } from './auth.js';
import { injectLayout } from '../components/layout.js';
import { supabase } from './supabase.js';
import { renderTable } from '../components/table.js';
import { showLoader } from '../components/loader.js';
import { Toast } from '../components/toast.js';
import { Modal } from '../components/modal.js';
import { executeDelete } from './crud.js';
import { ImageUploader } from '../components/image-uploader.js';

const PRODUCT_CATEGORIES = ['Hair Care', 'Dreadlock Products', 'Shampoos', 'Hair Growth', 'Extensions', 'Wigs', 'Beauty Accessories'];

let productsData = [];

const initProducts = async () => {
  const user = await requireAuth();
  if (!user) return;

  injectLayout('Products Management', 'products');

  await fetchProducts();

  document.getElementById('btn-add-product').addEventListener('click', () => {
    openProductModal();
  });

  document.getElementById('search-products').addEventListener('input', applyFilters);

  // Setup Event Delegation for Delete Buttons
  document.getElementById('products-table-container').addEventListener('click', (e) => {
    const deleteBtn = e.target.closest('.js-delete-product');
    if (deleteBtn) {
      const id = deleteBtn.getAttribute('data-id');
      if (!confirm('Are you sure you want to delete this product?')) return;
      executeDelete('products', id, fetchProducts);
    }
  });
};

const applyFilters = () => {
  const term = document.getElementById('search-products').value.toLowerCase();
  const filtered = productsData.filter(p =>
    p.name.toLowerCase().includes(term) ||
    (p.category && p.category.toLowerCase().includes(term))
  );
  renderProductsTable(filtered);
};

const fetchProducts = async () => {
  showLoader('products-table-container');
  try {
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .order('display_order', { ascending: true })
      .order('created_at', { ascending: false });

    if (error) throw error;
    productsData = data || [];
    applyFilters();
  } catch (err) {
    console.error('Error fetching products:', err);
    Toast.show('Failed to load products. Please try again.', 'error');
  }
};

const renderProductsTable = (data) => {
  const columns = ['Image', 'Name & Category', 'Price', 'Stock', 'Featured', 'Status', 'Actions'];

  const rowRender = (item) => {
    const isFeatured = item.featured ? '<span class="admin-badge admin-badge--info">Yes</span>' : '<span class="text-muted">No</span>';
    const statusBadge = item.status === 'active'
      ? '<span class="admin-badge admin-badge--success">Active</span>'
      : '<span class="admin-badge admin-badge--warning">Inactive</span>';

    const imgHtml = item.image_url
      ? `<img src="${item.image_url}" class="admin-table-img" style="border-radius: 50%;" alt="${item.name}">`
      : `<div class="admin-table-img" style="display:flex;align-items:center;justify-content:center;color:#94a3b8;border-radius:50%;"><i class="fa-solid fa-bottle-droplet"></i></div>`;

    return `
      <td>${imgHtml}</td>
      <td>
        <div style="font-weight:600;color:var(--admin-text-main);">${item.name}</div>
        <div style="font-size:0.8rem;color:var(--admin-text-muted);">${item.category || 'Uncategorized'}</div>
      </td>
      <td>
        <div style="font-weight:500;">${item.price || 'N/A'}</div>
      </td>
      <td>
        <div>${item.stock || '0'} in stock</div>
      </td>
      <td>${isFeatured}</td>
      <td>${statusBadge}</td>
      <td>
        <div class="admin-table-actions">
          <button class="admin-btn-icon" onclick="window.editProduct('${item.id}')" aria-label="Edit">
            <i class="fa-regular fa-pen-to-square"></i>
          </button>
          <button class="admin-btn-icon js-delete-product" data-id="${item.id}" aria-label="Delete" style="color:var(--admin-danger);">
            <i class="fa-regular fa-trash-can"></i>
          </button>
        </div>
      </td>
    `;
  };

  renderTable('products-table-container', columns, data, rowRender, 'No products found. Click "Add Product" to create one.');
};

// --- Modal Logic ---

const getProductFormHtml = (product = null) => {
  const isEdit = !!product;
  const p = product || {};

  return `
    <div style="display:grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
      <div class="admin-form-group" style="grid-column: 1 / -1;">
        <label class="admin-form-label">Product Name *</label>
        <input type="text" name="name" class="admin-form-input" required value="${p.name || ''}" placeholder="e.g. Dreader Growth Oil">
      </div>
      
      <div class="admin-form-group">
        <label class="admin-form-label">Category *</label>
        ${(function() {
          const saved = (p.category || '').trim();
          const isInList = PRODUCT_CATEGORIES.includes(saved);
          const isLegacy = saved && !isInList;
          
          const options = PRODUCT_CATEGORIES.map(cat => {
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
        <input type="text" name="price" class="admin-form-input" value="${p.price || ''}" placeholder="e.g. ₦10,000">
      </div>

      <div class="admin-form-group">
        <label class="admin-form-label">Stock Quantity</label>
        <input type="number" name="stock" class="admin-form-input" value="${p.stock || ''}" placeholder="e.g. 50">
      </div>
      
      <div class="admin-form-group">
        <label class="admin-form-label">Display Order</label>
        <input type="number" name="display_order" class="admin-form-input" value="${p.display_order || 0}">
      </div>

      <div class="admin-form-group" style="grid-column: 1 / -1;">
        <label class="admin-form-label">Image</label>
        <div id="product-image-uploader"></div>
      </div>

      <div class="admin-form-group" style="grid-column: 1 / -1;">
        <label class="admin-form-label">Description</label>
        <textarea name="description" class="admin-form-input" rows="3">${p.description || ''}</textarea>
      </div>
      
      <div class="admin-form-group">
        <label class="admin-checkbox-wrap">
          <input type="checkbox" name="featured" ${p.featured ? 'checked' : ''}>
          <span class="admin-checkbox-label">Feature Product</span>
        </label>
      </div>

      <div class="admin-form-group">
        <label class="admin-checkbox-wrap">
          <input type="checkbox" name="status" ${p.status !== 'Inactive' ? 'checked' : ''}>
          <span class="admin-checkbox-label">Active (Visible)</span>
        </label>
      </div>
    </div>
  `;
};

const openProductModal = (productId = null) => {
  const product = productId ? productsData.find(p => p.id === productId) : null;
  const title = product ? 'Edit Product' : 'Add New Product';

  let activeUploader = null;

  const modal = new Modal('product-modal', title, getProductFormHtml(product), async (form) => {
    // Validate uploader state
    if (activeUploader) {
      const uploaderValidation = activeUploader.validate();
      if (!uploaderValidation.valid) {
        Toast.show(uploaderValidation.error, 'error');
        throw new Error('Validation failed');
      }
    }

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
      Toast.show('Product name is required', 'error');
      throw new Error('Validation failed');
    }

    // Get image URL from uploader or fallback
    const imageUrl = activeUploader ? activeUploader.getImageUrl() : (formData.get('image_url') || '').trim();

    const payload = {
      name: formData.get('name').trim(),
      category: category,
      price: formData.get('price').trim(),
      stock: parseInt(formData.get('stock')) || 0,
      description: formData.get('description').trim(),
      image_url: imageUrl,
      display_order: parseInt(formData.get('display_order')) || 0,
      featured: formData.get('featured') === 'on',
      status: formData.get('status') === 'on' ? 'active' : 'Inactive'
    };

    try {
      if (product) {
        const { error } = await supabase.from('products').update(payload).eq('id', product.id);
        if (error) throw error;
        Toast.show('Product updated successfully', 'success');
      } else {
        const { error } = await supabase.from('products').insert([payload]);
        if (error) throw error;
        Toast.show('Product created successfully', 'success');
      }

      await fetchProducts();
      document.getElementById('search-products').value = '';

    } catch (err) {
      console.error(err);
      Toast.show(err.message || 'An error occurred while saving.', 'error');
      throw err;
    }
  }, {
    onOpen: () => {
      activeUploader = new ImageUploader('product-image-uploader', {
        existingUrl: product?.image_url || '',
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
      if (activeUploader) {
        activeUploader.destroy();
        activeUploader = null;
      }
    }
  });

  modal.open();
};

window.editProduct = (id) => openProductModal(id);

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initProducts);
} else {
  initProducts();
}
