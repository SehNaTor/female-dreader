/* ======================================
   ORDER UTILITIES
   Handles formatting, payload building,
   validation, and order number generation.
   ====================================== */

const ORDER_STATUS = {
  PENDING: 'Pending',
  CONFIRMED: 'Confirmed',
  PROCESSING: 'Processing',
  READY: 'Ready',
  // SHIPPED: 'Shipped',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled'
};

const PAYMENT_STATUS = {
  PENDING: 'Unpaid',
  PAID: 'Paid',
  FAILED: 'Failed',
  REFUNDED: 'Refunded'
};

export const formatPrice = (price) => {
  const amount = Number(price) || 0;
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    maximumFractionDigits: 0
  }).format(amount);
};

export const getItemSubtotal = (item) => {
  const unitPrice = Number(item?.price) || 0;
  const quantity = Number(item?.quantity) || 0;
  return unitPrice * quantity;
};

export const getCartSummary = (items) => {
  const totalQuantity = items.reduce((sum, item) => sum + (Number(item?.quantity) || 0), 0);
  const grandTotal = items.reduce((sum, item) => sum + getItemSubtotal(item), 0);

  return { totalQuantity, grandTotal };
};

const buildDateSegment = () => {
  return new Date().toISOString().slice(0, 10).replace(/-/g, '');
};

export const generateOrderNumber = () => {
  const datePart = buildDateSegment();
  const randomPart = Math.random().toString(36).slice(2, 7).toUpperCase();
  return `FD-${datePart}-${randomPart}`;
};

export const ensureUniqueOrderNumber = async (supabaseClient) => {
  let candidate = generateOrderNumber();
  let attempts = 0;

  while (attempts < 8) {
    const { data, error } = await supabaseClient
      .from('orders')
      .select('order_number')
      .eq('order_number', candidate)
      .maybeSingle();

    if (error) {
      console.warn('[Orders] Unique order check failed:', error);
      return candidate;
    }

    if (!data) {
      return candidate;
    }

    candidate = generateOrderNumber();
    attempts += 1;
  }

  return candidate;
};

export const buildOrderPayload = ({ items, customer, paymentMethod = 'Paystack', orderNumber }) => {
  const safeItems = Array.isArray(items) ? items : [];
  const summary = getCartSummary(safeItems);
  const firstItem = safeItems[0] || null;

  const payload = {
    order_number: orderNumber,
    customer_name: (customer?.name || '').trim(),
    customer_phone: (customer?.phone || '').trim(),
    email: (customer?.email || '').trim(),
    delivery_address: (customer?.address || '').trim(),
    additional_notes: (customer?.notes || '').trim(),
    customer_email: (customer?.email || '').trim(),
    cart_items: safeItems.map((item) => ({
      id: item.id,
      name: item.name,
      category: item.category,
      price: Number(item.price) || 0,
      quantity: Number(item.quantity) || 0,
      subtotal: getItemSubtotal(item)
    })),
    total_quantity: summary.totalQuantity,
    total_amount: summary.grandTotal,
    payment_method: paymentMethod,
    payment_status: PAYMENT_STATUS.PENDING,
    order_status: ORDER_STATUS.PENDING,
    product_name: safeItems.length === 1 ? firstItem.name : `${safeItems.length} products`,
    product_id: firstItem?.id || null,
    product_category: firstItem?.category || '',
    unit_price: firstItem ? Number(firstItem.price) || 0 : 0,
    quantity: summary.totalQuantity
  };

  return payload;
};

export const validateOrderPayload = (payload) => {
  const errors = [];

  if (!payload.order_number) errors.push('The order reference could not be generated.');
  if (!payload.customer_name) errors.push('Please enter your full name.');
  if (!payload.phone && !payload.customer_phone) errors.push('Please enter your phone number.');
  if (!payload.email && !payload.customer_email) errors.push('Please enter your email address.');
  if (!payload.delivery_address) errors.push('Please enter your delivery address.');
  if (!Array.isArray(payload.cart_items) || payload.cart_items.length === 0) errors.push('Your cart is empty.');
  if (!Number.isFinite(payload.total_amount) || payload.total_amount <= 0) errors.push('The total amount is invalid.');
  if (!Number.isInteger(payload.total_quantity) || payload.total_quantity < 1) errors.push('The total quantity is invalid.');
  if (payload.order_status !== ORDER_STATUS.PENDING) errors.push('Order status is invalid.');
  if (payload.payment_status !== PAYMENT_STATUS.PENDING) errors.push('Payment status is invalid.');

  return { isValid: errors.length === 0, errors };
};

export const startPayment = async (order) => {
  return new Promise((resolve) => {
    window.setTimeout(() => {
      console.info('[Orders] Payment preparation ready for:', order?.order_number || 'unknown');
      resolve({ status: 'prepared', provider: 'paystack' });
    }, 250);
  });
};
