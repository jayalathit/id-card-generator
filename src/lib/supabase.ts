import { createClient } from '@supabase/supabase-js';

// Supabase project URLs and publishable keys are safe to expose in browser apps.
// RLS policies in the migration protect the actual data and storage objects.
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://rnhbmpnwypgpnyxqijky.supabase.co';
const supabasePublishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_BdhicSpQpnISdX5PSlETBg_feI1hMI2';

export const ASSET_BUCKET = 'student-assets';
export const supabase = createClient(supabaseUrl, supabasePublishableKey);
