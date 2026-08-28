/* ======================================
   CART UI
   Renders the floating cart, drawer,
   and manages cart interactions.
   ====================================== */

import { cartManager } from './cart-manager.js';
import { formatPrice, getItemSubtotal } from './order-utils.js';
import { toast } from './toast.js';

export class CartUI {
  constructor({ onCheckoutStart, onContinueShopping }) {
    this.onCheckoutStart = onCheckoutStart;
    this.onContinueShopping = onContinueShopping;
    this.container = null;
    this.drawer = null;
    this.isOpen = false;
    this.bind();
  }

  bind() {
    document.addEventListener('click', (event) => {
      const trigger = event.target.closest('[data-cart-trigger]');
      if (trigger) {
        this.open();
      }

      const checkoutButton = event.target.closest('[data-cart-checkout]');
      if (checkoutButton) {
        this.close();
        this.onCheckoutStart?.();
      }

      const addButton = event.target.closest('[data-add-to-cart]');
      if (addButton) {
        const productId = addButton.dataset.productId;
        const product = window.__femaleDreaderProducts?.find((item) => String(item.id) === String(productId));
        if (product) {
          cartManager.addItem(product, 1);
          toast.show(`${product.name} added to cart`, 'success');
          this.render();
        }
      }

      const buyButton = event.target.closest('[data-buy-now]');
      if (buyButton) {
        const productId = buyButton.dataset.productId;
        const product = window.__femaleDreaderProducts?.find((item) => String(item.id) === String(productId));
        if (product) {
          cartManager.clear();
          cartManager.addItem(product, 1);
          this.render();
          this.open();
          this.onCheckoutStart?.(product);
        }
      }

      const incButton = event.target.closest('[data-cart-inc]');
      if (incButton) {
        cartManager.increaseQuantity(incButton.dataset.productId);
        this.render();
      }

      const decButton = event.target.closest('[data-cart-dec]');
      if (decButton) {
        cartManager.decreaseQuantity(decButton.dataset.productId);
        this.render();
      }

      const removeButton = event.target.closest('[data-cart-remove]');
      if (removeButton) {
        cartManager.removeItem(removeButton.dataset.productId);
        toast.show('Item removed from cart', 'info');
        this.render();
      }

      const emptyButton = event.target.closest('[data-cart-empty]');
      if (emptyButton) {
        cartManager.clear();
        toast.show('Cart cleared', 'info');
        this.render();
      }

      const continueButton = event.target.closest('[data-cart-continue]');
      if (continueButton) {
        this.close();
        this.onContinueShopping?.();
      }

      const closeButton = event.target.closest('[data-cart-close]');
      if (closeButton) {
        this.close();
      }
    });

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && this.isOpen) {
        this.close();
      }
    });

    cartManager.subscribe(() => this.render());
  }

  render() {
    const snapshot = cartManager.getSnapshot();
    const badge = document.getElementById('cart-badge');
    const count = document.getElementById('cart-count');
    const total = document.getElementById('cart-total');

    if (badge) {
      badge.textContent = snapshot.totalQuantity;
      badge.classList.toggle('is-active', snapshot.totalQuantity > 0);
    }

    if (count) {
      count.textContent = `${snapshot.totalQuantity} item${snapshot.totalQuantity === 1 ? '' : 's'}`;
    }

    if (total) {
      total.textContent = formatPrice(snapshot.grandTotal);
    }

    const drawerContent = document.getElementById('cart-drawer-content');
    if (drawerContent) {
      drawerContent.innerHTML = this.buildDrawerMarkup(snapshot);
    }
  }

  buildDrawerMarkup(snapshot) {
    const { items, totalQuantity, grandTotal } = snapshot;

    if (!items.length) {
      return `
        <div class="prd-cart-drawer__empty">
          <div class="prd-cart-drawer__empty-icon"><i class="fa-solid fa-bag-shopping"></i></div>
          <h3>Your cart is empty</h3>
          <p>Choose a few essentials and your order will appear here.</p>
          <button type="button" class="prd-btn prd-btn--primary" data-cart-continue>Continue Shopping</button>
        </div>
      `;
    }

    return `
      <div class="prd-cart-drawer__body">
        <div class="prd-cart-drawer__items">
          ${items.map((item) => `
            <div class="prd-cart-drawer__item">
              <img src="${item.image_url}" alt="${item.name}" class="prd-cart-drawer__image">
              <div class="prd-cart-drawer__details">
                <div class="prd-cart-drawer__title-row">
                  <h4>${item.name}</h4>
                  <button type="button" class="prd-cart-drawer__remove" data-cart-remove data-product-id="${item.id}" aria-label="Remove ${item.name}">
                    <i class="fa-solid fa-xmark"></i>
                  </button>
                </div>
                <p class="prd-cart-drawer__meta">${item.category}</p>
                <div class="prd-cart-drawer__price-row">
                  <span class="prd-cart-drawer__unit">${formatPrice(item.price)}</span>
                  <div class="prd-cart-drawer__qty">
                    <button type="button" data-cart-dec data-product-id="${item.id}" aria-label="Decrease quantity">-</button>
                    <span>${item.quantity}</span>
                    <button type="button" data-cart-inc data-product-id="${item.id}" aria-label="Increase quantity">+</button>
                  </div>
                </div>
                <div class="prd-cart-drawer__subtotal">${formatPrice(getItemSubtotal(item))}</div>
              </div>
            </div>
          `).join('')}
        </div>
        <div class="prd-cart-drawer__footer">
          <div class="prd-cart-drawer__summary">
            <span>${totalQuantity} item${totalQuantity === 1 ? '' : 's'}</span>
            <strong>${formatPrice(grandTotal)}</strong>
          </div>
          <div class="prd-cart-drawer__actions">
            <button type="button" class="prd-btn prd-btn--ghost-dark prd-btn--full" data-cart-empty>Empty Cart</button>
            <button type="button" class="prd-btn prd-btn--primary prd-btn--full" data-cart-continue>Continue Shopping</button>
            <button type="button" class="prd-btn prd-btn--primary prd-btn--full" data-cart-checkout>Checkout</button>
          </div>
        </div>
      </div>
    `;
  }

  open() {
    if (!this.drawer) {
      this.drawer = document.getElementById('cart-drawer');
    }

    if (!this.drawer) return;

    this.drawer.classList.add('is-open');
    this.drawer.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    this.isOpen = true;
    this.render();
  }

  close() {
    if (!this.drawer) {
      this.drawer = document.getElementById('cart-drawer');
    }

    if (!this.drawer) return;

    this.drawer.classList.remove('is-open');
    this.drawer.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
    this.isOpen = false;
  }
}
