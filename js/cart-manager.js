/* ======================================
   SHOPPING CART MANAGER
   Handles all cart state, persistence,
   and derived totals for the storefront.
   ====================================== */

import { getCartSummary } from './order-utils.js';

const STORAGE_KEY = 'female-dreader-cart';

class CartManager {
  constructor() {
    this.items = [];
    this.listeners = new Set();
    this.load();
  }

  subscribe(callback) {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  emit() {
    this.listeners.forEach((listener) => listener(this.getSnapshot()));
  }

  getSnapshot() {
    return {
      items: this.items.map((item) => ({ ...item })),
      ...getCartSummary(this.items)
    };
  }

  load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        this.items = [];
        return;
      }

      const parsed = JSON.parse(raw);
      this.items = Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      console.warn('[Cart] Failed to restore cart:', error);
      this.items = [];
    }
  }

  persist() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.items));
    } catch (error) {
      console.warn('[Cart] Failed to persist cart:', error);
    }
  }

  addItem(product, quantity = 1) {
    const normalizedQuantity = Math.max(1, Number(quantity) || 1);
    const existing = this.items.find((item) => String(item.id) === String(product.id));

    if (existing) {
      existing.quantity += normalizedQuantity;
    } else {
      this.items.push({
        id: product.id,
        name: product.name,
        category: product.category,
        description: product.description,
        price: Number(product.price) || 0,
        image_url: product.image_url,
        quantity: normalizedQuantity
      });
    }

    this.persist();
    this.emit();
    return this.getSnapshot();
  }

  removeItem(productId) {
    this.items = this.items.filter((item) => String(item.id) !== String(productId));
    this.persist();
    this.emit();
    return this.getSnapshot();
  }

  updateQuantity(productId, quantity) {
    const safeQuantity = Math.max(0, Number(quantity) || 0);
    this.items = this.items.reduce((acc, item) => {
      if (String(item.id) === String(productId)) {
        if (safeQuantity > 0) {
          acc.push({ ...item, quantity: safeQuantity });
        }
      } else {
        acc.push(item);
      }
      return acc;
    }, []);

    this.persist();
    this.emit();
    return this.getSnapshot();
  }

  increaseQuantity(productId) {
    const target = this.items.find((item) => String(item.id) === String(productId));
    if (!target) return this.getSnapshot();
    return this.updateQuantity(productId, target.quantity + 1);
  }

  decreaseQuantity(productId) {
    const target = this.items.find((item) => String(item.id) === String(productId));
    if (!target) return this.getSnapshot();
    return this.updateQuantity(productId, target.quantity - 1);
  }

  clear() {
    this.items = [];
    this.persist();
    this.emit();
    return this.getSnapshot();
  }

  getItems() {
    return this.items.map((item) => ({ ...item }));
  }
}

export const cartManager = new CartManager();
