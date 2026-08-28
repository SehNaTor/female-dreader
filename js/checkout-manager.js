/* ======================================
   CHECKOUT MANAGER
   Controls the checkout modal lifecycle,
   quantity updates, and submission UI.
   ====================================== */

import { cartManager } from './cart-manager.js';
import { toast } from './toast.js';
import { formatPrice, getItemSubtotal, getCartSummary, ensureUniqueOrderNumber, buildOrderPayload, validateOrderPayload, startPayment } from './order-utils.js';
import { supabase } from './supabase.js';

export class CheckoutManager {
  constructor({ onSuccess, onCancel }) {
    this.onSuccess = onSuccess;
    this.onCancel = onCancel;
    this.modal = document.getElementById('prd-order-modal');
    this.form = document.getElementById('prd-order-form');
    this.summaryItems = document.getElementById('checkout-summary-list');
    this.totalAmount = document.getElementById('checkout-total-amount');
    this.itemCount = document.getElementById('checkout-item-count');
    this.formNotification = document.getElementById('form-notification');
    this.checkoutButton = document.getElementById('checkout-submit-button');
    this.successStage = document.getElementById('checkout-success-stage');
    this.formStage = document.getElementById('prd-order-form');
    this.isSubmitting = false;
    this.currentOrder = null;
    this.isSuccessState = false;
    this.bind();
  }

  bind() {
    document.addEventListener('click', (event) => {
      const continueShopping = event.target.closest('[data-checkout-continue]');
      if (continueShopping) {
        this.resetView();
        this.close();
        this.onCancel?.();
        return;
      }

      const copyOrder = event.target.closest('[data-checkout-copy]');
      if (copyOrder && this.currentOrder?.order_number) {
        navigator.clipboard?.writeText(this.currentOrder.order_number);
        toast.show('Order number copied', 'info');
        return;
      }
      const trigger = event.target.closest('[data-open-checkout]');
      if (trigger) {
        this.open();
      }

      const closeTrigger = event.target.closest('[data-close-order]');
      if (closeTrigger) {
        this.close();
      }

      const qtyPlus = event.target.closest('[data-checkout-inc]');
      if (qtyPlus) {
        cartManager.increaseQuantity(qtyPlus.dataset.productId);
        this.renderSummary();
      }

      const qtyMinus = event.target.closest('[data-checkout-dec]');
      if (qtyMinus) {
        cartManager.decreaseQuantity(qtyMinus.dataset.productId);
        this.renderSummary();
      }
    });

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && this.modal?.classList.contains('is-active')) {
        this.close();
      }

