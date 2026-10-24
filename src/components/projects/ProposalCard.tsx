"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { Clock, Sparkles, Users } from "lucide-react";
import { PROPOSAL_STATUS_LABEL, type ProposalCardDTO, type ProposalStatus } from "@/lib/types";
import { getField } from "@/lib/taxonomy";
import { timeAgo } from "@/lib/client";
import { Avatar, Tag, cx } from "../ui";

const STATUS_TONE: Record<ProposalStatus, "aurora" | "brass" | "violet" | "neutral"> = {
  open: "aurora",
  team_forming: "brass",
  in_progress: "violet",
  completed: "neutral",
};

export function StatusPill({ status }: { status: ProposalStatus }) {
  return (
    <Tag tone={STATUS_TONE[status]}>
      <span className={cx("size-1.5 rounded-full", status === "open" ? "bg-aurora" : status === "team_forming" ? "bg-brass" : status === "in_progress" ? "bg-violet" : "bg-faint")} aria-hidden />
      {PROPOSAL_STATUS_LABEL[status]}
    </Tag>
  );
}

export function commitmentText(c: ProposalCardDTO["commitment"]): string | null {
  const parts = [c.hoursPerWeek ? `${c.hoursPerWeek} h/week` : null, c.duration || null].filter(Boolean);
  return parts.length ? parts.join(" · ") : null;
}

export function needsText(p: Pick<ProposalCardDTO, "acceptedCount" | "peopleNeeded">): string {
  const base = `${p.acceptedCount} of ${p.peopleNeeded.count}`;
  return p.peopleNeeded.skills.length ? `${base} · ${p.peopleNeeded.skills.slice(0, 3).join(", ")}` : base;
}

export function MyStatusTag({ s }: { s: ProposalCardDTO["myStatus"] }) {
  if (s === "accepted") return <Tag tone="aurora">You're on the team</Tag>;
  if (s === "interested") return <Tag tone="brass">You're interested</Tag>;
  if (s === "invited") return <Tag tone="brass">You're invited</Tag>;
  return null;
}

export function TeamStack({ team, more }: { team: ProposalCardDTO["team"]; more: number }) {
  if (!team.length) return null;
  return (
    <div className="flex items-center">
      <div className="flex -space-x-2">
        {team.slice(0, 4).map((t) => (
          <span key={t.id} className="rounded-full ring-2 ring-raised">
            <Avatar name={t.name} src={t.photoUrl} size={26} />
          </span>
        ))}
      </div>
      {more > 0 && <span className="ml-1.5 text-xs text-faint">+{more}</span>}
    </div>
  );
}

export function ProposalCard({ p, forYou, index = 0 }: { p: ProposalCardDTO; forYou: boolean; index?: number }) {
  const commitment = commitmentText(p.commitment);
  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.97 }}
      transition={{ delay: Math.min(index, 10) * 0.035, type: "spring", stiffness: 260, damping: 26 }}
      className={cx(
        "relative flex h-full min-w-0 flex-col rounded-[var(--radius-panel)] border bg-raised/80 transition-colors hover:bg-raised",
        forYou ? "border-brass/50 shadow-[0_0_0_1px_var(--glow),0_18px_40px_-28px_var(--glow)]" : "border-line hover:border-line-strong",
      )}
    >
      <Link href={`/projects/${p.id}`} className="flex h-full flex-col p-4 sm:p-5">
        {forYou && p.match && (
          <div className="-mx-4 -mt-4 mb-3 flex items-start gap-2 rounded-t-[var(--radius-panel)] border-b border-brass/25 bg-brass/[0.08] px-4 py-2 text-sm sm:-mx-5 sm:-mt-5 sm:px-5">
            <Sparkles className="mt-0.5 size-4 shrink-0 text-brass" />
            <span className="min-w-0">
              <span className="font-medium text-brass">For you</span>
              <span className="text-dim"> · {p.match.reason}</span>
            </span>
          </div>
        )}
        <div className="flex flex-wrap items-center gap-1.5">
          <StatusPill status={p.status} />
          {!p.acceptingMembers && p.status !== "completed" && <Tag>Not taking new people</Tag>}
          <MyStatusTag s={p.myStatus} />
          <span className="ml-auto text-xs text-faint">{timeAgo(p.createdAt)}</span>
        </div>
        <h3 className="mt-2.5 font-display text-lg font-semibold leading-snug">{p.title}</h3>
        <p className="mt-1 line-clamp-2 text-sm leading-relaxed text-dim">{p.problem}</p>
        <div className="mt-3 space-y-1 text-sm">
          <p className="flex items-center gap-2">
            <Users className="size-4 shrink-0 text-faint" />
            <span className="min-w-0 truncate">{needsText(p)}</span>
          </p>
          {commitment && (
            <p className="flex items-center gap-2 text-dim">
              <Clock className="size-4 shrink-0 text-faint" />
              {commitment}
            </p>
          )}
        </div>
        {p.fields.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {p.fields.slice(0, 2).map((f) => (
              <Tag key={f}>
                {getField(f).emoji} {getField(f).label}
              </Tag>
            ))}
          </div>
        )}
        <div className="mt-auto flex items-center gap-2 pt-4 text-xs text-faint">
          {p.proposer ? (
            <>
              <Avatar name={p.proposer.name} src={p.proposer.photoUrl} size={22} />
              <span className="min-w-0 truncate">{p.proposedByMe ? "Your project" : p.proposer.name}</span>
            </>
          ) : (
            <span>Proposed by a former member</span>
          )}
          <span className="ml-auto">
            <TeamStack team={p.team} more={p.acceptedCount - Math.min(4, p.team.length)} />
          </span>
        </div>
      </Link>
    </motion.article>
  );
}
