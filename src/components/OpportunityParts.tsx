"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "motion/react";
import { toast } from "sonner";
import { mutate as globalMutate } from "swr";
import { BookmarkPlus, Building2, Calendar, CheckCircle2, Clock, ExternalLink, GraduationCap, Globe2, MapPin, Pencil, Sparkles, Trash2, Wallet, Wifi } from "lucide-react";
import type { OpportunityDTO } from "@/lib/types";
import { degreeLabel, fundingLabel, oppTypeEmoji, oppTypeLabel, PAID_TYPES, TRACKABLE_TYPES } from "@/lib/taxonomy";
import { api, ClientError, formatDate, timeAgo } from "@/lib/client";
import { opportunityShareText } from "@/lib/share-text";
import { DeadlinePill, OrgMark, WarningChips, CountUp } from "./bits";
import { Avatar, Button, FieldChip, LinkButton, Modal, Tag, cx } from "./ui";
import { ShareButtons, absoluteUrl } from "./ShareButtons";

export const typeLabel = oppTypeLabel;
export const remoteLabel = (r: string | null) => (r === "remote" ? "Online" : r === "hybrid" ? "Hybrid" : r === "onsite" ? "On site" : null);

/** "Germany · Munich · Online" with duplicates removed. */
function placeText(o: Pick<OpportunityDTO, "country" | "location" | "remote">) {
  const parts = [o.country, o.location, remoteLabel(o.remote)].filter((x): x is string => Boolean(x && x.trim()));
  const seen = new Set<string>();
  return parts.filter((p) => (seen.has(p.toLowerCase()) ? false : (seen.add(p.toLowerCase()), true))).join(" · ");
}

export function OppMeta({ o, className }: { o: OpportunityDTO; className?: string }) {
  const place = placeText(o);
  return (
    <div className={cx("flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-sm text-dim", className)}>
      {o.organization && <span className="min-w-0 truncate">{o.organization}</span>}
      {place && (
        <span className="flex min-w-0 items-center gap-1">
          {o.remote === "remote" && !o.country ? <Wifi className="size-3.5 shrink-0" /> : <MapPin className="size-3.5 shrink-0" />}
          <span className="truncate">{place}</span>
        </span>
      )}
    </div>
  );
}

/** Small facts shown on the card: degree levels and funding (for funded types) or paid/unpaid. */
function KeyFacts({ o }: { o: OpportunityDTO }) {
  const facts: { text: string; tone: "aurora" | "neutral" | "brass" }[] = [];
  if (o.degreeLevel.length) {
    const labels = o.degreeLevel.map(degreeLabel);
    facts.push({ text: labels.length > 2 ? `${labels.slice(0, 2).join(", ")} +${labels.length - 2}` : labels.join(", "), tone: "neutral" });
  }
  if (o.funding === "full") facts.push({ text: "Fully funded", tone: "aurora" });
  else if (o.funding === "partial") facts.push({ text: "Partly funded", tone: "brass" });
  else if (o.funding === "none") facts.push({ text: "Not funded", tone: "neutral" });
  if (PAID_TYPES.includes(o.type) && o.paid === true) facts.push({ text: "Paid", tone: "aurora" });
  if (!facts.length) return null;
  return (
    <div className="flex flex-wrap gap-1.5">
      {facts.map((f) => (
        <Tag key={f.text} tone={f.tone}>
          {f.text}
        </Tag>
      ))}
    </div>
  );
}

