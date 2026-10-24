import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { landingFor } from "@/lib/auth-messages";
import { Landing } from "@/components/Landing";

export const dynamic = "force-dynamic";

export default async function Home() {
  let user = null;
  try {
    user = await getCurrentUser();
  } catch (e) {
    console.error("[landing] could not load session", e);
  }
  if (user) redirect(landingFor({ status: user.status ?? "pending", onboarded: user.onboarded }));
  return <Landing />;
}
