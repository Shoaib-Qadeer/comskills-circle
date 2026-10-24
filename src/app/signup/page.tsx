import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { activeBatches, getSettings } from "@/lib/settings";
import { landingFor } from "@/lib/auth-messages";
import { SignupForm } from "@/components/auth/AuthForms";

export const dynamic = "force-dynamic";
export const metadata = { title: "Create your account" };

export default async function SignupPage() {
  const user = await getCurrentUser().catch(() => null);
  if (user) redirect(landingFor(user as { status: string; onboarded: boolean }));
  const batches = await getSettings()
    .then((s) => activeBatches(s).map((b) => ({ id: b.id, label: b.label })))
    .catch(() => []);
  return <SignupForm batches={batches} />;
}
