"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import useSWR from "swr";
import { AnimatePresence, motion } from "motion/react";
import { toast } from "sonner";
import { Compass, Plus, Search, X } from "lucide-react";
import type { ExtractedDraft, OpportunityDTO } from "@/lib/types";
import { DEGREE_LEVELS, FIELDS, OPPORTUNITY_TYPES } from "@/lib/taxonomy";
import { api } from "@/lib/client";
import { Button, EmptyState, FieldChip, Input, Modal, PageHeader, Skeleton, cx } from "./ui";
import { OpportunityCard, OpportunityDetail } from "./OpportunityParts";
import { DraftEditor } from "./DraftEditor";

type Facets = { types: string[]; fields: string[]; countries: string[] };
const selectCls = "h-11 min-w-0 rounded-[var(--radius-field)] border border-line-strong bg-night-2 px-3 text-sm text-star focus:border-brass focus:outline-none";

/** Opportunities board and the Archive. Filters live in the URL so a filtered list can be shared. */
export function OpportunitiesView({ mode = "open" }: { mode?: "open" | "archive" }) {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const status = mode;

  const type = params.get("type") || "";
  const field = params.get("field") || "";
  const country = params.get("country") || "";
  const degree = params.get("degree") || "";
  const closingSoon = params.get("soon") === "1";
  const sort = params.get("sort") === "deadline" ? "deadline" : "new";
  const mine = params.get("mine") === "1";
  const [q, setQ] = useState(params.get("q") || "");
  const openId = params.get("open");
  const [editing, setEditing] = useState<OpportunityDTO | null>(null);

  function setParam(updates: Record<string, string | null>) {
    const next = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(updates)) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  useEffect(() => {
    const t = setTimeout(() => {
      if ((params.get("q") || "") !== q.trim()) setParam({ q: q.trim() || null });
    }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const key = useMemo(() => {
    const s = new URLSearchParams({ status, sort });
    if (field) s.set("field", field);
    if (type) s.set("type", type);
    if (country) s.set("country", country);
    if (degree) s.set("degree", degree);
    if (closingSoon) s.set("closingSoon", "1");
    if (mine) s.set("mine", "1");
    const qq = params.get("q");
    if (qq) s.set("q", qq);
    return `/api/opportunities?${s}`;
  }, [status, sort, field, type, country, degree, closingSoon, mine, params]);
  const { data, error, isLoading, mutate } = useSWR<{ items: OpportunityDTO[]; facets: Facets }>(key, { keepPreviousData: true });

  // Deep link (?open=id) may point at something outside the current filter
  const { data: deepLinked } = useSWR<OpportunityDTO>(openId && data && !data.items.some((o) => o.id === openId) ? `/api/opportunities/${openId}` : null);
  const openOpp = data?.items.find((o) => o.id === openId) ?? deepLinked ?? null;

  const facets = data?.facets;
  const usedTypes = OPPORTUNITY_TYPES.filter((t) => facets?.types.includes(t.value) || t.value === type);
  const usedFields = FIELDS.filter((f) => facets?.fields.includes(f.slug) || f.slug === field);
  const countries = Array.from(new Set([...(facets?.countries ?? []), ...(country ? [country] : [])])).sort();
  const filtered = Boolean(field || type || country || degree || params.get("q") || closingSoon || mine);

  return (
    <div>
      {mode === "open" ? (
        <PageHeader
          title="Opportunities"
          subtitle="Scholarships, research, internships, jobs and events shared by members. Past-deadline items move to the Archive by themselves."
          action={
            <Link href="/opportunities/new" className="inline-flex h-11 items-center gap-2 rounded-full bg-brass px-4 text-sm font-medium text-brass-ink sm:h-10">
              <Plus className="size-4" /> Share
            </Link>
          }
        />
      ) : (
        <PageHeader title="Archive" subtitle="Opportunities whose deadline has passed. Handy for spotting programmes that come back every year." />
      )}

      <div className="mb-6 space-y-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-faint" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search title, organization, country…" className="pl-10" aria-label="Search opportunities" type="search" />
        </div>
        {usedTypes.length > 0 && (
          <div className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:px-0" role="group" aria-label="Type">
            <button onClick={() => setParam({ type: null })} aria-pressed={!type} className={cx("h-11 shrink-0 rounded-full border px-4 text-sm sm:h-9", !type ? "border-brass bg-brass/15 text-star" : "border-line-strong text-dim hover:text-star")}>
              All types
            </button>
            {usedTypes.map((t) => (
              <button
                key={t.value}
                onClick={() => setParam({ type: type === t.value ? null : t.value })}
                aria-pressed={type === t.value}
                className={cx("h-11 shrink-0 rounded-full border px-4 text-sm sm:h-9", type === t.value ? "border-brass bg-brass/15 text-star" : "border-line-strong text-dim hover:text-star")}
              >
                <span aria-hidden>{t.emoji}</span> {t.label}
              </button>
            ))}
          </div>
        )}
        <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center">
          <select aria-label="Country" value={country} onChange={(e) => setParam({ country: e.target.value || null })} className={selectCls}>
            <option value="">Any country</option>
            {countries.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <select aria-label="Degree level" value={degree} onChange={(e) => setParam({ degree: e.target.value || null })} className={selectCls}>
            <option value="">Any level</option>
            {DEGREE_LEVELS.filter((d) => d.value !== "any").map((d) => (
              <option key={d.value} value={d.value}>
                {d.label}
              </option>
            ))}
          </select>
          {status === "open" && (
            <button
              onClick={() => setParam({ soon: closingSoon ? null : "1" })}
              aria-pressed={closingSoon}
              className={cx("h-11 rounded-full border px-4 text-sm transition-colors", closingSoon ? "border-ember/60 bg-ember/10 text-ember" : "border-line-strong text-dim hover:text-star")}
            >
              Closing soon
            </button>
          )}
          <button
            onClick={() => setParam({ mine: mine ? null : "1" })}
            aria-pressed={mine}
            className={cx("h-11 rounded-full border px-4 text-sm transition-colors", mine ? "border-brass bg-brass/15 text-star" : "border-line-strong text-dim hover:text-star")}
          >
            Shared by me
          </button>
          <button onClick={() => setParam({ sort: sort === "new" ? "deadline" : null })} className="col-span-2 h-11 rounded-full px-3 text-left text-sm text-dim hover:text-star sm:col-span-1">
            Sort: {sort === "new" ? "Newest" : "Deadline"}
          </button>
        </div>
        {usedFields.length > 0 && (
          <div className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:px-0">
            {usedFields.map((f) => (
              <FieldChip key={f.slug} slug={f.slug} size="sm" selected={field === f.slug} onClick={() => setParam({ field: field === f.slug ? null : f.slug })} />
            ))}
          </div>
        )}
        {filtered && (
          <button
            onClick={() => {
              setQ("");
              router.replace(pathname, { scroll: false });
            }}
            className="inline-flex h-11 items-center gap-1.5 text-sm text-dim hover:text-star sm:h-8"
          >
            <X className="size-4" /> Clear filters
          </button>
        )}
      </div>

      {error && !data ? (
        <EmptyState icon={<Compass className="size-10" />} title="Couldn't load opportunities" action={<Button variant="ghost" onClick={() => mutate()}>Try again</Button>}>
          Check your connection and try again.
        </EmptyState>
      ) : isLoading && !data ? (
        <div className="grid gap-4 md:grid-cols-2">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-52 rounded-[var(--radius-panel)]" />
          ))}
        </div>
      ) : !data?.items.length ? (
        <EmptyState
          icon={<Compass className="size-10" />}
          title={status === "archive" ? "Nothing in the archive" : filtered ? "Nothing matches these filters" : "Nothing shared yet"}
          action={
            status === "open" &&
            !filtered && (
              <Link href="/opportunities/new" className="inline-flex h-11 items-center rounded-full bg-brass px-5 font-medium text-brass-ink">
                Share the first one
              </Link>
            )
          }
        >
          {status === "archive"
            ? "Opportunities move here by themselves after their deadline."
            : filtered
              ? "Try removing a filter."
              : "Found a scholarship or internship worth passing on? Paste the link and it takes about 30 seconds."}
        </EmptyState>
      ) : (
        <motion.div layout className="grid gap-4 md:grid-cols-2">
          <AnimatePresence mode="popLayout">
            {data.items.map((o, i) => (
              <OpportunityCard key={o.id} o={o} index={i} onOpen={() => setParam({ open: o.id })} />
            ))}
          </AnimatePresence>
        </motion.div>
      )}

      <OpportunityDetail
        o={openOpp}
        open={Boolean(openId && openOpp)}
        onClose={() => setParam({ open: null })}
        onDeleted={() => mutate()}
        onTracked={() => mutate()}
        onEdit={(o) => {
          setParam({ open: null });
          setEditing(o);
        }}
      />
      <EditModal o={editing} onClose={() => setEditing(null)} onSaved={() => mutate()} />
    </div>
  );
}

export function draftFromOpportunity(o: OpportunityDTO): ExtractedDraft {
  return {
    url: o.url,
    title: o.title,
    organization: o.organization,
    location: o.location,
    remote: o.remote,
    type: o.type,
    country: o.country,
    degreeLevel: o.degreeLevel,
    funding: o.funding,
    deadline: o.deadline ? o.deadline.slice(0, 10) : null,
    startDate: o.startDate ? o.startDate.slice(0, 10) : null,
    durationMonths: o.durationMonths,
    paid: o.paid,
    fields: o.fields,
    tags: o.tags,
    eligibility: o.eligibility,
    summary: o.summary,
  };
}

function EditModal({ o, onClose, onSaved }: { o: OpportunityDTO | null; onClose: () => void; onSaved: () => void }) {
  const [d, setD] = useState<ExtractedDraft | null>(null);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (o) {
      setD(draftFromOpportunity(o));
      setNote(o.posterNote || "");
    }
  }, [o]);
  async function save() {
    if (!o || !d) return;
    if (d.title.trim().length < 2) return toast.error("Add a title.");
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
            <Input id="e-url" type="url" inputMode="url" value={d.url} onChange={(e) => setD({ ...d, url: e.target.value })} />
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
