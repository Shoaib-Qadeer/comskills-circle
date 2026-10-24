import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { landingFor } from "@/lib/auth-messages";
import { LoginForm } from "@/components/auth/AuthForms";

export const dynamic = "force-dynamic";
export const metadata = { title: "Log in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ email?: string; reason?: string }> }) {
  const user = await getCurrentUser().catch(() => null);
  if (user) redirect(landingFor(user as { status: string; onboarded: boolean }));
  const sp = await searchParams;
  return <LoginForm initialEmail={(sp.email || "").slice(0, 200)} reason={sp.reason} />;
}
