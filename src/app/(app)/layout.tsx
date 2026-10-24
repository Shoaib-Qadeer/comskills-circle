import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { AppShell } from "@/components/AppShell";
import { photoUrlFor } from "@/lib/serialize";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.status !== "approved") redirect("/pending");
  if (!user.onboarded) redirect("/onboarding");
  return (
    <AppShell me={{ name: user.name, photoUrl: photoUrlFor(user), hasPosted: Boolean(user.hasPosted), isAdmin: user.isAdmin, email: user.email }}>
      {children}
    </AppShell>
  );
}
