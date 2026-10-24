import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getCurrentUser, isTeam } from "@/lib/auth";
import { HOME_PATH } from "@/lib/auth-messages";
import { TeamView } from "@/components/team/TeamView";

export const metadata = { title: "Team" };

export default async function TeamPage() {
  const user = await getCurrentUser();
  if (!user || !isTeam(user)) redirect(HOME_PATH);
  return (
    <Suspense>
      <TeamView />
    </Suspense>
  );
}
