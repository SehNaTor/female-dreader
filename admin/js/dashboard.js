import { requireAuth } from './auth.js';
import { injectLayout } from '../components/layout.js';
import { supabase } from './supabase.js';
import { normalizeStatus, compareStatus } from './status-utils.js';
const initDashboard = async () => {
  // 1. Authenticate and build layout
  const user = await requireAuth();
  if (!user) return;

  injectLayout('Dashboard Overview', 'dashboard');

  // 2. Fetch Stats
  fetchStats();
  fetchRecentBookings();
};

const fetchStats = async () => {
  try {
    // We can run these concurrently
    const [
      { count: servicesCount },
      { count: productsCount },
      { count: galleryCount },
      { data: allBookings },
      { data: allOrders }
    ] = await Promise.all([
      supabase.from('services').select('*', { count: 'exact', head: true }),
      supabase.from('products').select('*', { count: 'exact', head: true }),
      supabase.from('gallery').select('*', { count: 'exact', head: true }),
      supabase.from('bookings').select('status'),
      supabase.from('orders').select('order_status')
    ]);

    let pendingCount = 0;
    let confirmedCount = 0;
    let completedCount = 0;
    let cancelledCount = 0;

    if (allBookings) {
      allBookings.forEach(b => {
        const s = normalizeStatus(b.status);
        if (s === 'Pending') pendingCount++;
        else if (s === 'Confirmed') confirmedCount++;
        else if (s === 'Completed') completedCount++;
        else if (s === 'Cancelled') cancelledCount++;
      });
    }

    let ordersTotal = 0;
    let ordersPending = 0;
    let ordersProcessing = 0;
    let ordersDelivered = 0;

    if (allOrders) {
      ordersTotal = allOrders.length;
      allOrders.forEach(o => {
        const s = o.order_status || 'Pending';
        if (s === 'Pending') ordersPending++;
        else if (s === 'Processing') ordersProcessing++;
        else if (s === 'Delivered') ordersDelivered++;
      });
    }

    document.getElementById('stat-services').textContent = servicesCount || 0;
    document.getElementById('stat-products').textContent = productsCount || 0;
    document.getElementById('stat-gallery').textContent = galleryCount || 0;
    document.getElementById('stat-pending').textContent = pendingCount || 0;
    document.getElementById('stat-confirmed').textContent = confirmedCount || 0;
    document.getElementById('stat-completed').textContent = completedCount || 0;
    document.getElementById('stat-cancelled').textContent = cancelledCount || 0;

    const elOrdersTotal = document.getElementById('stat-orders-total');
    if (elOrdersTotal) elOrdersTotal.textContent = ordersTotal;
    
    const elOrdersPending = document.getElementById('stat-orders-pending');
    if (elOrdersPending) elOrdersPending.textContent = ordersPending;

    const elOrdersProcessing = document.getElementById('stat-orders-processing');
    if (elOrdersProcessing) elOrdersProcessing.textContent = ordersProcessing;

    const elOrdersDelivered = document.getElementById('stat-orders-delivered');
    if (elOrdersDelivered) elOrdersDelivered.textContent = ordersDelivered;

  } catch (error) {
    console.error('Error fetching stats:', error);
  }
};

const fetchRecentBookings = async () => {
  const container = document.getElementById('recent-bookings-container');
  try {
    const { data, error } = await supabase
      .from('bookings')
      .select('id, customer_name, service, appointment_date, appointment_time, created_at, status')
      .ilike('status', '%pending%')
      .order('created_at', { ascending: false });

    if (error) throw error;

    const pendingBookings = (data || []).filter(b => compareStatus(b.status, 'Pending')).slice(0, 5);

    if (pendingBookings.length === 0) {
      container.innerHTML = '<p class="text-muted text-center" style="padding: 2rem;">No pending bookings.</p>';
      return;
    }

    const listHtml = pendingBookings.map(b => `
      <div class="recent-item">
        <div class="recent-item__left">
          <span class="recent-item__title">${b.customer_name}</span>
          <span class="recent-item__meta">${b.service} | ${new Date(b.appointment_date).toLocaleDateString()} at ${b.appointment_time}</span>
        </div>
        <div>
          <a href="bookings.html?id=${b.id}" class="admin-btn admin-btn--outline" style="padding: 0.4rem 0.8rem; font-size: 0.8rem;">Review</a>
        </div>
      </div>
    `).join('');

    container.innerHTML = `<div class="recent-list">${listHtml}</div>`;

  } catch (error) {
    console.error('Error fetching recent bookings:', error);
    container.innerHTML = '<p class="text-danger">Failed to load recent bookings.</p>';
  }
};

// Initialize
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initDashboard);
} else {
  initDashboard();
}
