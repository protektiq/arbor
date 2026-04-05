/**
 * Validates Supabase public URL and anon key before client creation.
 * Keeps bounds tight to reduce misuse of env values as unstructured blobs.
 */
const MAX_SUPABASE_URL_LENGTH = 2048;
const MIN_ANON_KEY_LENGTH = 32;
const MAX_ANON_KEY_LENGTH = 4096;

export type PublicSupabaseConfig = {
  url: string;
  anonKey: string;
};

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0;

/**
 * Reads and validates NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.
 * Call from browser or server; throws if invalid.
 */
export const getValidatedPublicSupabaseConfig = (): PublicSupabaseConfig => {
  const urlRaw = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKeyRaw = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!isNonEmptyString(urlRaw) || urlRaw.length > MAX_SUPABASE_URL_LENGTH) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL must be a non-empty string within length limits.",
    );
  }

  if (
    !isNonEmptyString(anonKeyRaw) ||
    anonKeyRaw.length < MIN_ANON_KEY_LENGTH ||
    anonKeyRaw.length > MAX_ANON_KEY_LENGTH
  ) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_ANON_KEY must be a non-empty string within length limits.",
    );
  }

  const url = urlRaw.trim();

  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
      throw new Error("Invalid URL protocol");
    }
  } catch {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL must be a valid http(s) URL.");
  }

  return { url, anonKey: anonKeyRaw.trim() };
};

const MAX_APP_URL_LENGTH = 2048;

/**
 * Base URL for email confirmation redirects (no trailing slash).
 * Uses NEXT_PUBLIC_APP_URL; required for signUp emailRedirectTo.
 */
export const getValidatedPublicAppUrl = (): string => {
  const raw = process.env.NEXT_PUBLIC_APP_URL;
  if (!isNonEmptyString(raw) || raw.length > MAX_APP_URL_LENGTH) {
    throw new Error(
      "NEXT_PUBLIC_APP_URL must be a non-empty string within length limits.",
    );
  }
  const trimmed = raw.trim().replace(/\/+$/, "");
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
      throw new Error("Invalid URL protocol");
    }
  } catch {
    throw new Error("NEXT_PUBLIC_APP_URL must be a valid http(s) URL.");
  }
  return trimmed;
};

/**
 * Storage RLS expects object keys `{case_id}/{rest}` inside buckets `raw-uploads`
 * and `analysis-outputs`, where `case_id` is the UUID of a case owned by the
 * signed-in attorney. Use the same convention for `exports.file_path` (path
 * within the bucket or full logical path, consistently).
 */
export const SUPABASE_CASE_STORAGE_BUCKETS = [
  "raw-uploads",
  "analysis-outputs",
] as const;