/** Card used in the Opportunities grid. Clicking opens the detail sheet. */
export function OpportunityCard({ o, onOpen, index = 0 }: { o: OpportunityDTO; onOpen: () => void; index?: number }) {
  const important = o.warnings.filter((w) => w.kind === "unpaid" || w.kind === "funding_unknown");
  return (
    <motion.button
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={{ delay: Math.min(index, 12) * 0.04, type: "spring", stiffness: 260, damping: 26 }}
      onClick={onOpen}
      className="group flex w-full min-w-0 flex-col rounded-[var(--radius-panel)] border border-line bg-raised/80 p-4 text-left transition-colors hover:border-line-strong hover:bg-raised sm:p-5"
    >
      <div className="flex w-full items-start gap-3">
        <OrgMark name={o.organization} url={o.url} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <span className="truncate text-xs text-faint">
              <span aria-hidden>{oppTypeEmoji(o.type)}</span> {typeLabel(o.type)}
            </span>
            <span className="shrink-0">
              <DeadlinePill deadline={o.deadline} />
            </span>
          </div>
          <h3 className="mt-0.5 font-display text-lg font-semibold leading-snug group-hover:text-brass">{o.title}</h3>
          <OppMeta o={o} className="mt-1" />
        </div>
      </div>
      <div className="mt-3 space-y-2">
        <KeyFacts o={o} />
        <WarningChips warnings={important} />
      </div>
      {o.fields.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {o.fields.slice(0, 3).map((f) => (
            <FieldChip key={f} slug={f} size="sm" />
          ))}
        </div>
      )}
      <div className="mt-auto flex items-center gap-2 pt-4 text-xs text-faint">
        {o.postedBy ? (
          <>
            <Avatar name={o.postedBy.name} src={o.postedBy.photoUrl} size={18} />
            <span className="min-w-0 truncate">
              {o.postedByMe ? "You" : o.postedBy.name} shared this {timeAgo(o.createdAt)}
            </span>
          </>
        ) : (
          <>Shared by a former member {timeAgo(o.createdAt)}</>
        )}
        {o.trackedId && (
          <span className="ml-auto flex shrink-0 items-center gap-1 text-aurora">
            <CheckCircle2 className="size-3.5" /> Tracking
          </span>
        )}
      </div>
    </motion.button>
  );
}

function Fact({ icon: Icon, label, value }: { icon: typeof Clock; label: string; value: React.ReactNode }) {
  return (
    <div className="flex min-w-0 items-start gap-3">
      <Icon className="mt-0.5 size-4 shrink-0 text-faint" />
      <div className="min-w-0">
        <p className="text-xs text-faint">{label}</p>
        <p className="text-sm">{value}</p>
      </div>
    </div>
  );
}

