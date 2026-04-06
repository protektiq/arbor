import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";

import { CaseUploadSection } from "@/components/cases/CaseUploadSection";
import { RunAnalysisButton } from "@/components/cases/RunAnalysisButton";
import { StatusBadge } from "@/components/cases/StatusBadge";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const uuidSchema = z.string().uuid();

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function CaseDetailPage({ params }: PageProps) {
  const { id: rawId } = await params;
  const parsed = uuidSchema.safeParse(rawId);
  if (!parsed.success) {
    notFound();
  }
  const id = parsed.data;

  const supabase = createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user == null) {
    notFound();
  }

  const { data: caseRow, error } = await supabase
    .from("cases")
    .select(
      "id, case_code, jurisdiction, status, severity_score, message_count, created_at",
    )
    .eq("id", id)
    .maybeSingle();

  if (error != null || caseRow == null) {
    notFound();
  }

  const canRunAnalysis =
    caseRow.status === "ready" && caseRow.message_count > 0;

  const severityDisplay =
    caseRow.severity_score == null
      ? "—"
      : String(caseRow.severity_score);

  const created = new Date(caseRow.created_at).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });

  return (
    <main className="mx-auto max-w-3xl p-8">
      <Link
        href="/dashboard"
        className="text-sm font-medium text-blue-700 hover:text-blue-800"
      >
        Back to cases
      </Link>

      <header className="mt-6 border-b border-zinc-200 pb-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-zinc-900">
              {caseRow.case_code}
            </h1>
            <p className="mt-1 text-sm text-zinc-600">
              {caseRow.jurisdiction}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <StatusBadge status={caseRow.status} />
            <div className="text-right text-sm text-zinc-600">
              <div>Severity: {severityDisplay}</div>
              <div className="mt-0.5">Messages: {caseRow.message_count}</div>
            </div>
          </div>
        </div>
        <p className="mt-3 text-xs text-zinc-500">Created {created}</p>
      </header>

      {caseRow.message_count === 0 ? (
        <div
          className="mt-8 rounded-lg border border-dashed border-zinc-300 bg-zinc-50/80 p-8 text-center"
          role="status"
        >
          <p className="text-sm font-medium text-zinc-800">
            No messages ingested yet
          </p>
          <p className="mt-2 text-sm text-zinc-600">
            Upload an OurFamilyWizard or TalkingParents export (PDF) or a plain
            text thread below. Messages appear here after parsing completes.
          </p>
        </div>
      ) : null}

      <div className="mt-8">
        <CaseUploadSection caseId={caseRow.id} />
      </div>

      <RunAnalysisButton disabled={!canRunAnalysis} />
    </main>
  );
}
