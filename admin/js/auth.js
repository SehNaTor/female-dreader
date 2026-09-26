import { supabase } from './supabase.js';

const resolveAdminPage = (page) => window.location.pathname.includes('/admin/')
  ? `../${page}`
  : page;

/**
 * Handles Authentication for the Admin Dashboard.
 */

// --- Authentication Guarding ---
export const requireAuth = async () => {
  const { data: { session }, error } = await supabase.auth.getSession();
  
  if (error || !session) {
    window.location.replace(resolveAdminPage('login.html'));
    return null;
  }
  
  // Optionally, we could verify if the user has an admin role here if using RBAC
  return session.user;
};

export const redirectIfAuthenticated = async () => {
  const { data: { session } } = await supabase.auth.getSession();
  if (session) {
    window.location.replace(resolveAdminPage('dashboard.html'));
  }
};

export const logout = async () => {
  await supabase.auth.signOut();
  window.location.replace(resolveAdminPage('login.html'));
};


// --- Login Page Logic ---
const initLoginForm = () => {
  const loginForm = document.getElementById('login-form');
  if (!loginForm) return; // Not on the login page

  redirectIfAuthenticated(); // If already logged in, skip login page

  const emailInput = document.getElementById('email');
  const passwordInput = document.getElementById('password');
  const submitBtn = document.getElementById('submit-btn');
  const togglePasswordBtn = document.getElementById('toggle-password');
  const alertBox = document.getElementById('login-alert');
  const alertText = document.getElementById('login-alert-text');

  // Toggle password visibility
  if (togglePasswordBtn) {
    togglePasswordBtn.addEventListener('click', () => {
      const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
      passwordInput.setAttribute('type', type);
      togglePasswordBtn.innerHTML = type === 'password' 
        ? '<i class="fa-regular fa-eye"></i>' 
        : '<i class="fa-regular fa-eye-slash"></i>';
    });
  }

  // Clear errors on input
  const clearError = (inputEl, groupEl) => {
    inputEl.classList.remove('has-error');
    groupEl.classList.remove('error');
    alertBox.classList.remove('error');
  };

  emailInput.addEventListener('input', () => clearError(emailInput, document.getElementById('email-group')));
  passwordInput.addEventListener('input', () => clearError(passwordInput, document.getElementById('password-group')));

  // Form submission
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    let hasError = false;
    const email = emailInput.value.trim();
    const password = passwordInput.value;

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      document.getElementById('email-group').classList.add('error');
      emailInput.classList.add('has-error');
      hasError = true;
    }

    if (!password) {
      document.getElementById('password-group').classList.add('error');
      passwordInput.classList.add('has-error');
      hasError = true;
    }

    if (hasError) return;

    // Loading State
    submitBtn.classList.add('loading');
    submitBtn.disabled = true;
    alertBox.classList.remove('error');

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      if (error) throw error;

      // Success - Redirect
      window.location.replace(resolveAdminPage('dashboard.html'));

    } catch (err) {
      console.error('Login error:', err);
      alertBox.classList.add('error');
      alertText.textContent = err.message || 'Invalid email or password.';
    } finally {
      submitBtn.classList.remove('loading');
      submitBtn.disabled = false;
    }
  });
};

// Initialize if DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initLoginForm);
} else {
  initLoginForm();
}
