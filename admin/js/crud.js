import { supabase } from './supabase.js';
import { Toast } from '../components/toast.js';

/**
 * Reusable deletion pipeline with structured debugging
 * @param {string} table - The Supabase table name
 * @param {string|number} id - The primary key value
 * @param {Function} refreshCallback - Callback to refresh the UI
 * @param {string} primaryKey - The primary key column name (default 'id')
 */
export const executeDelete = async (table, id, refreshCallback, primaryKey = 'id') => {
  // STEP 1: Log the exact ID before deletion
  console.group(`[DEBUG] Deleting from ${table}`);
  console.log(`Original ID received:`, id);
  console.log(`Type of received ID:`, typeof id);

  // STEP 4: Convert ID to Number if it's a numeric string, otherwise keep as string (UUID)
  const parsedId = (typeof id === 'string' && id.trim() !== '' && !isNaN(id)) ? Number(id) : id;
  console.log(`Parsed ID for Supabase:`, parsedId);
  console.log(`Type of parsed ID:`, typeof parsedId);

  // STEP 3: Verify Query structure
  console.log(`Query execution: supabase.from('${table}').delete().eq('${primaryKey}', ${parsedId}).select()`);

  try {
    // STEP 7: Log full Supabase response
    const response = await supabase
      .from(table)
      .delete()
      .eq(primaryKey, parsedId)
      .select();

    console.log(`[DEBUG] Supabase Response:`, response);

    const { data, error, status, statusText } = response;

    if (error) {
      console.error(`[DEBUG] Supabase Error:`, error);
      throw error;
    }

    if (!data || data.length === 0) {
      console.error(`[DEBUG] Zero rows affected. Record may not exist, primary key mismatch, or RLS blocked the operation.`);
      throw new Error(`Deletion failed. Record may not exist or permission denied.`);
    }

    console.log(`[DEBUG] Rows affected:`, data.length);
    console.log(`[DEBUG] Deleted record:`, data[0]);

    // STEP 8: Trigger UI Re-render
    if (typeof refreshCallback === 'function') {
      console.log(`[DEBUG] Triggering UI Refresh...`);
      await refreshCallback();
    }

    Toast.show('Record deleted successfully.', 'info');
  } catch (err) {
    console.error(`[DEBUG] Exception caught:`, err);
    Toast.show(err.message || 'Failed to delete record.', 'error');
  } finally {
    console.groupEnd();
  }
};
