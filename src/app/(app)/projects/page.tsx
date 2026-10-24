import { Suspense } from "react";
import { getCurrentUser } from "@/lib/auth";
import { firstName } from "@/lib/client-safe";
import { ProjectsBoard } from "@/components/projects/ProjectsBoard";

export const metadata = { title: "Projects" };

export default async function ProjectsPage() {
  const user = await getCurrentUser();
  return (
    <Suspense>
      <ProjectsBoard name={firstName(user?.name || "")} />
    </Suspense>
  );
}
