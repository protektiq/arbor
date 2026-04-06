import { createClient } from "@supabase/supabase-js";

import { getValidatedPublicSupabaseConfig } from "./config";
import type { Database } from "./database.types";

const MIN_SERVICE_ROLE_KEY_LENGTH = 32;
const MAX_SERVICE_ROLE_KEY_LENGTH = 4096;

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0;

const getValidatedServiceRoleKey = (): string => {
  const raw = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (
    !isNonEmptyString(raw) ||
    raw.length < MIN_SERVICE_ROLE_KEY_LENGTH ||
    raw.length > MAX_SERVICE_ROLE_KEY_LENGTH
  ) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY must be a non-empty string within length limits.",
    );
  }
  return raw.trim();
};

/**
 * Server-only client that bypasses RLS. Use only in trusted Route Handlers (e.g. Stripe webhooks).
 */
export const createServiceRoleSupabaseClient = () => {
  const { url } = getValidatedPublicSupabaseConfig();
  const serviceRoleKey = getValidatedServiceRoleKey();
  return createClient<Database>(url, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
};
