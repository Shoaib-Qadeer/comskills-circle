"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import useSWR from "swr";
import { AnimatePresence, motion } from "motion/react";
import { toast } from "sonner";
import { Compass, Plus, Search } from "lucide-react";
import type { ExtractedDraft, OpportunityDTO } from "@/lib/types";
import { FIELDS, OPPORTUNITY_TYPES } from "@/lib/taxonomy";
import { api } from "@/lib/client";
import { Button, EmptyState, FieldChip, Input, Modal, PageHeader, Skeleton, cx } from "./ui";
import { OpportunityCard, OpportunityDetail } from "./OpportunityParts";
import { DraftEditor } from "./DraftEditor";

export function OpportunitiesView({ mode = "open" }: { mode?: "open" | "archive" }) {
  const params = useSearchParams();
  const router = useRouter();
  const status = mode;
  const basePath = mode === "archive" ? "/archive" : "/opportunities";
  const [field, setField] = useState<string | null>(null);
  const [type, setType] = useState<string>("");
  const [closingSoon, setClosingSoon] = useState(false);
  const [sort, setSort] = useState<"new" | "deadline">("new");
  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [openId, setOpenId] = useState<string | null>(params.get("open"));
  const [editing, setEditing] = useState<OpportunityDTO | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q), 250);
    return () => clearTimeout(t);
  }, [q]);

  const key = useMemo(() => {
    const s = new URLSearchParams({ status, sort });
    if (field) s.set("field", field);
    if (type) s.set("type", type);
    if (closingSoon) s.set("closingSoon", "1");
    if (debouncedQ) s.set("q", debouncedQ);
    return `/api/opportunities?${s}`;
  }, [status, sort, field, type, closingSoon, debouncedQ]);
  const { data, isLoading, mutate } = useSWR<{ items: OpportunityDTO[] }>(key, { keepPreviousData: true });

  // Deep link (?open=id) may point at something outside the current filter
  const { data: deepLinked } = useSWR<OpportunityDTO>(openId && !data?.items.some((o) => o.id === openId) ? `/api/opportunities/${openId}` : null);
  const openOpp = data?.items.find((o) => o.id === openId) ?? deepLinked ?? null;

  // Only offer field filters that actually appear on the board (remembered across filter changes)
  const [seenFields, setSeenFields] = useState<Set<string>>(new Set());
  useEffect(() => {
    if (!data) return;
    setSeenFields((prev) => {
      const next = new Set(prev);
      data.items.forEach((o) => o.fields.forEach((f) => next.add(f)));
      return next.size === prev.size ? prev : next;
    });
  }, [data]);
  const usedFields = useMemo(() => FIELDS.filter((f) => seenFields.has(f.slug) || f.slug === field), [seenFields, field]);

  function close() {
    setOpenId(null);
    if (params.get("open")) router.replace(basePath, { scroll: false });
  }

  return (
    <div>
      {mode === "open" ? (
        <PageHeader
          title="Opportunities"
          subtitle="Everything your class has shared that's still open. Past-deadline items move to the Archive automatically."
          action={
            <Link href="/opportunities/new" className="inline-flex h-10 items-center gap-2 rounded-full bg-brass px-4 text-sm font-medium text-brass-ink">
              <Plus className="size-4" /> Share
            </Link>
          }
        />
      ) : (
        <PageHeader title="Archive" subtitle="Opportunities whose deadline has passed. Kept for reference, and to spot programmes that come back every year." />
      )}

      <div className="mb-6 space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-52 flex-1">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-faint" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search title, organization, place…" className="pl-10" aria-label="Search opportunities" />
          </div>
          <select
            aria-label="Type"
            value={type}
            onChange={(e) => setType(e.target.value)}
            className="h-11 rounded-[var(--radius-field)] border border-line-strong bg-night-2 px-3 text-sm text-star focus:border-brass focus:outline-none"
          >
            <option value="">All types</option>
            {OPPORTUNITY_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
          {status === "open" && (
            <button
              onClick={() => setClosingSoon((v) => !v)}
              aria-pressed={closingSoon}
              className={cx("h-11 rounded-full border px-4 text-sm transition-colors", closingSoon ? "border-ember/60 bg-ember/10 text-ember" : "border-line-strong text-dim hover:text-star")}
            >
              Closing soon
            </button>
          )}
          <button onClick={() => setSort((s) => (s === "new" ? "deadline" : "new"))} className="h-11 rounded-full px-3 text-sm text-dim hover:text-star">
            Sort: {sort === "new" ? "Newest" : "Deadline"}
          </button>
        </div>
        <div className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:px-0">
          {usedFields.map((f) => (
            <FieldChip key={f.slug} slug={f.slug} size="sm" selected={field === f.slug} onClick={() => setField(field === f.slug ? null : f.slug)} />
          ))}
        </div>
      </div>

      {isLoading && !data ? (
        <div className="grid gap-4 md:grid-cols-2">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-52 rounded-[var(--radius-panel)]" />
          ))}
        </div>
      ) : !data?.items.length ? (
        <EmptyState
          icon={<Compass className="size-10" />}
          title={status === "archive" ? "Nothing in the archive" : field || type || q || closingSoon ? "Nothing matches these filters" : "Nothing shared yet"}
          action={
            status === "open" &&
            !(field || type || q || closingSoon) && (
              <Link href="/opportunities/new" className="inline-flex h-11 items-center rounded-full bg-brass px-5 font-medium text-brass-ink">
                Share the first one
              </Link>
            )
          }
        >
          {status === "archive" ? "Opportunities move here automatically after their deadline." : field || type || q || closingSoon ? "Try removing a filter." : "Found an internship worth passing on? It takes 30 seconds."}
        </EmptyState>
      ) : (
        <motion.div layout className="grid gap-4 md:grid-cols-2">
          <AnimatePresence mode="popLayout">
            {data.items.map((o, i) => (
              <OpportunityCard key={o.id} o={o} index={i} onOpen={() => setOpenId(o.id)} />
            ))}
          </AnimatePresence>
        </motion.div>
      )}

      <OpportunityDetail
        o={openOpp}
        open={Boolean(openId && openOpp)}
        onClose={close}
        onDeleted={() => mutate()}
        onEdit={(o) => {
          setOpenId(null);
          setEditing(o);
        }}
      />
      <EditModal o={editing} onClose={() => setEditing(null)} onSaved={() => mutate()} />
    </div>
  );
}

