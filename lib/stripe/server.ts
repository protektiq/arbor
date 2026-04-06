import Stripe from "stripe";

import { getValidatedStripeSecretKey } from "./config";

let stripeSingleton: Stripe | null = null;

export const getStripe = (): Stripe => {
  if (stripeSingleton == null) {
    stripeSingleton = new Stripe(getValidatedStripeSecretKey(), {
      typescript: true,
    });
  }
  return stripeSingleton;
};
