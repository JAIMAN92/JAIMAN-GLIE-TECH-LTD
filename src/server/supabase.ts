import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let cachedSupabaseAdmin: SupabaseClient | null | undefined;

export function normalizeSupabaseProjectUrl(rawUrl?: string): string {
  const trimmed = (rawUrl || '').trim();
  if (!trimmed) return '';
  return trimmed.replace(/\/rest\/v1\/?$/i, '').replace(/\/+$/, '');
}

export function getSupabaseAdmin(): SupabaseClient | null {
  if (cachedSupabaseAdmin !== undefined) {
    return cachedSupabaseAdmin;
  }

  const supabaseUrl = normalizeSupabaseProjectUrl(process.env.SUPABASE_URL);
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || '';

  if (!supabaseUrl || !serviceRoleKey) {
    cachedSupabaseAdmin = null;
    return null;
  }

  cachedSupabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  return cachedSupabaseAdmin;
}
