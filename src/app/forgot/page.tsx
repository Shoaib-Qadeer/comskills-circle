import { redirect } from "next/navigation";
import { passwordLoginEnabled } from "@/lib/auth-config";
import { ForgotForm } from "@/components/auth/AuthForms";

export const metadata = { title: "Reset your password" };

export default async function ForgotPage({ searchParams }: { searchParams: Promise<{ email?: string }> }) {
  if (!passwordLoginEnabled()) redirect("/login");
  const sp = await searchParams;
  return <ForgotForm initialEmail={(sp.email || "").slice(0, 200)} />;
}
