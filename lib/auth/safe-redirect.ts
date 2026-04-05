/**
 * Open-redirect hardening for post-login ?redirectTo= and similar.
 * Only same-app relative paths are allowed.
 */
const MAX_REDIRECT_LENGTH = 2048;

export const parseSafeRedirectPath = (
  raw: string | null | undefined,
): string | null => {
  if (raw == null) {
    return null;
  }
  const trimmed = raw.trim();
  if (trimmed === "" || trimmed.length > MAX_REDIRECT_LENGTH) {
    return null;
  }
  if (!trimmed.startsWith("/")) {
    return null;
  }
  if (trimmed.startsWith("//")) {
    return null;
  }
  if (trimmed.includes("\\")) {
    return null;
  }
  if (trimmed.includes("@")) {
    return null;
  }
  return trimmed;
};
