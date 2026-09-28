/**
 * Supabase client (server-side).
 *
 * Configure via .env.local:
 *   NEXT_PUBLIC_SUPABASE_URL=...
 *   NEXT_PUBLIC_SUPABASE_ANON_KEY=...
 *
 * Without these vars the app transparently falls back to the seeded demo
 * snapshot (src/data/demo-data.json) so the experience always works.
 * When the env vars are present, all reads/writes hit the live project.
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;

export const supabase: SupabaseClient | null =
  url && key
    ? createClient(url, key, {
        auth: { persistSession: false, autoRefreshToken: false },
      })
    : null;

export const isSupabaseConfigured = supabase !== null;
