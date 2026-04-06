import { NextResponse } from "next/server";
import { z } from "zod";

import { requireSubscribedUser } from "@/lib/auth/require-subscribed-user";

export const dynamic = "force-dynamic";

const createCaseBodySchema = z.object({
  case_code: z
    .string()
    .trim()
    .min(1, "Case code is required.")
    .max(256, "Case code is too long."),
  jurisdiction: z.enum([
    "California",
    "Texas",
    "Florida",
    "New York",
    "Illinois",
  ]),
});

export const POST = async (request: Request) => {
  const auth = await requireSubscribedUser();
  if (!auth.ok) {
    return auth.response;
  }
  const { user, supabase } = auth;

  let bodyJson: unknown;
  try {
    bodyJson = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = createCaseBodySchema.safeParse(bodyJson);
  if (!parsed.success) {
    const first = parsed.error.flatten().fieldErrors;
    const msg =
      first.case_code?.[0] ??
      first.jurisdiction?.[0] ??
      "Invalid request body.";
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  const { case_code, jurisdiction } = parsed.data;

  const { data: row, error: insertError } = await supabase
    .from("cases")
    .insert({
      attorney_id: user.id,
      case_code,
      jurisdiction,
      status: "pending",
    })
    .select("id")
    .single();

  if (insertError != null || row == null) {
    return NextResponse.json(
      { error: "Could not create case." },
      { status: 500 },
    );
  }

  return NextResponse.json({ id: row.id });
};
