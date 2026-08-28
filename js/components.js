/* ======================================
   COMPONENT LOADER
====================================== */

/* ======================================
   FOOTER LOADER
====================================== */
export const loadFooter = async () => {
  const footerContainer = document.getElementById('footer-container');
  if (!footerContainer) return;

  try {
    const response = await fetch('footer.html');
    if (!response.ok) throw new Error(`Failed to load footer component: ${response.statusText}`);
    const html = await response.text();
    footerContainer.innerHTML = html;
  } catch (error) {
    console.error('Footer Initialization Error:', error);
  }
};

document.addEventListener('DOMContentLoaded', () => {
  loadFooter();
});