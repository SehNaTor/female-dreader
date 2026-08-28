/**
 * Orders Page Controller
 * admin/js/orders.js
 */

import { requireAuth } from './auth.js';
import { injectLayout } from '../components/layout.js';
import { supabase } from './supabase.js';
import { renderTable } from '../components/table.js';
import { showLoader } from '../components/loader.js';
import { Toast } from '../components/toast.js';
import { getStatusBadgeClass } from './status-utils.js'; // I'll assume we can use this for Order Status, maybe it maps Pending/Processing/Delivered.

// ─────────────────────────────────────────────────────────────
// STATE MANAGEMENT
// ─────────────────────────────────────────────────────────────

const OrderState = {
  data: [],
  set(orders) {
    this.data = orders || [];
  },
  get(id) {
    return this.data.find((o) => String(o.id) === String(id));
  },
  update(updatedOrder) {
    const idx = this.data.findIndex((o) => String(o.id) === String(updatedOrder.id));
    if (idx !== -1) {
      this.data[idx] = { ...this.data[idx], ...updatedOrder };
    }
  },
  getAll() {
    return this.data;
  }
};

// ─────────────────────────────────────────────────────────────
// INIT
// ─────────────────────────────────────────────────────────────
const initOrders = async () => {
  const user = await requireAuth();
  if (!user) return;

  injectLayout('Orders Management', 'orders');

  setupEventDelegation();
  
  const searchInput = document.getElementById('search-orders');
  const paymentSelect = document.getElementById('filter-payment');
  const statusSelect = document.getElementById('filter-status');
  
  if (searchInput) searchInput.addEventListener('input', applyFilters);
  if (paymentSelect) paymentSelect.addEventListener('change', applyFilters);
  if (statusSelect) statusSelect.addEventListener('change', applyFilters);

  // Setup Modal Listeners
  document.getElementById('btn-close-modal')?.addEventListener('click', closeManageModal);
  document.querySelector('#order-modal .admin-modal__close')?.addEventListener('click', closeManageModal);
  document.querySelector('#order-modal .admin-modal__backdrop')?.addEventListener('click', closeManageModal);
  document.getElementById('btn-save-order')?.addEventListener('click', saveOrderChanges);

  await fetchOrders();
};

// ─────────────────────────────────────────────────────────────
// ROBUST EVENT DELEGATION
// ─────────────────────────────────────────────────────────────
const setupEventDelegation = () => {
  document.body.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-action="manage-order"]');
    if (!btn) return;
    
    e.preventDefault();
    e.stopPropagation();

    const id = btn.dataset.orderId;
    openManageModal(id);
  });
};

// ─────────────────────────────────────────────────────────────
// DATA FETCHING
// ─────────────────────────────────────────────────────────────
const fetchOrders = async () => {
  showLoader('orders-table-container');
  try {
    const { data, error } = await supabase
      .from('orders')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    
    OrderState.set(data || []);
    applyFilters();
  } catch (err) {
    console.error('[Orders] Fetch error:', err);
    Toast.show('Failed to load orders.', 'error');
  }
};

// ─────────────────────────────────────────────────────────────
// FILTER + SEARCH
// ─────────────────────────────────────────────────────────────
const applyFilters = () => {
  const term = (document.getElementById('search-orders')?.value || '').toLowerCase();
  const paymentFilter = document.getElementById('filter-payment')?.value || 'All';
  const statusFilter = document.getElementById('filter-status')?.value || 'All';

  const filtered = OrderState.getAll().filter((o) => {
    const matchSearch =
      (o.order_number && o.order_number.toLowerCase().includes(term)) ||
      (o.customer_name && o.customer_name.toLowerCase().includes(term)) ||
      (o.customer_phone && o.customer_phone.includes(term)) ||
      (o.product_name && o.product_name.toLowerCase().includes(term));

    const matchPayment = paymentFilter === 'All' || o.payment_status === paymentFilter;
    const matchStatus = statusFilter === 'All' || o.order_status === statusFilter;

    return matchSearch && matchPayment && matchStatus;
  });

  renderOrdersTable(filtered);
};

