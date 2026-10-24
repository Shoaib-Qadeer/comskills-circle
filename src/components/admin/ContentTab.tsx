"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import useSWR, { mutate as globalMutate } from "swr";
import { toast } from "sonner";
import { Check, RefreshCw, RotateCcw, Search, Trash2 } from "lucide-react";
import type { OpportunityDTO } from "@/lib/types";
import { api, formatDate, timeAgo } from "@/lib/client";
import { Button, Input, Modal, Segmented, Skeleton, Tag } from "../ui";

type Kind = "proposals" | "opportunities" | "news" | "scholarships" | "reports";
type ProposalRow = { id: string; title: string; status: string; proposer: string | null; matchCount: number; openReports: number; createdAt: string };
type NewsRow = { id: string; title: string; category: string; pinned: boolean; author: string | null; emailedCount: number; createdAt: string };
type ScholarshipRow = { id: string; name: string; country: string; stage: string; owner: string | null; batch: string | null; teamOnly: boolean; updatedAt: string };
type ReportRow = { id: string; proposalId: string; proposalTitle: string | null; reporter: string | null; reason: string; resolved: boolean; createdAt: string };
type Res =
  | { type: "opportunities"; items: OpportunityDTO[] }
  | { type: "proposals"; items: ProposalRow[] }
  | { type: "news"; items: NewsRow[] }
  | { type: "scholarships"; items: ScholarshipRow[] }
  | { type: "reports"; items: ReportRow[] };

const STATUS: Record<string, string> = { open: "Open", team_forming: "Team forming", in_progress: "In progress", completed: "Completed" };

function Row({ title, meta, children, href }: { title: React.ReactNode; meta: React.ReactNode; children?: React.ReactNode; href?: string }) {
  return (
    <li className="flex flex-wrap items-center gap-2 px-4 py-3 sm:px-5">
      <div className="min-w-0 flex-1 basis-56">
        {href ? (
          <Link href={href} className="font-medium hover:text-brass">
            {title}
          </Link>
        ) : (
          <p className="font-medium">{title}</p>
        )}
        <p className="text-sm text-dim">{meta}</p>
      </div>
      {children}
    </li>
  );
}

