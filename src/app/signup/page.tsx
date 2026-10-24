import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { googleConfigured, passwordLoginEnabled } from "@/lib/auth-config";
import { activeBatches, getSettings } from "@/lib/settings";
import { landingFor } from "@/lib/auth-messages";
import { SignupForm } from "@/components/auth/AuthForms";
import { GoogleSignIn } from "@/components/auth/GoogleSignIn";

export const dynamic = "force-dynamic";
export const metadata = { title: "Join" };

export default async function SignupPage({ searchParams }: { searchParams: Promise<{ error?: string; method?: string }> }) {
  const sp = await searchParams;
  const usePassword = passwordLoginEnabled() && (!googleConfigured() || sp.method === "password");
  // The Google screen needs no database work, so it opens instantly
  if (!usePassword) return <GoogleSignIn mode="signup" error={sp.error} passwordLink={passwordLoginEnabled() ? "/signup?method=password" : null} />;
  const user = await getCurrentUser().catch(() => null);
  if (user) redirect(landingFor(user as { status: string; onboarded: boolean }));
  const batches = await getSettings()
    .then((s) => activeBatches(s).map((b) => ({ id: b.id, label: b.label })))
    .catch(() => []);
  return <SignupForm batches={batches} />;
}
