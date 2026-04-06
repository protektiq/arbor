import { NextResponse } from "next/server";
import { z } from "zod";

import {
  requireSubscribedUser,
  type SubscribedSupabaseClient,
} from "@/lib/auth/require-subscribed-user";
import { getValidatedRustParserUrl } from "@/lib/env/rust-parser";
import type { Json } from "@/lib/supabase/database.types";

export const dynamic = "force-dynamic";

/** Large uploads may exceed default serverless body limits; see DATA_FLOW.md. */
const MAX_FILE_BYTES = 50 * 1024 * 1024;
const MAX_IDENTIFIER_LEN = 256;
const MAX_BASE_NAME_LENGTH = 200;
const INSERT_CHUNK = 500;
const HASH_LOOKUP_CHUNK = 150;

const uuidParamSchema = z.string().uuid();

const fileFormatSchema = z.enum([
  "ofw_pdf",
  "talkingparents_pdf",
  "generic_text",
]);

const senderRoleSchema = z.enum(["parent_a", "parent_b", "unknown"]);
const platformSourceSchema = z.enum([
  "ourfamilywizard",
  "talkingparents",
  "generic",
]);

const parseResponseSchema = z.object({
  records: z.array(
    z.object({
      sent_at: z.string(),
      sender_role: senderRoleSchema,
      body_text: z.string(),
      platform_source: platformSourceSchema,
      raw_hash: z.string().min(1),
    }),
  ),
  total_count: z.number(),
  parse_errors: z.array(z.string()),
  platform_detected: z.string(),
});

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0;

const sanitizeBasename = (name: string): string => {
  const stripped = name.replace(/^.*[/\\]/, "").slice(0, MAX_BASE_NAME_LENGTH);
  const cleaned = stripped.replace(/[^a-zA-Z0-9._-]/g, "_");
  return cleaned.length > 0 ? cleaned : "upload";
};

const isValidSentAt = (raw: string): boolean => {
  const t = Date.parse(raw);
  return !Number.isNaN(t);
};

const chunkArray = <T>(arr: T[], size: number): T[][] => {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    out.push(arr.slice(i, i + size));
  }
  return out;
};

const truncateForLog = (text: string, maxChars: number): string => {
  const t = text.trim();
  if (t.length <= maxChars) {
    return t;
  }
  return `${t.slice(0, maxChars)}…`;
};

type AuditPayload = {
  filename: string;
  messageCount: number;
  errors: string[];
};

const insertAuditLog = async (
  supabase: SubscribedSupabaseClient,
  actorId: string,
  caseId: string,
  payload: AuditPayload,
) => {
  const metadata: Json = {
    filename: payload.filename,
    message_count: payload.messageCount,
    errors: payload.errors,
  };
  await supabase.from("audit_log").insert({
    actor_id: actorId,
    case_id: caseId,
    action_type: "file_uploaded",
    metadata,
  });
};

