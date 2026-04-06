import { redirect } from "next/navigation";

/**
 * Plan and middleware reference /dashboard/settings/billing; this path redirects
 * so bookmarks and docs using /settings/billing still work.
 */
export default function SettingsBillingAliasPage() {
  redirect("/dashboard/settings/billing");
}