/** "Track this" on scholarships and fellowships: adds an Applying entry to your tracker. */
export function TrackButton({ o, onTracked, className }: { o: Pick<OpportunityDTO, "id" | "type" | "trackedId" | "status">; onTracked?: (id: string) => void; className?: string }) {
  const [trackedId, setTrackedId] = useState(o.trackedId ?? null);
  const [busy, setBusy] = useState(false);
  useEffect(() => setTrackedId(o.trackedId ?? null), [o.trackedId]);
  if (!TRACKABLE_TYPES.includes(o.type) || o.status === "expired") return null;
  if (trackedId)
    return (
      <LinkButton href="/scholarships" variant="ghost" className={className}>
        <CheckCircle2 className="size-4 text-aurora" /> In your tracker
      </LinkButton>
    );
  async function track() {
    setBusy(true);
    try {
      const r = await api<{ id: string }>(`/api/opportunities/${o.id}/track`, "POST");
      setTrackedId(r.id);
      onTracked?.(r.id);
      globalMutate((k) => typeof k === "string" && (k.startsWith("/api/scholarships") || k.startsWith("/api/opportunities")));
      toast.success("Added to your tracker as Applying", { action: { label: "Open", onClick: () => (window.location.href = "/scholarships") } });
    } catch (e) {
      if (e instanceof ClientError && e.status === 409) {
        setTrackedId("existing");
        toast("You're already tracking this one.");
      } else toast.error(e instanceof Error ? e.message : "Couldn't add it.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <Button variant="ghost" loading={busy} onClick={track} className={className}>
      <BookmarkPlus className="size-4" /> Track this
    </Button>
  );
}

export function OpportunityDetail({
  o,
  open,
  onClose,
  onDeleted,
  onEdit,
  onTracked,
}: {
  o: OpportunityDTO | null;
  open: boolean;
  onClose: () => void;
  onDeleted?: () => void;
  onEdit?: (o: OpportunityDTO) => void;
  onTracked?: () => void;
}) {
  const [deleting, setDeleting] = useState(false);
  const [confirm, setConfirm] = useState(false);
  useEffect(() => setConfirm(false), [o?.id]);
  if (!o) return <Modal open={false} onClose={onClose} title="">{null}</Modal>;
  const place = placeText(o);
  const shareUrl = absoluteUrl(`/opportunities?open=${o.id}`);
  const canManage = o.postedByMe || typeof o.matchCount === "number";
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
        <Tag>
          <span aria-hidden>{oppTypeEmoji(o.type)}</span> {typeLabel(o.type)}
        </Tag>
        {o.status === "expired" ? <Tag tone="ember">Closed</Tag> : <DeadlinePill deadline={o.deadline} />}
      </div>

      {o.postedByMe && typeof o.matchCount === "number" && (
        <div className="mb-5 flex items-center gap-3 rounded-2xl border border-brass/30 bg-brass/[0.07] p-4">
          <Sparkles className="size-5 shrink-0 text-brass" />
          <p className="text-sm">
            Relevant to <CountUp value={o.matchCount} className="font-semibold text-brass" /> member{o.matchCount === 1 ? "" : "s"}
            <span className="text-dim">. Comskills Circle never shows you who.</span>
          </p>
        </div>
      )}

      {o.summary && <p className="leading-relaxed text-dim">{o.summary}</p>}

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        {o.organization && <Fact icon={Building2} label="Organization" value={o.organization} />}
        {place && <Fact icon={o.country ? Globe2 : MapPin} label="Where" value={place} />}
        <Fact icon={Calendar} label="Deadline" value={o.deadline ? formatDate(o.deadline) : "Not stated"} />
        {o.startDate && <Fact icon={Calendar} label="Starts" value={formatDate(o.startDate)} />}
        {o.degreeLevel.length > 0 && <Fact icon={GraduationCap} label="For" value={o.degreeLevel.map(degreeLabel).join(", ")} />}
        {PAID_TYPES.includes(o.type) ? (
          <Fact icon={Wallet} label="Paid" value={o.paid == null ? "Not stated" : o.paid ? "Yes" : "No"} />
        ) : (
          <Fact icon={Wallet} label="Funding" value={fundingLabel(o.funding)} />
        )}
        {o.durationMonths != null && <Fact icon={Clock} label="Duration" value={`${o.durationMonths} month${o.durationMonths === 1 ? "" : "s"}`} />}
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

      {o.posterNote && <blockquote className="mt-6 border-l-2 border-brass pl-4 text-sm italic text-dim">“{o.posterNote}”</blockquote>}

      <div className="mt-6 flex items-center gap-2 text-sm text-faint">
        {o.postedBy ? (
          <>
            <Avatar name={o.postedBy.name} src={o.postedBy.photoUrl} size={22} />
            <span>
              Shared by{" "}
              {o.postedByMe ? (
                "you"
              ) : (
                <Link href={`/members/${o.postedBy.id}`} className="text-dim underline-offset-2 hover:underline">
                  {o.postedBy.name}
                </Link>
              )}{" "}
              {timeAgo(o.createdAt)}
            </span>
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
        <TrackButton o={o} onTracked={onTracked} />
      </div>
      <ShareButtons className="mt-3" text={opportunityShareText(o, shareUrl)} url={shareUrl} />

      {canManage && (
        <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-line pt-4">
          {onEdit && (
            <Button variant="ghost" onClick={() => onEdit(o)}>
              <Pencil className="size-4" /> Edit
            </Button>
          )}
          {confirm ? (
            <>
              <Button variant="danger" loading={deleting} onClick={del}>
                Delete for everyone
              </Button>
              <Button variant="quiet" onClick={() => setConfirm(false)}>
                Keep it
              </Button>
            </>
          ) : (
            <Button variant="quiet" onClick={() => setConfirm(true)}>
              <Trash2 className="size-4" /> Delete
            </Button>
          )}
        </div>
      )}
    </Modal>
  );
}
