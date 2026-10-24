import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { googleConfigured, passwordLoginEnabled } from "@/lib/auth-config";
import { landingFor } from "@/lib/auth-messages";
import { LoginForm } from "@/components/auth/AuthForms";
import { GoogleSignIn } from "@/components/auth/GoogleSignIn";

export const dynamic = "force-dynamic";
export const metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ email?: string; reason?: string; error?: string; method?: string }> }) {
  const user = await getCurrentUser().catch(() => null);
  if (user) redirect(landingFor(user as { status: string; onboarded: boolean }));
  const sp = await searchParams;
  const usePassword = passwordLoginEnabled() && (!googleConfigured() || sp.method === "password");
  if (!usePassword) return <GoogleSignIn mode="login" error={sp.error} passwordLink={passwordLoginEnabled() ? "/login?method=password" : null} />;
  return <LoginForm initialEmail={(sp.email || "").slice(0, 200)} reason={sp.reason} />;
}
