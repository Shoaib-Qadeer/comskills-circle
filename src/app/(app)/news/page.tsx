import { Suspense } from "react";
import { getCurrentUser, isTeam } from "@/lib/auth";
import { NewsView } from "@/components/news/NewsView";

export const metadata = { title: "News" };

export default async function NewsPage() {
  const user = await getCurrentUser();
  return (
    <Suspense>
      <NewsView canPost={Boolean(user && isTeam(user))} />
    </Suspense>
  );
}
