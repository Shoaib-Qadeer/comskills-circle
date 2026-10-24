import { Suspense } from "react";
import { InboxView } from "@/components/InboxView";

export const metadata = { title: "Inbox" };

export default function InboxPage() {
  return (
    <Suspense>
      <InboxView />
    </Suspense>
  );
}
