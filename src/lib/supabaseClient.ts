import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

// A missing env var (e.g. forgotten in Vercel's project settings) used to
// throw right here, at module-import time — which happens before React
// even mounts, producing a blank white page with nothing but a console
// error. Instead, record the problem and still construct a client (with
// placeholder values so createClient() itself can't throw either); every
// real call site already wraps its Supabase calls in try/catch (see
// AuthContext.initialize, repository.ts), so this surfaces as the app's
// normal error/retry screen instead of a blank page.
export const supabaseConfigError = !url || !anonKey
  ? 'Missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY. In Vercel: Project Settings → Environment Variables. Locally: copy .env.example to .env and fill in your project values.'
  : null;

export const supabase: SupabaseClient = createClient(url || 'https://placeholder.invalid', anonKey || 'placeholder-anon-key', {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
});

export const DOCUMENTS_BUCKET = 'activity-documents';