export function ContentTab() {
  const [kind, setKind] = useState<Kind>("proposals");
  const [q, setQ] = useState("");
  const [dq, setDq] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setDq(q.trim()), 300);
    return () => clearTimeout(t);
  }, [q]);
  const key = `/api/admin/content?type=${kind}${dq ? `&q=${encodeURIComponent(dq)}` : ""}`;
  const { data, mutate } = useSWR<Res>(key);
  const [busy, setBusy] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<{ label: string; run: () => Promise<unknown> } | null>(null);

  async function act(id: string, fn: () => Promise<unknown>, ok: string) {
    setBusy(id);
    try {
      await fn();
      toast.success(ok);
      mutate();
      globalMutate("/api/admin");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(null);
    }
  }
  const del = (label: string, id: string, fn: () => Promise<unknown>) => setConfirm({ label, run: () => act(id, fn, "Deleted") });

  const list = (() => {
    if (!data || data.type !== (kind === "news" ? "news" : kind)) return null;
    if (data.items.length === 0) return <li className="p-6 text-center text-dim">Nothing here.</li>;
    switch (data.type) {
      case "proposals":
        return data.items.map((p) => (
          <Row
            key={p.id}
            href={`/projects/${p.id}`}
            title={p.title}
            meta={
              <>
                {STATUS[p.status] ?? p.status} · by {p.proposer ?? "a former member"} · {p.matchCount} matches · {timeAgo(p.createdAt)}
                {p.openReports > 0 && (
                  <Tag tone="ember" className="ml-2">
                    {p.openReports} report{p.openReports === 1 ? "" : "s"}
                  </Tag>
                )}
              </>
            }
          >
            <Button size="sm" variant="ghost" loading={busy === p.id} onClick={() => act(p.id, () => api("/api/admin", "POST", { action: "rematchProposal", proposalId: p.id }), "Re-matched")}>
              <RefreshCw className="size-3.5" /> Re-match
            </Button>
            <Button size="sm" variant="quiet" aria-label={`Delete ${p.title}`} onClick={() => del(`the project “${p.title}”`, p.id, () => api(`/api/proposals/${p.id}`, "DELETE"))}>
              <Trash2 className="size-4" />
            </Button>
          </Row>
        ));
      case "opportunities":
        return data.items.map((o) => (
          <Row
            key={o.id}
            href={`/opportunities?open=${o.id}`}
            title={o.title}
            meta={[o.status === "expired" ? "Archived" : "Open", o.organization, o.postedBy ? `shared by ${o.postedBy.name}` : "former member", o.deadline ? `deadline ${formatDate(o.deadline)}` : "no deadline", `${o.matchCount ?? 0} matches`].filter(Boolean).join(" · ")}
          >
            <Button size="sm" variant="ghost" loading={busy === o.id} onClick={() => act(o.id, () => api("/api/admin", "POST", { action: "rematch", opportunityId: o.id }), "Re-matched")}>
              <RefreshCw className="size-3.5" /> Re-match
            </Button>
            <Button size="sm" variant="quiet" aria-label={`Delete ${o.title}`} onClick={() => del(`“${o.title}”`, o.id, () => api(`/api/opportunities/${o.id}`, "DELETE"))}>
              <Trash2 className="size-4" />
            </Button>
          </Row>
        ));
      case "news":
        return data.items.map((a) => (
          <Row key={a.id} href={`/news#a-${a.id}`} title={a.title} meta={`${a.category}${a.pinned ? " · pinned" : ""} · by ${a.author ?? "a former member"} · ${a.emailedCount ? `emailed to ${a.emailedCount} · ` : ""}${timeAgo(a.createdAt)}`}>
            <Button size="sm" variant="quiet" aria-label={`Delete ${a.title}`} onClick={() => del(`the post “${a.title}”`, a.id, () => api(`/api/announcements/${a.id}`, "DELETE"))}>
              <Trash2 className="size-4" />
            </Button>
          </Row>
        ));
      case "scholarships":
        return data.items.map((s) => (
          <Row
            key={s.id}
            title={s.name}
            meta={
              <>
                {s.stage} · {s.country} · {s.owner ?? "former member"}
                {s.batch ? ` (${s.batch})` : ""} · updated {timeAgo(s.updatedAt)}
                {s.teamOnly && (
                  <Tag className="ml-2" tone="violet">
                    team only
                  </Tag>
                )}
              </>
            }
          >
            <Button size="sm" variant="quiet" aria-label={`Delete ${s.name}`} onClick={() => del(`${s.owner ?? "this member"}'s entry “${s.name}”`, s.id, () => api("/api/admin/content", "POST", { action: "deleteScholarship", id: s.id }))}>
              <Trash2 className="size-4" />
            </Button>
          </Row>
        ));
      case "reports":
        return data.items.map((r) => (
          <Row
            key={r.id}
            href={r.proposalTitle ? `/projects/${r.proposalId}` : undefined}
            title={r.proposalTitle ?? "(project deleted)"}
            meta={
              <>
                {r.resolved ? <Tag tone="aurora">resolved</Tag> : <Tag tone="ember">open</Tag>} “{r.reason}” · from {r.reporter ?? "a former member"} · {timeAgo(r.createdAt)}
              </>
            }
          >
            <Button size="sm" variant="ghost" loading={busy === r.id} onClick={() => act(r.id, () => api("/api/admin/content", "POST", { action: "resolveReport", id: r.id, resolved: !r.resolved }), r.resolved ? "Reopened" : "Marked resolved")}>
              {r.resolved ? <RotateCcw className="size-3.5" /> : <Check className="size-3.5" />} {r.resolved ? "Reopen" : "Resolve"}
            </Button>
            {r.proposalTitle && (
              <Button size="sm" variant="quiet" aria-label="Delete the project" onClick={() => del(`the project “${r.proposalTitle}”`, r.id, () => api(`/api/proposals/${r.proposalId}`, "DELETE"))}>
                <Trash2 className="size-4" />
              </Button>
            )}
          </Row>
        ));
    }
  })();

  return (
    <div className="space-y-5">
      <div className="-mx-4 overflow-x-auto px-4 [scrollbar-width:none] sm:mx-0 sm:px-0">
        <Segmented
          id="content-kind"
          value={kind}
          onChange={(k) => setKind(k)}
          options={[
            { value: "proposals", label: "Projects" },
            { value: "opportunities", label: "Opportunities" },
            { value: "news", label: "News" },
            { value: "scholarships", label: "Scholarships" },
            { value: "reports", label: "Reports" },
          ]}
        />
      </div>
      {kind !== "reports" && (
        <div className="relative">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-faint" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by title or name…" className="pl-10" type="search" aria-label="Search content" />
        </div>
      )}
      {!list ? <Skeleton className="h-64 rounded-[var(--radius-panel)]" /> : <ul className="divide-y divide-line rounded-[var(--radius-panel)] border border-line bg-raised/60">{list}</ul>}
      <Modal open={Boolean(confirm)} onClose={() => setConfirm(null)} title="Delete for everyone?">
        <p className="text-sm text-dim">This deletes {confirm?.label}. It can&rsquo;t be undone.</p>
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="quiet" onClick={() => setConfirm(null)}>
            Cancel
          </Button>
          <Button
            variant="danger"
            onClick={async () => {
              const c = confirm;
              setConfirm(null);
              await c?.run();
            }}
          >
            Delete
          </Button>
        </div>
      </Modal>
    </div>
  );
}
