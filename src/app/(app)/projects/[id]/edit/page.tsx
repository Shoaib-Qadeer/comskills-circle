"use client";

import { use } from "react";
import Link from "next/link";
import useSWR from "swr";
import type { ProposalDetailDTO } from "@/lib/types";
import { ProposalForm } from "@/components/projects/ProposalForm";
import { EmptyState, Skeleton } from "@/components/ui";
import { Pencil } from "lucide-react";

export default function EditProposalPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data, error } = useSWR<ProposalDetailDTO>(`/api/proposals/${id}`);
  if (error) return <EmptyState icon={<Pencil className="size-10" />} title="Couldn't load this project" action={<Link href="/projects" className="inline-flex h-11 items-center rounded-full border border-line-strong px-5 text-sm">Back to projects</Link>}>It may have been deleted.</EmptyState>;
  if (!data) return <Skeleton className="mx-auto h-96 max-w-3xl rounded-[var(--radius-panel)]" />;
  if (!data.canManage) return <EmptyState icon={<Pencil className="size-10" />} title="Only the proposer can edit this">Ask them to make the change.</EmptyState>;
  return <ProposalForm existing={data} />;
}