// ─────────────────────────────────────────────────────────────
// TABLE RENDER
// ─────────────────────────────────────────────────────────────
const formatCurrency = (price) => {
  return new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 }).format(price);
};

// Custom badge styles based on order specific logic
const getPaymentBadge = (status) => {
  const s = status ? status.toLowerCase() : '';
  if (s === 'paid') return 'admin-badge--success';
  if (s === 'pending') return 'admin-badge--warning';
  if (s === 'failed') return 'admin-badge--danger';
  if (s === 'refunded') return 'admin-badge--muted';
  return '';
};

const getOrderBadge = (status) => {
  const s = status ? status.toLowerCase() : '';
  if (s === 'delivered') return 'admin-badge--success';
  if (s === 'shipped' || s === 'processing') return 'admin-badge--info';
  if (s === 'pending') return 'admin-badge--warning';
  if (s === 'cancelled') return 'admin-badge--danger';
  return '';
};

const renderOrdersTable = (data) => {
  const columns = ['Order ID', 'Customer', 'Product', 'Total', 'Payment', 'Status', 'Actions'];

  const rowRender = (item) => {
    const pBadgeClass = getPaymentBadge(item.payment_status);
    const pBadge = `<span class="admin-badge ${pBadgeClass}">${item.payment_status || 'Pending'}</span>`;
    
    const oBadgeClass = getOrderBadge(item.order_status);
    const oBadge = `<span class="admin-badge ${oBadgeClass}">${item.order_status || 'Pending'}</span>`;
    
    const createdDate = new Date(item.created_at).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
    });

    return `
      <td>
        <div style="font-weight:600;color:var(--admin-text-main);">${item.order_number || item.id}</div>
        <div style="font-size:0.8rem;color:var(--admin-text-muted);">${createdDate}</div>
      </td>
      <td>
        <div style="font-weight:600;color:var(--admin-text-main);">${item.customer_name}</div>
        <div style="font-size:0.8rem;color:var(--admin-text-muted);">${item.customer_phone || ''}</div>
      </td>
      <td>
        <div style="max-width:200px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;" title="${item.product_name}">
          ${item.product_name}
        </div>
        <div style="font-size:0.8rem;color:var(--admin-text-muted);">Qty: ${item.quantity}</div>
      </td>
      <td>
        <div style="font-weight:600;">${formatCurrency(item.total_amount || item.unit_price * item.quantity)}</div>
      </td>
      <td>${pBadge}</td>
      <td>${oBadge}</td>
      <td>
        <div class="admin-table-actions">
          <button
            type="button"
            class="admin-btn admin-btn--outline"
            style="padding:0.35rem 0.75rem;font-size:0.8rem;"
            data-order-id="${item.id}"
            data-action="manage-order"
          >
            <i class="fa-solid fa-pen-to-square"></i> Manage
          </button>
        </div>
      </td>
    `;
  };

  renderTable('orders-table-container', columns, data, rowRender, 'No orders found.');
};

// ─────────────────────────────────────────────────────────────
// MANAGE MODAL
// ─────────────────────────────────────────────────────────────
let currentEditingOrderId = null;

