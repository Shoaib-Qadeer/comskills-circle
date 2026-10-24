import { redirect } from "next/navigation";
import { passwordLoginEnabled } from "@/lib/auth-config";
import { VerifyForm } from "@/components/auth/AuthForms";

export const metadata = { title: "Confirm your email" };

export default async function VerifyPage({ searchParams }: { searchParams: Promise<{ email?: string; sent?: string }> }) {
  if (!passwordLoginEnabled()) redirect("/login");
  const sp = await searchParams;
  const email = (sp.email || "").trim().toLowerCase().slice(0, 200);
  return <VerifyForm email={email} justSent={sp.sent === "1"} />;
}
