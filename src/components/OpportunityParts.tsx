"use client";

import { useState } from "react";
import { motion } from "motion/react";
import { toast } from "sonner";
import { ExternalLink, MapPin, Pencil, Trash2, Wifi, Calendar, Clock, Euro, Building2, Sparkles } from "lucide-react";
import type { OpportunityDTO } from "@/lib/types";
import { OPPORTUNITY_TYPES } from "@/lib/taxonomy";
import { api, formatDate, timeAgo } from "@/lib/client";
import { CompassMark, DeadlinePill, OrgMark, WarningChips, CountUp } from "./bits";
import { Avatar, Button, FieldChip, LinkButton, Modal, Tag, cx } from "./ui";

export const typeLabel = (t: string) => OPPORTUNITY_TYPES.find((x) => x.value === t)?.label ?? t;
export const remoteLabel = (r: string | null) => (r === "remote" ? "Remote" : r === "hybrid" ? "Hybrid" : r === "onsite" ? "On site" : null);

export function OppMeta({ o, className }: { o: OpportunityDTO; className?: string }) {
  const r = remoteLabel(o.remote);
  const remote = r && o.location?.trim().toLowerCase() === r.toLowerCase() ? null : r;
  return (
    <div className={cx("flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-dim", className)}>
      {o.organization && <span className="truncate">{o.organization}</span>}
      {o.location && (
        <span className="flex items-center gap-1">
          <MapPin className="size-3.5" />
          {o.location}
        </span>
      )}
      {remote && (
        <span className="flex items-center gap-1">
          <Wifi className="size-3.5" />
          {remote}
        </span>
      )}
    </div>
  );
}

/** Card used in the All Opportunities grid. Clicking opens the detail sheet. */
export function OpportunityCard({ o, onOpen, index = 0 }: { o: OpportunityDTO; onOpen: () => void; index?: number }) {
  return (
    <motion.button
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={{ delay: Math.min(index, 12) * 0.04, type: "spring", stiffness: 260, damping: 26 }}
      onClick={onOpen}
      className="group flex w-full flex-col rounded-[var(--radius-panel)] border border-line bg-raised/80 p-5 text-left transition-colors hover:border-line-strong hover:bg-raised"
    >
      <div className="flex w-full items-start gap-3">
        <OrgMark name={o.organization} url={o.url} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs text-faint">{typeLabel(o.type)}</span>
            <DeadlinePill deadline={o.deadline} />
          </div>
          <h3 className="mt-0.5 font-display text-lg font-semibold leading-snug group-hover:text-brass">{o.title}</h3>
          <OppMeta o={o} className="mt-1" />
        </div>
      </div>
      {o.fields.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-1.5">
          {o.fields.map((f) => (
            <FieldChip key={f} slug={f} size="sm" />
          ))}
        </div>
      )}
      <div className="mt-3">
        <WarningChips warnings={o.warnings.filter((w) => w.kind === "french_required" || w.kind === "duration_mismatch")} />
      </div>
      <div className="mt-auto flex items-center gap-2 pt-4 text-xs text-faint">
        {o.starter ? (
          <>
            <CompassMark size={16} /> Starter pick added by Compass
          </>
        ) : o.postedBy ? (
          <>
            <Avatar name={o.postedBy.name} src={o.postedBy.photoUrl} size={18} />
            {o.postedByMe ? "You" : o.postedBy.name} shared this {timeAgo(o.createdAt)}
          </>
        ) : (
          <>Shared by a former member {timeAgo(o.createdAt)}</>
        )}
      </div>
    </motion.button>
  );
}

function Fact({ icon: Icon, label, value }: { icon: typeof Clock; label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <Icon className="mt-0.5 size-4 shrink-0 text-faint" />
      <div>
        <p className="text-xs text-faint">{label}</p>
        <p className="text-sm">{value}</p>
      </div>
    </div>
  );
}

