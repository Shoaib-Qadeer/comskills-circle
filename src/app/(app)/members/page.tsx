import { Suspense } from "react";
import { MembersView } from "@/components/members/MembersView";

export const metadata = { title: "Members" };

export default function MembersPage() {
  return (
    <Suspense>
      <MembersView />
    </Suspense>
  );
}