      if (event.key === 'Tab' && this.modal?.classList.contains('is-active')) {
        this.trapFocus(event);
      }
    });

    this.form?.addEventListener('submit', (event) => this.handleSubmit(event));
  }

  open() {
    if (!this.modal) return;
    this.isSuccessState = false;
    this.resetView();
    this.renderSummary();
    this.modal.classList.add('is-active');
    this.modal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
  }

  close() {
    if (!this.modal) return;
    this.modal.classList.remove('is-active');
    this.modal.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
    this.resetView();
    this.onCancel?.();
  }

  resetView() {
    if (this.successStage) this.successStage.hidden = true;
    if (this.formStage) this.formStage.style.display = '';
    this.isSuccessState = false;
  }

  showSuccessState(order) {
    this.isSuccessState = true;
    if (this.formStage) this.formStage.style.display = 'none';
    if (this.successStage) {
      this.successStage.hidden = false;
      this.successStage.innerHTML = `
        <div class="checkout-success-stage__card">
          <h4>Order Confirmed</h4>
          <p>Your order number is <strong>${order.order_number}</strong>.</p>
          <p>We will contact you soon to confirm your delivery and next steps.</p>
          <div class="checkout-success-stage__actions">
            <button type="button" class="prd-btn prd-btn--primary" data-checkout-continue>Continue Shopping</button>
            <button type="button" class="prd-btn prd-btn--ghost-dark" data-checkout-copy>Copy Order Number</button>
            <button type="button" class="prd-btn prd-btn--ghost-dark" disabled>Track Order</button>
            <button type="button" class="prd-btn prd-btn--ghost-dark" disabled>Download Receipt</button>
          </div>
        </div>
      `;
    }
  }

  trapFocus(event) {
    const focusable = this.modal.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
    if (!focusable.length) return;

    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  renderSummary() {
    const items = cartManager.getItems();
    const summary = getCartSummary(items);
    this.summaryItems.innerHTML = items.length
      ? items.map((item) => `
          <article class="checkout-summary__item">
            <img src="${item.image_url}" alt="${item.name}" class="checkout-summary__thumb">
            <div class="checkout-summary__info">
              <div class="checkout-summary__heading">
                <h4>${item.name}</h4>
                <span class="checkout-summary__price">${formatPrice(getItemSubtotal(item))}</span>
              </div>
              <p>${item.category}</p>
              <div class="checkout-summary__controls">
                <button type="button" class="checkout-summary__stepper" data-checkout-dec data-product-id="${item.id}" aria-label="Decrease quantity"><i class="fa-solid fa-minus"></i></button>
                <span>${item.quantity}</span>
                <button type="button" class="checkout-summary__stepper" data-checkout-inc data-product-id="${item.id}" aria-label="Increase quantity"><i class="fa-solid fa-plus"></i></button>
              </div>
            </div>
          </article>
        `).join('')
      : '<div class="checkout-empty-state">Your checkout is empty. Add products to continue.</div>';

    if (this.totalAmount) {
      this.totalAmount.textContent = formatPrice(summary.grandTotal);
    }

    if (this.itemCount) {
      this.itemCount.textContent = `${summary.totalQuantity} item${summary.totalQuantity === 1 ? '' : 's'}`;
    }
  }

  setFormNotification(message, type = 'error') {
    if (!this.formNotification) return;

    this.formNotification.textContent = message;
    this.formNotification.className = `form-notification ${type}`;
    this.formNotification.style.display = 'block';
  }

  clearFormNotification() {
    if (!this.formNotification) return;
    this.formNotification.textContent = '';
    this.formNotification.className = 'form-notification';
    this.formNotification.style.display = 'none';
  }

  setSubmitting(isSubmitting) {
    this.isSubmitting = isSubmitting;
    if (!this.checkoutButton) return;
    this.checkoutButton.disabled = isSubmitting;
    const label = this.checkoutButton.querySelector('.btn-text');
    const spinner = this.checkoutButton.querySelector('.btn-loader');
    if (label) label.style.display = isSubmitting ? 'none' : 'inline-block';
    if (spinner) spinner.style.display = isSubmitting ? 'inline-block' : 'none';
  }

  async handleSubmit(event) {
    event.preventDefault();
    if (this.isSubmitting) return;

    const customer = {
      name: document.getElementById('order-name')?.value.trim() || '',
      phone: document.getElementById('order-phone')?.value.trim() || '',
      email: document.getElementById('order-email')?.value.trim() || '',
      address: document.getElementById('order-address')?.value.trim() || '',
      notes: document.getElementById('order-notes')?.value.trim() || ''
    };

    const items = cartManager.getItems();
    const summary = getCartSummary(items);
    if (!summary.totalQuantity) {
      this.setFormNotification('Your cart is empty. Add at least one product before placing an order.', 'error');
      return;
    }

    this.setSubmitting(true);
    this.clearFormNotification();

    try {
      const orderNumber = await ensureUniqueOrderNumber(supabase);
      const payload = buildOrderPayload({ items, customer, orderNumber });
      const { isValid, errors } = validateOrderPayload(payload);

      if (!isValid) {
        this.setFormNotification(errors.join(' '), 'error');
        return;
      }

      const { error } = await supabase.from('orders').insert([payload]).select();
      if (error) throw error;

      this.currentOrder = payload;
      this.form.reset();
      cartManager.clear();
      await startPayment(payload);
      toast.show(`Order ${payload.order_number} placed successfully`, 'success');
      this.showSuccessState(payload);
      this.onSuccess?.(payload);
    } catch (error) {
      console.error('[Orders] Submission failed:', error);
      this.setFormNotification('We could not place your order right now. Please try again in a moment.', 'error');
      toast.show('Order failed. Please try again.', 'error');
    } finally {
      this.setSubmitting(false);
    }
  }
}
