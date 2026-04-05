import { createServerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";

import { getValidatedPublicSupabaseConfig } from "./config";
import type { Database } from "./database.types";

/**
 * Server Supabase client for Server Components and server-only code.
 * Uses createServerClient with Next.js cookies (v0.15 auth-helpers; replaces
 * legacy createServerComponentClient).
 */
export const createServerSupabaseClient = () => {
  const { url, anonKey } = getValidatedPublicSupabaseConfig();
  const cookieStore = cookies();

  return createServerClient<Database>(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // Called from a Server Component with read-only cookies; session refresh
          // should run in middleware or a Route Handler when mutations occur.
        }
      },
    },
  });
};
