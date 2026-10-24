import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { Landing } from "@/components/Landing";

export const dynamic = "force-dynamic";

export default async function Home() {
  let user = null;
  try {
    user = await getCurrentUser();
  } catch (e) {
    console.error("[landing] could not load session", e);
  }
  if (user) redirect(user.status !== "approved" ? "/pending" : user.onboarded ? "/matches" : "/onboarding");
  return <Landing />;
}