const openManageModal = (orderId) => {
  const order = OrderState.get(orderId);
  if (!order) {
    Toast.show('Order not found.', 'error');
    return;
  }
  
  currentEditingOrderId = orderId;

  const modalBody = document.getElementById('order-modal-body');
  
  modalBody.innerHTML = `
    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 2rem;">
      <!-- Customer Info -->
      <div>
        <h4 style="margin-top: 0; color: var(--admin-primary); margin-bottom: 1rem; border-bottom: 1px solid var(--admin-border); padding-bottom: 0.5rem;">Customer Information</h4>
        <p><strong>Name:</strong> ${order.customer_name}</p>
        <p><strong>Phone:</strong> <a href="tel:${order.customer_phone}" class="admin-link">${order.customer_phone}</a></p>
        <p><strong>Email:</strong> <a href="mailto:${order.customer_email}" class="admin-link">${order.customer_email || 'N/A'}</a></p>
        <p><strong>Address:</strong><br>${order.delivery_address ? order.delivery_address.replace(/\n/g, '<br>') : 'N/A'}</p>
      </div>

      <!-- Order Info -->
      <div>
        <h4 style="margin-top: 0; color: var(--admin-primary); margin-bottom: 1rem; border-bottom: 1px solid var(--admin-border); padding-bottom: 0.5rem;">Order Details</h4>
        <p><strong>Order ID:</strong> ${order.order_number || order.id}</p>
        <p><strong>Date:</strong> ${new Date(order.created_at).toLocaleString()}</p>
        <p><strong>Product:</strong> ${order.product_name}</p>
        <p><strong>Quantity:</strong> ${order.quantity}</p>
        <p><strong>Unit Price:</strong> ${formatCurrency(order.unit_price)}</p>
        <p><strong>Total Amount:</strong> <span style="font-size: 1.1rem; font-weight: bold; color: var(--admin-primary);">${formatCurrency(order.total_amount)}</span></p>
        <p><strong>Notes:</strong> ${order.additional_notes || 'None'}</p>
      </div>
    </div>
    
    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 2rem; margin-top: 2rem;">
      <div class="admin-form-group">
        <label class="admin-form-label">Payment Status</label>
        <select id="edit-payment-status" class="admin-form-input">
          <option value="Pending" ${order.payment_status === 'Pending' ? 'selected' : ''}>Pending</option>
          <option value="Paid" ${order.payment_status === 'Paid' ? 'selected' : ''}>Paid</option>
          <option value="Failed" ${order.payment_status === 'Failed' ? 'selected' : ''}>Failed</option>
          <option value="Refunded" ${order.payment_status === 'Refunded' ? 'selected' : ''}>Refunded</option>
        </select>
      </div>
      <div class="admin-form-group">
        <label class="admin-form-label">Order Status</label>
        <select id="edit-order-status" class="admin-form-input">
          <option value="Pending" ${order.order_status === 'Pending' ? 'selected' : ''}>Pending</option>
          <option value="Processing" ${order.order_status === 'Processing' ? 'selected' : ''}>Processing</option>
          <option value="Shipped" ${order.order_status === 'Shipped' ? 'selected' : ''}>Shipped</option>
          <option value="Delivered" ${order.order_status === 'Delivered' ? 'selected' : ''}>Delivered</option>
          <option value="Cancelled" ${order.order_status === 'Cancelled' ? 'selected' : ''}>Cancelled</option>
        </select>
      </div>
    </div>
  `;

  document.getElementById('order-modal').classList.add('active');
};

const closeManageModal = () => {
  document.getElementById('order-modal').classList.remove('active');
  currentEditingOrderId = null;
};

const saveOrderChanges = async () => {
  if (!currentEditingOrderId) return;
  
  const saveBtn = document.getElementById('btn-save-order');
  saveBtn.disabled = true;
  saveBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Saving...';

  const newPaymentStatus = document.getElementById('edit-payment-status').value;
  const newOrderStatus = document.getElementById('edit-order-status').value;

  try {
    const { error } = await supabase
      .from('orders')
      .update({ payment_status: newPaymentStatus, order_status: newOrderStatus })
      .eq('id', currentEditingOrderId);

    if (error) throw error;

    OrderState.update({ id: currentEditingOrderId, payment_status: newPaymentStatus, order_status: newOrderStatus });
    applyFilters();
    closeManageModal();
    Toast.show('Order updated successfully.', 'success');

  } catch (error) {
    console.error('Error updating order:', error);
    Toast.show('Failed to update order.', 'error');
  } finally {
    saveBtn.disabled = false;
    saveBtn.textContent = 'Save Changes';
  }
};

// ─────────────────────────────────────────────────────────────
// BOOTSTRAP
// ─────────────────────────────────────────────────────────────
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initOrders);
} else {
  initOrders();
}
