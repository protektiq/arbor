import { getValidatedPublicAppUrl } from "@/lib/supabase/config";

const MAX_STRIPE_KEY_LENGTH = 512;
const MIN_STRIPE_SECRET_PREFIX = "sk_";
const MIN_WEBHOOK_SECRET_PREFIX = "whsec_";
const STRIPE_PRICE_ID_PREFIX = "price_";
const MAX_PRICE_ID_LENGTH = 256;

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0;

export const getValidatedStripeSecretKey = (): string => {
  const raw = process.env.STRIPE_SECRET_KEY;
  if (
    !isNonEmptyString(raw) ||
    raw.length > MAX_STRIPE_KEY_LENGTH ||
    !raw.trim().startsWith(MIN_STRIPE_SECRET_PREFIX)
  ) {
    throw new Error(
      "STRIPE_SECRET_KEY must be a non-empty Stripe secret key (sk_…).",
    );
  }
  return raw.trim();
};

export const getValidatedStripeWebhookSecret = (): string => {
  const raw = process.env.STRIPE_WEBHOOK_SECRET;
  if (
    !isNonEmptyString(raw) ||
    raw.length > MAX_STRIPE_KEY_LENGTH ||
    !raw.trim().startsWith(MIN_WEBHOOK_SECRET_PREFIX)
  ) {
    throw new Error(
      "STRIPE_WEBHOOK_SECRET must be a non-empty webhook signing secret (whsec_…).",
    );
  }
  return raw.trim();
};

const validatePriceId = (value: string, name: string): string => {
  const trimmed = value.trim();
  if (
    trimmed.length === 0 ||
    trimmed.length > MAX_PRICE_ID_LENGTH ||
    !trimmed.startsWith(STRIPE_PRICE_ID_PREFIX)
  ) {
    throw new Error(`${name} must be a valid Stripe Price id (price_…).`);
  }
  return trimmed;
};

export type StripePriceIds = {
  monthly: string;
  annual: string;
};

export const getValidatedStripePriceIds = (): StripePriceIds => {
  const monthlyRaw = process.env.STRIPE_PRICE_ID_MONTHLY;
  const annualRaw = process.env.STRIPE_PRICE_ID_ANNUAL;
  if (!isNonEmptyString(monthlyRaw) || !isNonEmptyString(annualRaw)) {
    throw new Error(
      "STRIPE_PRICE_ID_MONTHLY and STRIPE_PRICE_ID_ANNUAL must be set.",
    );
  }
  return {
    monthly: validatePriceId(monthlyRaw, "STRIPE_PRICE_ID_MONTHLY"),
    annual: validatePriceId(annualRaw, "STRIPE_PRICE_ID_ANNUAL"),
  };
};

export const getStripeCheckoutAppUrl = (): string => getValidatedPublicAppUrl();
