import { Suspense } from "react";
import { OpportunitiesView } from "@/components/OpportunitiesView";

export const metadata = { title: "Opportunities" };

export default function OpportunitiesPage() {
  return (
    <Suspense>
      <OpportunitiesView />
    </Suspense>
  );
}
