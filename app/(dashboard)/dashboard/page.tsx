import { redirect } from "next/navigation";

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

  const email = user.email ?? "your account";

  return (
    <main className="p-8">
      <h1 className="text-2xl font-semibold text-zinc-900">
        Welcome to Arbor
      </h1>
      <p className="mt-2 text-sm text-zinc-600">Signed in as {email}</p>

      <section
        className="mt-10 rounded-lg border border-zinc-200 bg-white p-6 shadow-sm"
        aria-labelledby="cases-heading"
      >
        <h2
          id="cases-heading"
          className="text-lg font-medium text-zinc-900"
        >
          Cases
        </h2>
        <p className="mt-2 text-sm text-zinc-600">
          Case list and management will appear here. No case data is connected
          yet.
        </p>
      </section>
    </main>
  );
}
