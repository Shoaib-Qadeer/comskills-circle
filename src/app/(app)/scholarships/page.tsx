import { Suspense } from "react";
import { ScholarshipsView } from "@/components/scholarships/ScholarshipsView";

export const metadata = { title: "Scholarships" };

export default function ScholarshipsPage() {
  return (
    <Suspense>
      <ScholarshipsView />
    </Suspense>
  );
}
