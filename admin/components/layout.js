import { logout } from '../js/auth.js';

/**
 * Dynamically injects the global admin sidebar, header, and wrappers.
 * Keeps all HTML pages clean and DRY.
 */
export const injectLayout = (pageTitle, activeNav) => {
  const pageBase = window.location.pathname.includes('/admin/') ? '../' : './';

  // Grab whatever content is currently in the body (this is the page-specific UI)
  const originalContent = document.body.innerHTML;
  
  // Clear body to prepare for injection
  document.body.innerHTML = '';

  // 1. Sidebar
  const sidebar = document.createElement('aside');
  sidebar.className = 'admin-sidebar';
  sidebar.id = 'admin-sidebar';
  sidebar.innerHTML = `
    <div class="admin-sidebar__header">
      <i class="fa-solid fa-crown"></i>
      FD Admin
    </div>
    <nav class="admin-sidebar__nav">
      <a href="${pageBase}dashboard.html" class="admin-sidebar__link ${activeNav === 'dashboard' ? 'active' : ''}">
        <i class="fa-solid fa-chart-line"></i> Dashboard
      </a>
      <a href="${pageBase}admin-services.html" class="admin-sidebar__link ${activeNav === 'services' ? 'active' : ''}">
        <i class="fa-solid fa-scissors"></i> Services
      </a>
      <a href="${pageBase}admin-products.html" class="admin-sidebar__link ${activeNav === 'products' ? 'active' : ''}">
        <i class="fa-solid fa-bottle-droplet"></i> Products
      </a>
      <a href="${pageBase}admin-gallery.html" class="admin-sidebar__link ${activeNav === 'gallery' ? 'active' : ''}">
        <i class="fa-solid fa-images"></i> Gallery
      </a>
      <a href="${pageBase}bookings.html" class="admin-sidebar__link ${activeNav === 'bookings' ? 'active' : ''}">
        <i class="fa-regular fa-calendar-check"></i> Bookings
      </a>
      <a href="${pageBase}orders.html" class="admin-sidebar__link ${activeNav === 'orders' ? 'active' : ''}">
        <i class="fa-solid fa-cart-shopping"></i> Orders
      </a>
      <a href="${pageBase}settings.html" class="admin-sidebar__link ${activeNav === 'settings' ? 'active' : ''}">
        <i class="fa-solid fa-gear"></i> Settings
      </a>
    </nav>
    <div class="admin-sidebar__footer">
      <a href="${pageBase}index.html" class="admin-btn admin-btn--outline" style="width: 100%; margin-bottom: 0.75rem; text-decoration: none;">
        <i class="fa-solid fa-arrow-left"></i> Back to Website
      </a>
      <button class="admin-btn admin-btn--outline" style="width: 100%;" id="admin-logout-btn">
        <i class="fa-solid fa-arrow-right-from-bracket"></i> Logout
      </button>
    </div>
  `;

  // 2. Main Wrapper
  const main = document.createElement('main');
  main.className = 'admin-main';

  // 3. Header
  const header = document.createElement('header');
  header.className = 'admin-header';
  header.innerHTML = `
    <div class="admin-header__left">
      <button class="admin-menu-toggle" id="admin-menu-toggle" aria-label="Toggle Menu">
        <i class="fa-solid fa-bars"></i>
      </button>
      <h1 class="admin-header__title">${pageTitle}</h1>
    </div>
    <div class="admin-header__right">
      <div class="admin-user">
        <div class="admin-user__avatar">A</div>
        <span class="admin-user__name">Admin</span>
      </div>
    </div>
  `;

  // 4. Content Area
  const content = document.createElement('div');
  content.className = 'admin-content';
  content.innerHTML = originalContent; // Restore page-specific UI

  // 5. Mobile Overlay
  const overlay = document.createElement('div');
  overlay.className = 'admin-overlay';
  overlay.id = 'admin-overlay';

  // 6. Assemble DOM
  main.appendChild(header);
  main.appendChild(content);
  document.body.appendChild(sidebar);
  document.body.appendChild(main);
  document.body.appendChild(overlay);

  // 7. Event Listeners
  document.getElementById('admin-logout-btn').addEventListener('click', logout);

  const toggleBtn = document.getElementById('admin-menu-toggle');
  const overlayEl = document.getElementById('admin-overlay');
  
  const toggleMenu = () => {
    sidebar.classList.toggle('open');
    overlayEl.classList.toggle('active');
  };

  toggleBtn.addEventListener('click', toggleMenu);
  overlayEl.addEventListener('click', toggleMenu);
};
