import { createClient } from '@supabase/supabase-js';

/**
 * Supabase service client used for privileged operations.
 *
 * The service role key should only be used on the server side. It is
 * automatically picked up from the `SUPABASE_SERVICE_ROLE_KEY` environment
 * variable. If you need a public client you can create it here as well.
 */
const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;

if (!SUPABASE_URL) {
  console.warn('SUPABASE_URL is not defined. Supabase client will not work properly.');
}
if (!SUPABASE_SERVICE_ROLE_KEY) {
  console.warn('SUPABASE_SERVICE_ROLE_KEY is not defined. Inserts into Supabase will likely fail.');
}

export const supabaseService = createClient(
  SUPABASE_URL || '',
  SUPABASE_SERVICE_ROLE_KEY || '',
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  },
);
