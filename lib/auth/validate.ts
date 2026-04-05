const EMAIL_MAX_LENGTH = 254;
const BAR_NUMBER_MAX_LENGTH = 64;
const PASSWORD_MIN_LENGTH = 12;
const PASSWORD_MAX_LENGTH = 256;
const TOTP_CODE_LENGTH = 6;

const EMAIL_PATTERN =
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const validateEmail = (
  raw: string,
): { ok: true; value: string } | { ok: false; message: string } => {
  const trimmed = raw.trim();
  if (trimmed.length === 0) {
    return { ok: false, message: "Email is required." };
  }
  if (trimmed.length > EMAIL_MAX_LENGTH) {
    return { ok: false, message: "Email is too long." };
  }
  if (!EMAIL_PATTERN.test(trimmed)) {
    return { ok: false, message: "Enter a valid email address." };
  }
  return { ok: true, value: trimmed };
};

export const validatePassword = (
  raw: string,
): { ok: true; value: string } | { ok: false; message: string } => {
  if (raw.length < PASSWORD_MIN_LENGTH) {
    return {
      ok: false,
      message: `Password must be at least ${PASSWORD_MIN_LENGTH} characters.`,
    };
  }
  if (raw.length > PASSWORD_MAX_LENGTH) {
    return { ok: false, message: "Password is too long." };
  }
  return { ok: true, value: raw };
};

export const validateBarNumber = (
  raw: string,
): { ok: true; value: string } | { ok: false; message: string } => {
  const trimmed = raw.trim();
  if (trimmed.length === 0) {
    return { ok: false, message: "Bar number is required." };
  }
  if (trimmed.length > BAR_NUMBER_MAX_LENGTH) {
    return { ok: false, message: "Bar number is too long." };
  }
  return { ok: true, value: trimmed };
};

export const validateTotpCode = (
  raw: string,
): { ok: true; value: string } | { ok: false; message: string } => {
  const digits = raw.replace(/\s/g, "");
  if (!/^\d+$/.test(digits)) {
    return { ok: false, message: "Enter the 6-digit code from your app." };
  }
  if (digits.length !== TOTP_CODE_LENGTH) {
    return { ok: false, message: "The code must be 6 digits." };
  }
  return { ok: true, value: digits };
};
