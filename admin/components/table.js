/**
 * Reusable Data Table Component
 * admin/components/table.js
 */

export const renderTable = (containerId, columns, data, rowRenderCallback, emptyMessage = "No data found.") => {
  const container = document.getElementById(containerId);
  if (!container) return;

  if (!data || data.length === 0) {
    container.innerHTML = `
      <div class="admin-empty">
        <i class="fa-solid fa-folder-open admin-empty__icon"></i>
        <h3 class="admin-empty__title">Nothing to show</h3>
        <p class="admin-empty__desc">${emptyMessage}</p>
      </div>
    `;
    return;
  }

  const thHtml = columns.map(col => `<th>${col}</th>`).join('');
  const rowsHtml = data.map(item => `<tr>${rowRenderCallback(item)}</tr>`).join('');

  container.innerHTML = `
    <div class="admin-table-wrap">
      <table class="admin-table">
        <thead>
          <tr>${thHtml}</tr>
        </thead>
        <tbody>
          ${rowsHtml}
        </tbody>
      </table>
    </div>
  `;
};
