/**
 * Server-only Supabase admin client (service role).
 *
 * WHY THIS EXISTS
 *   The live project enforces Row Level Security: `reports` inserts require an
 *   authenticated citizen session (reporter_id = auth.uid()). The SafeZone demo
 *   has no login screen — the active persona is a server-side choice — so API
 *   routes perform writes through this client, which bypasses RLS.
 *
 * BOUNDARIES
 *   - This module must ONLY be imported from server code (route handlers,
 *     server components, scripts). It reads SUPABASE_SERVICE_ROLE_KEY, which
 *     has no NEXT_PUBLIC_ prefix and is therefore never bundled for the client.
 *   - It is also used to join profile emails from auth.users for the persona
 *     switcher (emails live in auth, not in the public profiles table).
 *
 * If the service key is absent, this resolves to null and the app degrades to
 * read-only live mode + the in-memory demo overlay for writes.
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export const supabaseAdmin: SupabaseClient | null =
  url && serviceKey
    ? createClient(url, serviceKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      })
    : null;

/** Map of auth user id → email (best-effort, for the persona switcher). */
export async function fetchAuthUserEmails(): Promise<Map<string, string>> {
  const emails = new Map<string, string>();
  if (!supabaseAdmin) return emails;
  try {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({
      page: 1,
      perPage: 1000,
    });
    if (error) return emails;
    for (const user of data?.users ?? []) {
      if (user.email) emails.set(user.id, user.email);
    }
  } catch {
    // Non-fatal: personas fall back to role-based display.
  }
  return emails;
}

let incidentsDepartmentCache: boolean | null = null;

/**
 * Does the live `incidents` table have the v2 `department` column yet?
 * Probed once per process — until supabase/migration_departments.sql has been
 * run, writes simply omit the column and reads derive it from the category.
 */
export async function incidentsHaveDepartment(): Promise<boolean> {
  if (!supabaseAdmin) return false;
  if (incidentsDepartmentCache !== null) return incidentsDepartmentCache;
  try {
    const { error } = await supabaseAdmin.from("incidents").select("department").limit(1);
    incidentsDepartmentCache = !error;
  } catch {
    incidentsDepartmentCache = false;
  }
  return incidentsDepartmentCache;
}
