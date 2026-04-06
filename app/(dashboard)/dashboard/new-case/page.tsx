"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

const JURISDICTIONS = [
  "California",
  "Texas",
  "Florida",
  "New York",
  "Illinois",
] as const;

const MAX_CASE_CODE = 256;
const MAX_PARENT_LABEL = 256;

const parentsStorageKey = (caseId: string) => `arbor:caseParents:${caseId}`;

export default function NewCasePage() {
  const router = useRouter();
  const [caseCode, setCaseCode] = useState("");
  const [jurisdiction, setJurisdiction] = useState<string>(JURISDICTIONS[0]);
  const [parentAName, setParentAName] = useState("Parent A");
  const [parentBName, setParentBName] = useState("Parent B");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);

    const code = caseCode.trim();
    if (code.length === 0) {
      setError("Case code is required.");
      return;
    }
    if (code.length > MAX_CASE_CODE) {
      setError("Case code is too long.");
      return;
    }

    const pa = parentAName.trim().slice(0, MAX_PARENT_LABEL);
    const pb = parentBName.trim().slice(0, MAX_PARENT_LABEL);
    if (pa.length === 0 || pb.length === 0) {
      setError("Both parent labels are required for sender mapping.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/cases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ case_code: code, jurisdiction }),
      });

      let body: { id?: string; error?: string } = {};
      try {
        body = (await res.json()) as typeof body;
      } catch {
        body = {};
      }

      if (!res.ok) {
        setError(
          typeof body.error === "string"
            ? body.error
            : "Could not create the case.",
        );
        return;
      }

      if (typeof body.id !== "string" || body.id.length === 0) {
        setError("Invalid response from server.");
        return;
      }

      try {
        sessionStorage.setItem(
          parentsStorageKey(body.id),
          JSON.stringify({ parentA: pa, parentB: pb }),
        );
      } catch {
        /* sessionStorage may be unavailable; upload page still has defaults */
      }

      router.push(`/dashboard/cases/${body.id}`);
    } catch {
      setError("Network error. Try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="mx-auto max-w-lg p-8">
      <Link
        href="/dashboard"
        className="text-sm font-medium text-blue-700 hover:text-blue-800"
      >
        Back to cases
      </Link>

      <h1 className="mt-4 text-2xl font-semibold text-zinc-900">New case</h1>
      <p className="mt-2 text-sm text-zinc-600">
        Use your internal case reference only (no client names in the case
        code). Parent labels help the parser map senders and are not stored in
        the database.
      </p>

      <form
        onSubmit={handleSubmit}
        className="mt-8 space-y-5 rounded-lg border border-zinc-200 bg-white p-6 shadow-sm"
        noValidate
      >
        <div>
          <label
            htmlFor="case-code"
            className="block text-sm font-medium text-zinc-700"
          >
            Case code
            <span className="text-red-600" aria-hidden>
              {" "}
              *
            </span>
          </label>
          <input
            id="case-code"
            name="case_code"
            type="text"
            required
            value={caseCode}
            onChange={(e) => setCaseCode(e.target.value)}
            maxLength={MAX_CASE_CODE}
            autoComplete="off"
            className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            aria-required
          />
        </div>

        <div>
          <label
            htmlFor="jurisdiction"
            className="block text-sm font-medium text-zinc-700"
          >
            Jurisdiction
            <span className="text-red-600" aria-hidden>
              {" "}
              *
            </span>
          </label>
          <select
            id="jurisdiction"
            name="jurisdiction"
            value={jurisdiction}
            onChange={(e) => setJurisdiction(e.target.value)}
            className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            aria-required
          >
            {JURISDICTIONS.map((j) => (
              <option key={j} value={j}>
                {j}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label
            htmlFor="parent-a"
            className="block text-sm font-medium text-zinc-700"
          >
            Parent A label
          </label>
          <input
            id="parent-a"
            name="parent_a_name"
            type="text"
            value={parentAName}
            onChange={(e) => setParentAName(e.target.value)}
            maxLength={MAX_PARENT_LABEL}
            autoComplete="off"
            className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>

        <div>
          <label
            htmlFor="parent-b"
            className="block text-sm font-medium text-zinc-700"
          >
            Parent B label
          </label>
          <input
            id="parent-b"
            name="parent_b_name"
            type="text"
            value={parentBName}
            onChange={(e) => setParentBName(e.target.value)}
            maxLength={MAX_PARENT_LABEL}
            autoComplete="off"
            className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>

        {error != null ? (
          <p className="text-sm text-red-700" role="alert">
            {error}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-md bg-[#1A1A2E] py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-[#252542] disabled:cursor-not-allowed disabled:bg-zinc-400"
        >
          {submitting ? "Creating…" : "Create case"}
        </button>
      </form>
    </main>
  );
}
