import Link from "next/link";
import { redirect } from "next/navigation";

import { StatusBadge } from "@/components/cases/StatusBadge";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export default async function DashboardPage() {
  const supabase = createServerSupabaseClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error != null || user == null) {
    redirect("/login?redirectTo=/dashboard");
  }

  const { data: cases, error: casesError } = await supabase
    .from("cases")
    .select(
      "id, case_code, jurisdiction, status, message_count, severity_score, created_at",
    )
    .order("created_at", { ascending: false });

  const rows = cases ?? [];

  return (
    <main className="p-8">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-zinc-900">
              Cases
            </h1>
            <p className="mt-1 text-sm text-zinc-600">
              Signed in as {user.email ?? "your account"}
            </p>
          </div>
          <Link
            href="/dashboard/new-case"
            className="inline-flex items-center rounded-md bg-[#1A1A2E] px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-[#252542]"
          >
            New case
          </Link>
        </div>

        {casesError != null ? (
          <p className="mt-8 text-sm text-red-700" role="alert">
            Could not load cases. Try refreshing the page.
          </p>
        ) : rows.length === 0 ? (
          <div className="mt-10 rounded-lg border border-zinc-200 bg-white p-10 text-center shadow-sm">
            <p className="text-sm text-zinc-600">
              You have no cases yet. Create one to upload co-parenting exports.
            </p>
            <Link
              href="/dashboard/new-case"
              className="mt-4 inline-block text-sm font-medium text-blue-700 hover:text-blue-800"
            >
              Create your first case
            </Link>
          </div>
        ) : (
          <div className="mt-8 overflow-x-auto rounded-lg border border-zinc-200 bg-white shadow-sm">
            <table className="min-w-full divide-y divide-zinc-200 text-left text-sm">
              <thead className="bg-zinc-50">
                <tr>
                  <th
                    scope="col"
                    className="px-4 py-3 font-medium text-zinc-700"
                  >
                    Case code
                  </th>
                  <th
                    scope="col"
                    className="px-4 py-3 font-medium text-zinc-700"
                  >
                    Jurisdiction
                  </th>
                  <th
                    scope="col"
                    className="px-4 py-3 font-medium text-zinc-700"
                  >
                    Status
                  </th>
                  <th
                    scope="col"
                    className="px-4 py-3 font-medium text-zinc-700"
                  >
                    Messages
                  </th>
                  <th
                    scope="col"
                    className="px-4 py-3 font-medium text-zinc-700"
                  >
                    Severity
                  </th>
                  <th
                    scope="col"
                    className="px-4 py-3 font-medium text-zinc-700"
                  >
                    Created
                  </th>
                  <th
                    scope="col"
                    className="px-4 py-3 font-medium text-zinc-700"
                  >
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {rows.map((c) => {
                  const created = new Date(c.created_at).toLocaleDateString(
                    undefined,
                    { dateStyle: "medium" },
                  );
                  const severity =
                    c.severity_score == null ? "—" : String(c.severity_score);
                  return (
                    <tr key={c.id} className="hover:bg-zinc-50/80">
                      <td className="px-4 py-3 font-medium text-zinc-900">
                        <Link
                          href={`/dashboard/cases/${c.id}`}
                          className="text-blue-700 hover:text-blue-800 hover:underline"
                        >
                          {c.case_code}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-zinc-700">
                        {c.jurisdiction}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={c.status} />
                      </td>
                      <td className="px-4 py-3 text-zinc-700 tabular-nums">
                        {c.message_count}
                      </td>
                      <td className="px-4 py-3 text-zinc-700 tabular-nums">
                        {severity}
                      </td>
                      <td className="px-4 py-3 text-zinc-600">{created}</td>
                      <td className="px-4 py-3">
                        <Link
                          href={`/dashboard/cases/${c.id}`}
                          className="font-medium text-blue-700 hover:text-blue-800"
                        >
                          View
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </main>
  );
}
