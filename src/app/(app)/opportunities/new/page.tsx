import { Suspense } from "react";
import { PostFlow } from "@/components/PostFlow";

export const metadata = { title: "Share an opportunity" };

export default function NewOpportunityPage() {
  return (
    <Suspense>
      <PostFlow />
    </Suspense>
  );
}
