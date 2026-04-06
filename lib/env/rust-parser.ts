const MIN_RUST_PARSER_URL_LENGTH = 8;
const MAX_RUST_PARSER_URL_LENGTH = 2048;

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0;

/**
 * Validates RUST_PARSER_URL for server-side calls to the parser service.
 * Returns a base URL without a trailing slash.
 */
export const getValidatedRustParserUrl = (): string => {
  const raw = process.env.RUST_PARSER_URL;
  if (!isNonEmptyString(raw) || raw.length > MAX_RUST_PARSER_URL_LENGTH) {
    throw new Error(
      "RUST_PARSER_URL must be a non-empty string within length limits.",
    );
  }
  const trimmed = raw.trim();
  if (trimmed.length < MIN_RUST_PARSER_URL_LENGTH) {
    throw new Error("RUST_PARSER_URL is too short.");
  }
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new Error("RUST_PARSER_URL must be a valid absolute URL.");
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("RUST_PARSER_URL must use http or https.");
  }
  return trimmed.replace(/\/+$/, "");
};
