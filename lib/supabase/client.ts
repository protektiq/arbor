"use client";

import { createBrowserClient } from "@supabase/auth-helpers-nextjs";

import { getValidatedPublicSupabaseConfig } from "./config";
import type { Database } from "./database.types";

/**
 * Browser Supabase client for Client Components.
 * Uses @supabase/auth-helpers-nextjs v0.15 (createBrowserClient); this replaces
 * the legacy createClientComponentClient API from older auth-helpers versions.
 */
export const createBrowserSupabaseClient = () => {
  const { url, anonKey } = getValidatedPublicSupabaseConfig();
  return createBrowserClient<Database>(url, anonKey);
};
