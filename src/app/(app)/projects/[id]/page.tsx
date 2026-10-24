import { ProposalPage } from "@/components/projects/ProposalPage";

export const metadata = { title: "Project" };

export default async function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ProposalPage id={id} />;
}
