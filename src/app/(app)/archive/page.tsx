import { Suspense } from "react";
import { OpportunitiesView } from "@/components/OpportunitiesView";
import { ClosedSavedMatches } from "@/components/ClosedSavedMatches";

export const metadata = { title: "Archive" };

export default function ArchivePage() {
  return (
    <Suspense>
      <OpportunitiesView mode="archive" />
      <ClosedSavedMatches />
    </Suspense>
  );
}
