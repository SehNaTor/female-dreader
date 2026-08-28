import { requireAuth } from './auth.js';
import { injectLayout } from '../components/layout.js';
import { supabase } from './supabase.js';
import { Toast } from '../components/toast.js';

let currentSettingsId = null;

const initSettings = async () => {
  const user = await requireAuth();
  if (!user) return;

  injectLayout('Business Settings', 'settings');

  await fetchSettings();

  document.getElementById('settings-form').addEventListener('submit', saveSettings);
};

const fetchSettings = async () => {
  try {
    const { data, error } = await supabase
      .from('settings')
      .select('*')
      .limit(1)
      .single();

    if (error && error.code !== 'PGRST116') throw error; // Ignore not found error

    if (data) {
      currentSettingsId = data.id;
      document.getElementById('business_name').value = data.business_name || '';
      document.getElementById('contact_email').value = data.contact_email || '';
      document.getElementById('phone_number').value = data.phone_number || '';
      document.getElementById('whatsapp_number').value = data.whatsapp_number || '';
      document.getElementById('address').value = data.address || '';
      document.getElementById('instagram_url').value = data.instagram_url || '';
      document.getElementById('facebook_url').value = data.facebook_url || '';
    }

    document.getElementById('settings-loader').style.display = 'none';
    document.getElementById('settings-form-wrapper').style.display = 'block';

  } catch (err) {
    console.error('Error fetching settings:', err);
    Toast.show('Failed to load settings.', 'error');
  }
};

const saveSettings = async (e) => {
  e.preventDefault();
  
  const btn = document.getElementById('save-settings-btn');
  const originalText = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Saving...';

  const payload = {
    business_name: document.getElementById('business_name').value.trim(),
    contact_email: document.getElementById('contact_email').value.trim(),
    phone_number: document.getElementById('phone_number').value.trim(),
    whatsapp_number: document.getElementById('whatsapp_number').value.trim(),
    address: document.getElementById('address').value.trim(),
    instagram_url: document.getElementById('instagram_url').value.trim(),
    facebook_url: document.getElementById('facebook_url').value.trim()
  };

  try {
    if (currentSettingsId) {
      const { error } = await supabase.from('settings').update(payload).eq('id', currentSettingsId);
      if (error) throw error;
    } else {
      const { data, error } = await supabase.from('settings').insert([payload]).select();
      if (error) throw error;
      if (data && data.length > 0) currentSettingsId = data[0].id;
    }
    
    Toast.show('Settings saved successfully.', 'success');
  } catch (err) {
    console.error(err);
    Toast.show('Failed to save settings.', 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = originalText;
  }
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initSettings);
} else {
  initSettings();
}
