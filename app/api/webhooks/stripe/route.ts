import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { z } from "zod";

import { getValidatedStripeWebhookSecret } from "@/lib/stripe/config";
import { getStripe } from "@/lib/stripe/server";
import { createServiceRoleSupabaseClient } from "@/lib/supabase/service-role";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const PLAN_VALUES = new Set(["monthly", "annual"]);

const uuidSchema = z.string().uuid();

const stripeObjectId = (
  value: string | { id: string } | null | undefined,
): string | null => {
  if (value == null) {
    return null;
  }
  return typeof value === "string" ? value : value.id;
};

const parsePlan = (
  value: string | null | undefined,
): "monthly" | "annual" | null => {
  if (value == null || value.trim().length === 0) {
    return null;
  }
  const p = value.trim();
  if (PLAN_VALUES.has(p)) {
    return p as "monthly" | "annual";
  }
  return null;
};

/** Prefer client_reference_id; fall back to Checkout Session metadata. */
const parseSupabaseUserId = (
  clientReferenceId: string | null | undefined,
  metadataUserId: string | null | undefined,
): string | null => {
  const fromRef = clientReferenceId?.trim() ?? "";
  if (fromRef.length > 0 && uuidSchema.safeParse(fromRef).success) {
    return fromRef;
  }
  const fromMeta = metadataUserId?.trim() ?? "";
  if (fromMeta.length > 0 && uuidSchema.safeParse(fromMeta).success) {
    return fromMeta;
  }
  return null;
};

const applyActiveSubscriptionToProfile = async (params: {
  supabaseUserId: string | null;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string;
  plan: "monthly" | "annual" | null;
}) => {
  const supabase = createServiceRoleSupabaseClient();

  const updatePayload: Record<string, string> = {
    stripe_subscription_id: params.stripeSubscriptionId,
    subscription_status: "active",
  };

  if (params.stripeCustomerId != null) {
    updatePayload.stripe_customer_id = params.stripeCustomerId;
  }
  if (params.plan != null) {
    updatePayload.subscription_plan = params.plan;
  }

  if (params.supabaseUserId != null) {
    const { error } = await supabase
      .from("profiles")
      .update(updatePayload)
      .eq("id", params.supabaseUserId);

    if (error != null) {
      console.error(
        "Stripe webhook: profile update by user id failed",
        error.message,
      );
    }
    return;
  }

  if (params.stripeCustomerId != null) {
    const { error } = await supabase
      .from("profiles")
      .update(updatePayload)
      .eq("stripe_customer_id", params.stripeCustomerId);

    if (error != null) {
      console.error(
        "Stripe webhook: profile update by customer id failed",
        error.message,
      );
    }
  } else {
    console.error(
      "Stripe webhook: cannot update profile — missing supabase user id and customer id",
    );
  }
};

const handleCheckoutSessionCompleted = async (
  session: Stripe.Checkout.Session,
  stripe: Stripe,
) => {
  const userId = parseSupabaseUserId(
    session.client_reference_id,
    session.metadata?.supabase_user_id,
  );

  let subscriptionId = stripeObjectId(session.subscription);
  if (subscriptionId == null && session.id != null && session.id.length > 0) {
    try {
      const full = await stripe.checkout.sessions.retrieve(session.id, {
        expand: ["subscription"],
      });
      subscriptionId = stripeObjectId(full.subscription);
    } catch (err) {
      console.error(
        "Stripe webhook: retrieve checkout session for subscription failed",
        err,
      );
    }
  }

  if (subscriptionId == null) {
    console.error(
      "Stripe webhook: checkout.session.completed still has no subscription id; waiting for customer.subscription.created",
      { sessionId: session.id },
    );
    return;
  }

  if (userId == null) {
    console.error(
      "Stripe webhook: checkout.session.completed missing user id in client_reference_id or metadata",
      { sessionId: session.id },
    );
    return;
  }

  const customerId = stripeObjectId(session.customer);
  const plan = parsePlan(session.metadata?.plan);

  await applyActiveSubscriptionToProfile({
    supabaseUserId: userId,
    stripeCustomerId: customerId,
    stripeSubscriptionId: subscriptionId,
    plan,
  });
};

const subscriptionShouldActivateProfile = (status: Stripe.Subscription.Status) =>
  status === "active" || status === "trialing";

const handleCustomerSubscriptionWrite = async (
  subscription: Stripe.Subscription,
) => {
  if (!subscriptionShouldActivateProfile(subscription.status)) {
    return;
  }

  const userId = parseSupabaseUserId(
    null,
    subscription.metadata?.supabase_user_id,
  );
  const customerId = stripeObjectId(subscription.customer);
  const plan = parsePlan(subscription.metadata?.plan);

  await applyActiveSubscriptionToProfile({
    supabaseUserId: userId,
    stripeCustomerId: customerId,
    stripeSubscriptionId: subscription.id,
    plan,
  });
};

const handleSubscriptionDeleted = async (subscription: Stripe.Subscription) => {
  const supabase = createServiceRoleSupabaseClient();
  const { error } = await supabase
    .from("profiles")
    .update({ subscription_status: "cancelled" })
    .eq("stripe_subscription_id", subscription.id);

  if (error != null) {
    console.error(
      "Stripe webhook: subscription deleted update failed",
      error.message,
    );
  }
};

const invoiceSubscriptionId = (invoice: Stripe.Invoice): string | null => {
  const parent = invoice.parent;
  if (parent == null || parent.type !== "subscription_details") {
    return null;
  }
  const sub = parent.subscription_details?.subscription;
  return stripeObjectId(sub);
};

const handleInvoicePaymentFailed = async (invoice: Stripe.Invoice) => {
  const customerId = stripeObjectId(invoice.customer);
  if (customerId == null) {
    return;
  }

  const subscriptionId = invoiceSubscriptionId(invoice);

  const supabase = createServiceRoleSupabaseClient();

  const base = supabase
    .from("profiles")
    .update({ subscription_status: "past_due" })
    .eq("stripe_customer_id", customerId);

  const { error } =
    subscriptionId != null
      ? await base.eq("stripe_subscription_id", subscriptionId)
      : await base;

  if (error != null) {
    console.error(
      "Stripe webhook: invoice payment_failed update failed",
      error.message,
    );
  }
};

export const POST = async (request: Request) => {
  let webhookSecret: string;
  try {
    webhookSecret = getValidatedStripeWebhookSecret();
  } catch (e) {
    const message = e instanceof Error ? e.message : "Configuration error.";
    return NextResponse.json({ error: message }, { status: 500 });
  }

  const signature = request.headers.get("stripe-signature");
  if (signature == null || signature.length === 0 || signature.length > 4096) {
    return NextResponse.json({ error: "Missing signature." }, { status: 400 });
  }

  let rawBody: string;
  try {
    rawBody = await request.text();
  } catch {
    return NextResponse.json({ error: "Invalid body." }, { status: 400 });
  }

  if (rawBody.length > 2_000_000) {
    return NextResponse.json({ error: "Body too large." }, { status: 413 });
  }

  const stripe = getStripe();
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Invalid signature.";
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        await handleCheckoutSessionCompleted(session, stripe);
        break;
      }
      case "customer.subscription.created":
      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;
        await handleCustomerSubscriptionWrite(subscription);
        break;
      }
      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionDeleted(subscription);
        break;
      }
      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        await handleInvoicePaymentFailed(invoice);
        break;
      }
      default:
        break;
    }
  } catch (err) {
    console.error("Stripe webhook handler error", err);
    return NextResponse.json({ error: "Handler error." }, { status: 500 });
  }

  return NextResponse.json({ received: true });
};
