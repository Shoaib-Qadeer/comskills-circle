import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { AdminView } from "@/components/AdminView";

export const metadata = { title: "Admin" };

export default async function AdminPage() {
  const user = await getCurrentUser();
  if (!user?.isAdmin) redirect("/matches");
  return <AdminView />;
}
