import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getConfig } from "../config/env";

/**
 * A per-request Supabase client bound to the request cookies. Used only for
 * Supabase Auth (sign-in, session, sign-out); application data is read and
 * written through the server-side repositories.
 */
export async function createSupabaseServerClient() {
  const supabase = getConfig().auth.supabase;
  if (!supabase) return null;
  const store = await cookies();
  return createServerClient(supabase.url, supabase.anonKey, {
    cookies: {
      getAll() {
        return store.getAll();
      },
      setAll(toSet) {
        try {
          for (const { name, value, options } of toSet) store.set(name, value, options);
        } catch {
          // Called from a Server Component render where cookies are read-only;
          // the proxy refreshes the session on the next request.
        }
      },
    },
  });
}
