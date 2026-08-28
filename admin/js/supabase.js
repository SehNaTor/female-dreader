import { createClient } from 'https://esm.sh/@supabase/supabase-js';

const supabaseUrl = 'https://xbmxjxraazstexdcbtqj.supabase.co';
const supabaseKey = 'sb_publishable__dXZFoh1Sh0ArKANQo3I8A_rfF2c6Ks';

export const supabase = createClient(supabaseUrl, supabaseKey);
