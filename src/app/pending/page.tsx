import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { HOME_PATH } from "@/lib/auth-messages";
import { PendingView } from "@/components/PendingView";

export const dynamic = "force-dynamic";
export const metadata = { title: "Waiting for approval" };

export default async function PendingPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.status === "approved") redirect(user.onboarded ? HOME_PATH : "/onboarding");
  return <PendingView name={user.name} email={user.email} photoUrl={user.photoUrl} rejected={user.status === "rejected"} />;
}
