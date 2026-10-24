import { ForgotForm } from "@/components/auth/AuthForms";

export const metadata = { title: "Reset your password" };

export default async function ForgotPage({ searchParams }: { searchParams: Promise<{ email?: string }> }) {
  const sp = await searchParams;
  return <ForgotForm initialEmail={(sp.email || "").slice(0, 200)} />;
}
