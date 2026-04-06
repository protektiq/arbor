import { NextResponse } from "next/server";

import { getStripeCheckoutAppUrl } from "@/lib/stripe/config";
import { getStripe } from "@/lib/stripe/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export const POST = async () => {
  const supabase = createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user == null) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("stripe_customer_id")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError != null) {
    return NextResponse.json(
      { error: "Could not load billing profile." },
      { status: 500 },
    );
  }

  const customerId = profile?.stripe_customer_id?.trim();
  if (customerId == null || customerId.length === 0) {
    return NextResponse.json(
      { error: "No Stripe customer on file. Subscribe first." },
      { status: 400 },
    );
  }

  let appUrl: string;
  try {
    appUrl = getStripeCheckoutAppUrl();
  } catch (e) {
    const message = e instanceof Error ? e.message : "Configuration error.";
    return NextResponse.json({ error: message }, { status: 500 });
  }

  const stripe = getStripe();
  const portalSession = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: `${appUrl}/dashboard/settings/billing`,
  });

  if (portalSession.url == null) {
    return NextResponse.json(
      { error: "Portal session URL was not returned." },
      { status: 500 },
    );
  }

  return NextResponse.json({ url: portalSession.url });
};
