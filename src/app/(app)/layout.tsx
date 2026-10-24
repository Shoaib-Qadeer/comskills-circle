import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { AppShell } from "@/components/AppShell";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/");
  if (user.status !== "approved") redirect("/pending");
  if (!user.onboarded) redirect("/onboarding");
  return (
    <AppShell me={{ name: user.name, photoUrl: user.photoUrl, hasPosted: Boolean(user.hasPosted), isAdmin: user.isAdmin, email: user.email }}>
      {children}
    </AppShell>
  );
}