export const POST = async (
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) => {
  const auth = await requireSubscribedUser();
  if (!auth.ok) {
    return auth.response;
  }
  const { user, supabase } = auth;

  const { id: caseIdRaw } = await params;
  const idParsed = uuidParamSchema.safeParse(caseIdRaw);
  if (!idParsed.success) {
    return NextResponse.json({ error: "Invalid case id." }, { status: 400 });
  }
  const caseId = idParsed.data;

  const { data: caseRow, error: caseError } = await supabase
    .from("cases")
    .select("id, message_count")
    .eq("id", caseId)
    .maybeSingle();

  if (caseError != null) {
    return NextResponse.json(
      { error: "Could not load case." },
      { status: 500 },
    );
  }
  if (caseRow == null) {
    return NextResponse.json({ error: "Case not found." }, { status: 404 });
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json(
      { error: "Invalid multipart form data." },
      { status: 400 },
    );
  }

  const file = form.get("file");
  const parentA = form.get("parent_a_identifier");
  const parentB = form.get("parent_b_identifier");
  const fileFormatRaw = form.get("file_format");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "File is required." }, { status: 400 });
  }

  if (!isNonEmptyString(parentA) || !isNonEmptyString(parentB)) {
    return NextResponse.json(
      { error: "Parent identifiers are required." },
      { status: 400 },
    );
  }

  const parentATrim = parentA.trim();
  const parentBTrim = parentB.trim();
  if (
    parentATrim.length > MAX_IDENTIFIER_LEN ||
    parentBTrim.length > MAX_IDENTIFIER_LEN
  ) {
    return NextResponse.json(
      { error: "Parent identifiers are too long." },
      { status: 400 },
    );
  }

  const formatParsed = fileFormatSchema.safeParse(
    typeof fileFormatRaw === "string" ? fileFormatRaw.trim() : "",
  );
  if (!formatParsed.success) {
    return NextResponse.json(
      { error: "Invalid or missing file_format." },
      { status: 400 },
    );
  }
  const fileFormat = formatParsed.data;

  const nameLower = file.name.toLowerCase();
  const isPdf = nameLower.endsWith(".pdf");
  const isTxt = nameLower.endsWith(".txt");
  const mime = file.type;
  const mimeOk =
    mime === "application/pdf" ||
    mime === "text/plain" ||
    mime === "" ||
    mime === "application/octet-stream";

  if (!mimeOk) {
    return NextResponse.json(
      { error: "Unsupported file type." },
      { status: 400 },
    );
  }

  if (!isPdf && !isTxt) {
    return NextResponse.json(
      { error: "Only .pdf and .txt files are accepted." },
      { status: 400 },
    );
  }

  if (isTxt && fileFormat !== "generic_text") {
    return NextResponse.json(
      { error: "Text files must use generic_text format." },
      { status: 400 },
    );
  }

  if (isPdf && fileFormat === "generic_text") {
    return NextResponse.json(
      { error: "PDF files cannot use generic_text format." },
      { status: 400 },
    );
  }

  if (file.size > MAX_FILE_BYTES) {
    return NextResponse.json(
      { error: "File exceeds 50MB limit." },
      { status: 400 },
    );
  }

  const displayFilename =
    file.name.trim().length > 0 ? file.name.trim() : "upload.bin";
  const audit: AuditPayload = {
    filename: displayFilename,
    messageCount: caseRow.message_count,
    errors: [],
  };

  let rustBaseUrl: string;
  try {
    rustBaseUrl = getValidatedRustParserUrl();
  } catch (e) {
    const msg =
      e instanceof Error ? e.message : "Parser service is not configured.";
    audit.errors.push(msg);
    await insertAuditLog(supabase, user.id, caseId, audit);
    return NextResponse.json(
      {
        success: false,
        error: msg,
        messages_ingested: 0,
        duplicates_skipped: 0,
        errors: audit.errors,
      },
      { status: 503 },
    );
  }

  const objectPath = `${caseId}/${Date.now()}-${sanitizeBasename(file.name)}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  const { error: uploadError } = await supabase.storage
    .from("raw-uploads")
    .upload(objectPath, buffer, {
      contentType:
        mime === "" || mime === "application/octet-stream"
          ? isPdf
            ? "application/pdf"
            : "text/plain"
          : mime,
      upsert: false,
    });

  if (uploadError != null) {
    audit.errors.push(`Storage upload failed: ${uploadError.message}`);
    await insertAuditLog(supabase, user.id, caseId, audit);
    return NextResponse.json(
      {
        success: false,
        messages_ingested: 0,
        duplicates_skipped: 0,
        errors: audit.errors,
      },
      { status: 500 },
    );
  }

  const { error: ingestingError } = await supabase
    .from("cases")
    .update({ status: "ingesting" })
    .eq("id", caseId);

  if (ingestingError != null) {
    audit.errors.push(`Failed to set ingesting status: ${ingestingError.message}`);
    await insertAuditLog(supabase, user.id, caseId, audit);
    return NextResponse.json(
      {
        success: false,
        messages_ingested: 0,
        duplicates_skipped: 0,
        errors: audit.errors,
      },
      { status: 500 },
    );
  }

  const { data: downloaded, error: downloadError } = await supabase.storage
    .from("raw-uploads")
    .download(objectPath);

  if (downloadError != null || downloaded == null) {
    audit.errors.push(
      downloadError != null
        ? `Storage download failed: ${downloadError.message}`
        : "Storage download returned empty.",
    );
    await supabase.from("cases").update({ status: "error" }).eq("id", caseId);
    await insertAuditLog(supabase, user.id, caseId, audit);
    return NextResponse.json(
      {
        success: false,
        messages_ingested: 0,
        duplicates_skipped: 0,
        errors: audit.errors,
      },
      { status: 500 },
    );
  }

  const downloadedBuffer = Buffer.from(await downloaded.arrayBuffer());
  const fileContentBase64 = downloadedBuffer.toString("base64");

  let parseRes: Response;
  try {
    parseRes = await fetch(`${rustBaseUrl}/parse`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        file_content_base64: fileContentBase64,
        file_format: fileFormat,
        parent_a_identifier: parentATrim,
        parent_b_identifier: parentBTrim,
      }),
      signal: AbortSignal.timeout(120_000),
    });
  } catch (e) {
    const msg =
      e instanceof Error ? e.message : "Parser request failed.";
    audit.errors.push(`Parser request failed: ${msg}`);
    await supabase.from("cases").update({ status: "error" }).eq("id", caseId);
    await insertAuditLog(supabase, user.id, caseId, audit);
    return NextResponse.json(
      {
        success: false,
        messages_ingested: 0,
        duplicates_skipped: 0,
        errors: audit.errors,
      },
      { status: 502 },
    );
  }

  const rawBody = await parseRes.text();
  let parseJson: unknown;
  const trimmedBody = rawBody.trim();
  if (trimmedBody === "") {
    parseJson = undefined;
  } else {
    try {
      parseJson = JSON.parse(trimmedBody) as unknown;
    } catch {
      if (!parseRes.ok) {
        audit.errors.push(
          `Parser error (${parseRes.status}): ${truncateForLog(rawBody, 800)}`,
        );
      } else {
        audit.errors.push(
          `Parser returned non-JSON (${parseRes.status}): ${truncateForLog(rawBody, 500)}`,
        );
      }
      await supabase.from("cases").update({ status: "error" }).eq("id", caseId);
      await insertAuditLog(supabase, user.id, caseId, audit);
      return NextResponse.json(
        {
          success: false,
          messages_ingested: 0,
          duplicates_skipped: 0,
          errors: audit.errors,
        },
        { status: 502 },
      );
    }
  }

  if (!parseRes.ok) {
    const jsonObj =
      typeof parseJson === "object" && parseJson != null
        ? (parseJson as Record<string, unknown>)
        : null;
    const fromMessage =
      jsonObj != null &&
      typeof jsonObj.message === "string" &&
      jsonObj.message.length > 0
        ? jsonObj.message
        : null;
    const fromErrorField =
      jsonObj != null &&
      typeof jsonObj.error === "string" &&
      jsonObj.error.length > 0
        ? jsonObj.error
        : null;
    let detail =
      fromMessage ??
      fromErrorField ??
      (parseJson !== undefined
        ? truncateForLog(JSON.stringify(parseJson), 800)
        : truncateForLog(rawBody, 800));
    if (detail === "") {
      detail = `HTTP ${parseRes.status}`;
    }
    audit.errors.push(`Parser error: ${detail}`);
    await supabase.from("cases").update({ status: "error" }).eq("id", caseId);
    await insertAuditLog(supabase, user.id, caseId, audit);
    return NextResponse.json(
      {
        success: false,
        messages_ingested: 0,
        duplicates_skipped: 0,
        errors: audit.errors,
      },
      { status: 502 },
    );
  }

  const parsedBody = parseResponseSchema.safeParse(parseJson);
  if (!parsedBody.success) {
    const zodHint = parsedBody.error.issues
      .slice(0, 5)
      .map((i) => i.message)
      .join("; ");
    audit.errors.push(
      `Parser response did not match the expected shape: ${zodHint}`,
    );
    await supabase.from("cases").update({ status: "error" }).eq("id", caseId);
    await insertAuditLog(supabase, user.id, caseId, audit);
    return NextResponse.json(
      {
        success: false,
        messages_ingested: 0,
        duplicates_skipped: 0,
        errors: audit.errors,
      },
      { status: 502 },
    );
  }

  const parseData = parsedBody.data;
  for (const err of parseData.parse_errors) {
    audit.errors.push(err);
  }

  const incomingTotal = parseData.records.length;
  const validRows: z.infer<typeof parseResponseSchema>["records"] = [];
  for (const rec of parseData.records) {
    if (!isValidSentAt(rec.sent_at)) {
      audit.errors.push(`Skipped message: invalid sent_at (${rec.raw_hash.slice(0, 8)}…).`);
      continue;
    }
    validRows.push(rec);
  }

  const validationRejected = incomingTotal - validRows.length;
  const hashList = Array.from(
    new Set(validRows.map((r) => r.raw_hash)),
  );
  const existingHashes = new Set<string>();
  for (const hashChunk of chunkArray(hashList, HASH_LOOKUP_CHUNK)) {
    if (hashChunk.length === 0) {
      continue;
    }
    const { data: existingRows, error: hashErr } = await supabase
      .from("messages")
      .select("raw_hash")
      .eq("case_id", caseId)
      .in("raw_hash", hashChunk);

    if (hashErr != null) {
      audit.errors.push(`Dedup lookup failed: ${hashErr.message}`);
      await supabase.from("cases").update({ status: "error" }).eq("id", caseId);
      await insertAuditLog(supabase, user.id, caseId, audit);
      return NextResponse.json(
        {
          success: false,
          messages_ingested: 0,
          duplicates_skipped: 0,
          errors: audit.errors,
        },
        { status: 500 },
      );
    }
    for (const row of existingRows ?? []) {
      existingHashes.add(row.raw_hash);
    }
  }

  const toInsert = validRows.filter((r) => !existingHashes.has(r.raw_hash));
  const duplicatesSkipped =
    validRows.length - toInsert.length + validationRejected;

  const dbRows = toInsert.map((r) => ({
    case_id: caseId,
    sent_at: new Date(r.sent_at).toISOString(),
    sender_role: r.sender_role,
    body_text: r.body_text,
    platform_source: r.platform_source,
    raw_hash: r.raw_hash,
  }));

  let inserted = 0;
  for (const part of chunkArray(dbRows, INSERT_CHUNK)) {
    if (part.length === 0) {
      continue;
    }
    const { error: insErr } = await supabase.from("messages").insert(part);
    if (insErr != null) {
      audit.errors.push(`Message insert failed: ${insErr.message}`);
      await supabase.from("cases").update({ status: "error" }).eq("id", caseId);
      await insertAuditLog(supabase, user.id, caseId, audit);
      return NextResponse.json(
        {
          success: false,
          messages_ingested: inserted,
          duplicates_skipped: duplicatesSkipped,
          errors: audit.errors,
        },
        { status: 500 },
      );
    }
    inserted += part.length;
  }

  const { count: totalMessages, error: countError } = await supabase
    .from("messages")
    .select("*", { count: "exact", head: true })
    .eq("case_id", caseId);

  if (countError != null) {
    audit.errors.push(`Count failed: ${countError.message}`);
    await supabase.from("cases").update({ status: "error" }).eq("id", caseId);
    await insertAuditLog(supabase, user.id, caseId, audit);
    return NextResponse.json(
      {
        success: false,
        messages_ingested: inserted,
        duplicates_skipped: duplicatesSkipped,
        errors: audit.errors,
      },
      { status: 500 },
    );
  }

  const finalCount = totalMessages ?? 0;
  const noRecords = parseData.records.length === 0;
  const hasParseErrors = parseData.parse_errors.length > 0;

  // "ready" means safe to run analysis — requires at least one message. Otherwise
  // the UI shows "Ready" while Run analysis stays disabled (message_count > 0).
  let finalStatus: "error" | "pending" | "ready";
  if (noRecords && hasParseErrors) {
    finalStatus = "error";
  } else if (finalCount === 0) {
    finalStatus = "pending";
  } else {
    finalStatus = "ready";
  }

  if (finalStatus === "pending" && finalCount === 0 && !hasParseErrors) {
    audit.errors.push(
      "No messages were extracted or saved. Confirm PDF source (OurFamilyWizard vs TalkingParents) or try a text export.",
    );
  }

  const { error: finalCaseError } = await supabase
    .from("cases")
    .update({
      message_count: finalCount,
      status: finalStatus,
    })
    .eq("id", caseId);

  if (finalCaseError != null) {
    audit.errors.push(`Failed to finalize case: ${finalCaseError.message}`);
    await insertAuditLog(supabase, user.id, caseId, audit);
    return NextResponse.json(
      {
        success: false,
        messages_ingested: inserted,
        duplicates_skipped: duplicatesSkipped,
        errors: audit.errors,
      },
      { status: 500 },
    );
  }

  audit.messageCount = finalCount;
  const success = finalStatus !== "error";
  await insertAuditLog(supabase, user.id, caseId, audit);

  return NextResponse.json({
    success,
    messages_ingested: inserted,
    duplicates_skipped: duplicatesSkipped,
    errors: audit.errors,
  });
};
