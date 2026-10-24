import { redirect } from "next/navigation";
import { passwordLoginEnabled } from "@/lib/auth-config";
import { ResetForm } from "@/components/auth/AuthForms";

export const metadata = { title: "Choose a new password" };

export default async function ResetPage({ searchParams }: { searchParams: Promise<{ email?: string; sent?: string }> }) {
  if (!passwordLoginEnabled()) redirect("/login");
  const sp = await searchParams;
  return <ResetForm email={(sp.email || "").trim().toLowerCase().slice(0, 200)} justSent={sp.sent === "1"} />;
}
