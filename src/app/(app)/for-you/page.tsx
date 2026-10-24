import { Suspense } from "react";
import { MatchesView } from "@/components/MatchesView";
import { getCurrentUser } from "@/lib/auth";
import { firstName } from "@/lib/client-safe";

export const metadata = { title: "For you" };

export default async function MatchesPage() {
  const user = await getCurrentUser();
  return (
    <Suspense>
      <MatchesView name={firstName(user?.name || "")} />
    </Suspense>
  );
}
