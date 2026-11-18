import "server-only";
import { createClient } from "@supabase/supabase-js";
import { getConfig } from "../config/env";
import { log } from "../observability/log";

/**
 * Remove a Supabase Auth user after their application account is deleted.
 * Requires the optional server-only SUPABASE_SERVICE_ROLE_KEY. Returns false
 * (and the caller tells the learner) when that is not configured or fails.
 */
export async function deleteSupabaseAuthUser(userId: string): Promise<boolean> {
  const config = getConfig();
  const supabase = config.auth.supabase;
  const key = config.auth.supabaseServiceRoleKey;
  if (!supabase || !key) return false;
  const admin = createClient(supabase.url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const { error } = await admin.auth.admin.deleteUser(userId);
  if (error) {
    log.warn("auth.delete_user_failed", { status: error.status ?? null });
    return false;
  }
  return true;
}