function EditModal({ o, onClose, onSaved }: { o: OpportunityDTO | null; onClose: () => void; onSaved: () => void }) {
  const [d, setD] = useState<ExtractedDraft | null>(null);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (o) {
      setD({
        url: o.url,
        title: o.title,
        organization: o.organization,
        location: o.location,
        remote: o.remote,
        type: o.type,
        deadline: o.deadline,
        startDate: o.startDate,
        durationMonths: o.durationMonths,
        paid: o.paid,
        frenchRequired: o.frenchRequired,
        fields: o.fields,
        tags: o.tags,
        eligibility: o.eligibility,
        summary: o.summary,
      });
      setNote(o.posterNote || "");
    }
  }, [o]);
  async function save() {
    if (!o || !d) return;
    setSaving(true);
    try {
      await api(`/api/opportunities/${o.id}`, "PATCH", { ...d, posterNote: note.trim() || null });
      toast.success("Saved");
      onSaved();
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save");
    } finally {
      setSaving(false);
    }
  }
  return (
    <Modal open={Boolean(o)} onClose={onClose} title="Edit opportunity" wide>
      {d && (
        <>
          <div className="mb-5">
            <label className="mb-1.5 block text-sm font-medium" htmlFor="e-url">
              Link
            </label>
            <Input id="e-url" value={d.url} onChange={(e) => setD({ ...d, url: e.target.value })} />
          </div>
          <DraftEditor d={d} onChange={setD} highlightMissing={false} />
          <div className="mt-5">
            <label className="mb-1.5 block text-sm font-medium" htmlFor="e-note">
              Your note
            </label>
            <Input id="e-note" maxLength={200} value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
          <div className="mt-6 flex justify-end gap-2">
            <Button variant="quiet" onClick={onClose}>
              Cancel
            </Button>
            <Button loading={saving} onClick={save}>
              Save changes
            </Button>
          </div>
        </>
      )}
    </Modal>
  );
}