export function OpportunityDetail({
  o,
  open,
  onClose,
  onDeleted,
  onEdit,
}: {
  o: OpportunityDTO | null;
  open: boolean;
  onClose: () => void;
  onDeleted?: () => void;
  onEdit?: (o: OpportunityDTO) => void;
}) {
  const [deleting, setDeleting] = useState(false);
  const [confirm, setConfirm] = useState(false);
  if (!o) return <Modal open={false} onClose={onClose} title="">{null}</Modal>;
  const remote = remoteLabel(o.remote);
  async function del() {
    setDeleting(true);
    try {
      await api(`/api/opportunities/${o!.id}`, "DELETE");
      toast.success("Deleted");
      onDeleted?.();
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not delete");
    } finally {
      setDeleting(false);
      setConfirm(false);
    }
  }
  return (
    <Modal open={open} onClose={onClose} title={o.title} wide>
      <div className="-mt-3 mb-5 flex flex-wrap items-center gap-2">
        <Tag>{typeLabel(o.type)}</Tag>
        {o.status === "expired" ? <Tag tone="ember">Closed</Tag> : <DeadlinePill deadline={o.deadline} />}
      </div>

      {o.postedByMe && typeof o.matchCount === "number" && (
        <div className="mb-5 flex items-center gap-3 rounded-2xl border border-brass/30 bg-brass/[0.07] p-4">
          <Sparkles className="size-5 text-brass" />
          <p className="text-sm">
            Relevant to <CountUp value={o.matchCount} className="font-semibold text-brass" /> classmate{o.matchCount === 1 ? "" : "s"}
            <span className="text-dim"> — Compass never shows you who.</span>
          </p>
        </div>
      )}

      {o.summary && <p className="leading-relaxed text-dim">{o.summary}</p>}

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        {o.organization && <Fact icon={Building2} label="Organization" value={o.organization} />}
        {(o.location || remote) && <Fact icon={MapPin} label="Where" value={[o.location, remote].filter(Boolean).join(", ")} />}
        <Fact icon={Calendar} label="Deadline" value={o.deadline ? formatDate(o.deadline) : "Not stated"} />
        {o.startDate && <Fact icon={Calendar} label="Starts" value={formatDate(o.startDate)} />}
        <Fact icon={Clock} label="Duration" value={o.durationMonths != null ? `${o.durationMonths} months` : "Not stated"} />
        <Fact icon={Euro} label="Paid" value={o.paid == null ? "Not stated" : o.paid ? "Yes" : "No"} />
      </div>

      {o.eligibility && (
        <div className="mt-5 rounded-2xl bg-night-2 p-4 text-sm">
          <p className="mb-1 text-xs text-faint">Eligibility</p>
          {o.eligibility}
        </div>
      )}

      <div className="mt-5">
        <WarningChips warnings={o.warnings} deadline={o.deadline} />
      </div>

      {(o.fields.length > 0 || o.tags.length > 0) && (
        <div className="mt-5 flex flex-wrap gap-1.5">
          {o.fields.map((f) => (
            <FieldChip key={f} slug={f} size="sm" />
          ))}
          {o.tags.map((t) => (
            <Tag key={t}>{t}</Tag>
          ))}
        </div>
      )}

      {o.posterNote && (
        <blockquote className="mt-6 border-l-2 border-brass pl-4 text-sm italic text-dim">
          “{o.posterNote}”
        </blockquote>
      )}

      {o.starter && (
        <p className="mt-6 rounded-2xl border border-line p-4 text-sm text-dim">
          A starter pick researched in October 2026 so the board isn't empty. Details can change, so check the posting before you apply.
        </p>
      )}

      <div className="mt-6 flex items-center gap-2 text-sm text-faint">
        {o.starter ? (
          <>
            <CompassMark size={18} /> Added by Compass {timeAgo(o.createdAt)}
          </>
        ) : o.postedBy ? (
          <>
            <Avatar name={o.postedBy.name} src={o.postedBy.photoUrl} size={22} />
            Shared by {o.postedByMe ? "you" : o.postedBy.name} {timeAgo(o.createdAt)}
          </>
        ) : (
          <>Shared by a former member {timeAgo(o.createdAt)}</>
        )}
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-2 border-t border-line pt-5">
        {o.url && (
          <LinkButton href={o.url} external variant="primary">
            <ExternalLink className="size-4" /> Open the posting
          </LinkButton>
        )}
        {(o.postedByMe || typeof o.matchCount === "number") && (
          <>
            {onEdit && (
              <Button variant="ghost" onClick={() => onEdit(o)}>
                <Pencil className="size-4" /> Edit
              </Button>
            )}
            {confirm ? (
              <Button variant="danger" loading={deleting} onClick={del}>
                Delete for everyone
              </Button>
            ) : (
              <Button variant="quiet" onClick={() => setConfirm(true)}>
                <Trash2 className="size-4" /> Delete
              </Button>
            )}
          </>
        )}
      </div>
    </Modal>
  );
}
