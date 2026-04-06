import { NextResponse } from "next/server";
import { z } from "zod";

import { getStripeCheckoutAppUrl, getValidatedStripePriceIds } from "@/lib/stripe/config";
import { getStripe } from "@/lib/stripe/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const checkoutBodySchema = z.object({
  plan: z.enum(["monthly", "annual"]),
});

export const dynamic = "force-dynamic";

export const POST = async (request: Request) => {
  let bodyJson: unknown;
  try {
    bodyJson = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = checkoutBodySchema.safeParse(bodyJson);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid body: plan must be monthly or annual." },
      { status: 400 },
    );
  }

  const { plan } = parsed.data;

  const supabase = createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user == null) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const email = user.email?.trim();
  if (email == null || email.length === 0 || email.length > 320) {
    return NextResponse.json(
      { error: "Account email is required for checkout." },
      { status: 400 },
    );
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, stripe_customer_id")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError != null) {
    return NextResponse.json(
      { error: "Could not load billing profile." },
      { status: 500 },
    );
  }

  if (profile == null) {
    return NextResponse.json(
      { error: "Billing profile is missing. Contact support." },
      { status: 409 },
    );
  }

  let appUrl: string;
  let priceIds: { monthly: string; annual: string };
  try {
    appUrl = getStripeCheckoutAppUrl();
    priceIds = getValidatedStripePriceIds();
  } catch (e) {
    const message = e instanceof Error ? e.message : "Configuration error.";
    return NextResponse.json({ error: message }, { status: 500 });
  }

  const stripe = getStripe();
  const priceId = plan === "monthly" ? priceIds.monthly : priceIds.annual;

  let customerId = profile.stripe_customer_id?.trim() ?? null;
  if (customerId == null || customerId.length === 0) {
    const customer = await stripe.customers.create({
      email,
      metadata: { supabase_user_id: user.id },
    });
    customerId = customer.id;

    const { error: updateCustomerError } = await supabase
      .from("profiles")
      .update({ stripe_customer_id: customerId })
      .eq("id", user.id);

    if (updateCustomerError != null) {
      return NextResponse.json(
        { error: "Could not save Stripe customer." },
        { status: 500 },
      );
    }
  }

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    line_items: [{ price: priceId, quantity: 1 }],
    client_reference_id: user.id,
    success_url: `${appUrl}/dashboard?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${appUrl}/subscribe`,
    metadata: {
      supabase_user_id: user.id,
      plan,
    },
    subscription_data: {
      metadata: {
        supabase_user_id: user.id,
        plan,
      },
    },
  });

  if (session.url == null) {
    return NextResponse.json(
      { error: "Checkout session URL was not returned." },
      { status: 500 },
    );
  }

  return NextResponse.json({ url: session.url });
};
