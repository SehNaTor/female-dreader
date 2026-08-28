import { supabase } from './supabase.js';

export const GalleryService = {
  /**
   * Fetches featured gallery items from Supabase for the homepage carousel.
   * @returns {Promise<Array>} Array of featured gallery items
   */
  async fetchFeaturedTransformations() {
    try {
      if (!supabase) throw new Error('Supabase client not initialized');
      
      const { data, error } = await supabase
        .from('gallery')
        .select('id, title, image_url, category, display_order')
        .eq('active', true)
        .eq('featured', true)
        .order('display_order', { ascending: true });

      if (error) {
        throw error;
      }

      return data || [];
    } catch (err) {
      console.error('[Female Dreader] Error fetching featured transformations:', err);
      throw err;
    }
  }
};
