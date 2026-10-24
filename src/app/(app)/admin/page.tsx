import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { HOME_PATH } from "@/lib/auth-messages";
import { AdminView } from "@/components/admin/AdminView";

export const metadata = { title: "Admin" };

export default async function AdminPage() {
  const user = await getCurrentUser();
  if (!user?.isAdmin) redirect(HOME_PATH);
  return (
    <Suspense>
      <AdminView />
    </Suspense>
  );
}
