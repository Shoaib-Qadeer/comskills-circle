"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import useSWR from "swr";
import { AnimatePresence, motion } from "motion/react";
import { toast } from "sonner";
import { ArrowRight, GraduationCap, MoreHorizontal, Pencil, Plus, Trash2 } from "lucide-react";
import type { ScholarshipStage } from "@/lib/types";
import type { ScholarshipDTO } from "@/lib/scholarships";
import { api } from "@/lib/client";
import { Button, EmptyState, ErrorText, Modal, PageHeader, Segmented, Skeleton, cx } from "../ui";
import {
  BasicsFields,
  draftFromEntry,
  draftProblem,
  draftToBody,
  emptyDraft,
  EntryCard,
  STAGE_HINT,
  STAGE_LABEL,
  STAGES,
  StageFields,
  VisibilityChoice,
  type EntryDraft,
} from "./ScholarshipParts";

async function celebrate() {
  try {
    const confetti = (await import("canvas-confetti")).default;
    confetti({ particleCount: 140, spread: 90, origin: { y: 0.6 }, colors: ["#5eead4", "#f2c14e", "#a78bfa", "#eef0ff"], disableForReducedMotion: true });
  } catch {}
}

export function ScholarshipsView() {
  const { data, error, isLoading, mutate } = useSWR<{ items: ScholarshipDTO[] }>("/api/scholarships");
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const [stage, setStage] = useState<ScholarshipStage>("applying");
  const [adding, setAdding] = useState<ScholarshipStage | null>(null);
  const [moving, setMoving] = useState<ScholarshipDTO | null>(null);
  const [editing, setEditing] = useState<ScholarshipDTO | null>(null);
  const [deleting, setDeleting] = useState<ScholarshipDTO | null>(null);

  // "+ → Add a scholarship" lands here with ?add=1
  useEffect(() => {
    if (params.get("add") === "1") {
      setAdding("applying");
      router.replace(pathname, { scroll: false });
    }
  }, [params, router, pathname]);

  const items = data?.items ?? [];
  const by = useMemo(() => {
    const m: Record<ScholarshipStage, ScholarshipDTO[]> = { applying: [], applied: [], rejected: [], accepted: [] };
    items.forEach((e) => m[e.stage].push(e));
    // Applying: soonest deadline first
    m.applying.sort((a, b) => (a.deadline ?? "9999").localeCompare(b.deadline ?? "9999"));
    return m;
  }, [items]);

  const column = (s: ScholarshipStage) => (
    <section aria-labelledby={`col-${s}`} className="min-w-0">
      <h2 id={`col-${s}`} className="mb-3 hidden items-baseline gap-2 font-display text-lg font-semibold lg:flex">
        {STAGE_LABEL[s]} <span className="tabular text-sm font-normal text-faint">{by[s].length}</span>
      </h2>
      {by[s].length === 0 ? (
        <div className="rounded-2xl border border-dashed border-line-strong p-5 text-center text-sm text-dim">
          <p>{s === "applying" ? "Nothing here yet. Add the first scholarship you're working on!" : s === "accepted" ? "Your wins will show here. You've got this." : `No ${STAGE_LABEL[s].toLowerCase()} entries.`}</p>
          {s === "applying" && (
            <Button size="sm" variant="ghost" className="mt-3" onClick={() => setAdding("applying")}>
              <Plus className="size-3.5" /> Add scholarship
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          <AnimatePresence initial={false}>
            {by[s].map((e) => (
              <EntryCard
                key={e.id}
                e={e}
                actions={
                  <>
                    <Button size="sm" variant="ghost" onClick={() => setMoving(e)}>
                      Move to… <ArrowRight className="size-3.5" />
                    </Button>
                    <EntryMenu onEdit={() => setEditing(e)} onDelete={() => setDeleting(e)} />
                  </>
                }
              />
            ))}
          </AnimatePresence>
        </div>
      )}
    </section>
  );

  return (
    <div>
      <PageHeader
        title="Scholarships"
        subtitle="Track every application from first draft to the result. Applying, applied and accepted entries show on your profile; rejections stay between you and the team unless you choose otherwise."
        action={
          <Button onClick={() => setAdding(stage)}>
            <Plus className="size-4" /> Add scholarship
          </Button>
        }
      />

      {error && !data ? (
        <EmptyState icon={<GraduationCap className="size-10" />} title="Couldn't load your tracker" action={<Button variant="ghost" onClick={() => mutate()}>Try again</Button>}>
          Check your connection and try again.
        </EmptyState>
      ) : isLoading && !data ? (
        <div className="grid gap-3 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-40 rounded-2xl" />
          ))}
        </div>
      ) : (
        <>
          {/* Phones: one stage at a time */}
          <div className="lg:hidden">
            <div className="-mx-4 mb-4 overflow-x-auto px-4 [scrollbar-width:none]">
              <Segmented id="sc-stage" value={stage} onChange={setStage} options={STAGES.map((s) => ({ value: s, label: STAGE_LABEL[s], count: by[s].length }))} />
            </div>
            <p className="mb-3 text-sm text-faint">{STAGE_HINT[stage]}</p>
            <AnimatePresence mode="wait">
              <motion.div key={stage} initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }} transition={{ duration: 0.16 }}>
                {column(stage)}
              </motion.div>
            </AnimatePresence>
          </div>
          {/* Desktop: the four-column board */}
          <div className="hidden gap-4 lg:grid lg:grid-cols-4">{STAGES.map((s) => <div key={s}>{column(s)}</div>)}</div>
        </>
      )}

      <EntrySheet
        key={adding ? `add-${adding}` : editing ? `edit-${editing.id}` : "closed"}
        mode={editing ? "edit" : "add"}
        open={Boolean(adding || editing)}
        initial={editing ? draftFromEntry(editing) : emptyDraft(adding ?? "applying")}
        id={editing?.id}
        onClose={() => {
          setAdding(null);
          setEditing(null);
        }}
        onSaved={(e) => {
          mutate();
          setStage(e.stage);
          if (e.stage === "accepted") celebrate();
        }}
      />
      <MoveSheet
        entry={moving}
        onClose={() => setMoving(null)}
        onMoved={(e) => {
          mutate();
          setStage(e.stage);
          if (e.stage === "accepted") {
            celebrate();
            toast.success("Congratulations! 🎉");
          } else toast.success(`Moved to ${STAGE_LABEL[e.stage]}`);
        }}
      />
      <DeleteSheet entry={deleting} onClose={() => setDeleting(null)} onDeleted={() => mutate()} />
    </div>
  );
}

function EntryMenu({ onEdit, onDelete }: { onEdit: () => void; onDelete: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative ml-auto">
      <Button size="sm" variant="quiet" aria-label="More actions" aria-expanded={open} aria-haspopup="menu" onClick={() => setOpen((v) => !v)}>
        <MoreHorizontal className="size-4" />
      </Button>
      <AnimatePresence>
        {open && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} aria-hidden />
            <motion.div role="menu" initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="absolute right-0 top-full z-20 mt-1 w-44 rounded-2xl border border-line-strong bg-raised p-1 shadow-2xl">
              <button
                role="menuitem"
                onClick={() => {
                  setOpen(false);
                  onEdit();
                }}
                className="flex min-h-11 w-full items-center gap-2 rounded-xl px-3 text-sm hover:bg-raised-2"
              >
                <Pencil className="size-4 text-dim" /> Edit details
              </button>
              <button
                role="menuitem"
                onClick={() => {
                  setOpen(false);
                  onDelete();
                }}
                className="flex min-h-11 w-full items-center gap-2 rounded-xl px-3 text-sm text-ember hover:bg-raised-2"
              >
                <Trash2 className="size-4" /> Delete
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

function EntrySheet({ open, mode, initial, id, onClose, onSaved }: { open: boolean; mode: "add" | "edit"; initial: EntryDraft; id?: string; onClose: () => void; onSaved: (e: ScholarshipDTO) => void }) {
  const [d, setD] = useState<EntryDraft>(initial);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const set = <K extends keyof EntryDraft>(k: K, v: EntryDraft[K]) => setD((p) => ({ ...p, [k]: v }));
  async function save() {
    const p = draftProblem(d, true);
    if (p) return setErr(p);
    setErr(null);
    setBusy(true);
    try {
      const body = draftToBody(d, { basics: true });
      const e = mode === "add" ? await api<ScholarshipDTO>("/api/scholarships", "POST", body) : await api<ScholarshipDTO>(`/api/scholarships/${id}`, "PATCH", body);
      toast.success(mode === "add" ? "Added to your tracker" : "Saved");
      onSaved(e);
      onClose();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Couldn't save. Try again.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal open={open} onClose={onClose} title={mode === "add" ? "Add a scholarship" : "Edit entry"}>
      <div className="space-y-5">
        <BasicsFields d={d} set={set} />
        {mode === "add" && (
          <div>
            <p className="mb-1.5 text-sm font-medium">Stage</p>
            <div className="-mx-1 overflow-x-auto px-1 [scrollbar-width:none]">
              <Segmented
                id="sc-add-stage"
                value={d.stage}
                onChange={(s) => setD((p) => ({ ...emptyDraft(s), name: p.name, country: p.country, link: p.link }))}
                options={STAGES.map((s) => ({ value: s, label: STAGE_LABEL[s] }))}
              />
            </div>
          </div>
        )}
        <StageFields d={d} set={set} />
      </div>
      <ErrorText>{err}</ErrorText>
      <div className="mt-6 flex justify-end gap-2">
        <Button variant="quiet" onClick={onClose}>
          Cancel
        </Button>
        <Button loading={busy} onClick={save}>
          {mode === "add" ? "Add" : "Save"}
        </Button>
      </div>
    </Modal>
  );
}

function MoveSheet({ entry, onClose, onMoved }: { entry: ScholarshipDTO | null; onClose: () => void; onMoved: (e: ScholarshipDTO) => void }) {
  const [d, setD] = useState<EntryDraft | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!entry) return setD(null);
    const next = STAGES[Math.min(STAGES.indexOf(entry.stage) + 1, 3)];
    const base = draftFromEntry(entry);
    setD({ ...base, ...stageDefaults(next, base) });
    setErr(null);
  }, [entry]);
  if (!entry || !d) return <Modal open={false} onClose={onClose} title="">{null}</Modal>;
  const set = <K extends keyof EntryDraft>(k: K, v: EntryDraft[K]) => setD((p) => (p ? { ...p, [k]: v } : p));
  async function move() {
    if (!d || !entry) return;
    if (d.stage === entry.stage) return setErr("Choose a different stage.");
    const p = draftProblem(d, false);
    if (p) return setErr(p);
    setBusy(true);
    setErr(null);
    try {
      const e = await api<ScholarshipDTO>(`/api/scholarships/${entry.id}`, "PATCH", draftToBody(d, { basics: false }));
      onMoved(e);
      onClose();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Couldn't move it. Try again.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal open onClose={onClose} title={`Move “${entry.name}”`}>
      <p className="mb-2 text-sm font-medium">To</p>
      <div className="grid grid-cols-2 gap-2">
        {STAGES.filter((s) => s !== entry.stage).map((s) => (
          <button
            key={s}
            type="button"
            aria-pressed={d.stage === s}
            onClick={() => setD((p) => (p ? { ...p, stage: s, ...stageDefaults(s, p) } : p))}
            className={cx("h-11 rounded-full border text-sm", d.stage === s ? "border-brass bg-brass/15 text-star" : "border-line-strong text-dim hover:text-star")}
          >
            {STAGE_LABEL[s]}
          </button>
        ))}
      </div>
      <div className="mt-5">
        <StageFields d={d} set={set} />
      </div>
      <ErrorText>{err}</ErrorText>
      <div className="mt-6 flex justify-end gap-2">
        <Button variant="quiet" onClick={onClose}>
          Cancel
        </Button>
        <Button loading={busy} onClick={move} disabled={d.stage === entry.stage}>
          Move to {STAGE_LABEL[d.stage]}
        </Button>
      </div>
      {entry.stage === "rejected" && (
        <div className="mt-6 border-t border-line pt-4">
          <ChangeVisibility entry={entry} onChanged={() => onMoved(entry)} />
        </div>
      )}
    </Modal>
  );
}

/** Sensible defaults when moving into a stage (e.g. "submitted today"). */
function stageDefaults(s: ScholarshipStage, cur: EntryDraft): Partial<EntryDraft> {
  const today = emptyDraft(s);
  if (s === "applied") return { submittedAt: cur.submittedAt || today.submittedAt };
  if (s === "rejected") return { rejectedAt: cur.rejectedAt || today.rejectedAt };
  return {};
}

function ChangeVisibility({ entry, onChanged }: { entry: ScholarshipDTO; onChanged: () => void }) {
  const [v, setV] = useState(entry.rejectedVisibility);
  async function save(next: "team" | "members") {
    setV(next);
    try {
      await api(`/api/scholarships/${entry.id}`, "PATCH", { rejectedVisibility: next });
      toast.success(next === "team" ? "Now only you and the team can see it" : "Now visible to all members");
      onChanged();
    } catch (e) {
      setV(entry.rejectedVisibility);
      toast.error(e instanceof Error ? e.message : "Couldn't change it.");
    }
  }
  return (
    <div>
      <p className="mb-2 text-sm text-dim">Or keep it here and change who can see it:</p>
      <VisibilityChoice value={v} onChange={save} />
    </div>
  );
}

function DeleteSheet({ entry, onClose, onDeleted }: { entry: ScholarshipDTO | null; onClose: () => void; onDeleted: () => void }) {
  const [busy, setBusy] = useState(false);
  async function del() {
    if (!entry) return;
    setBusy(true);
    try {
      await api(`/api/scholarships/${entry.id}`, "DELETE");
      toast.success("Deleted");
      onDeleted();
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't delete.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal open={Boolean(entry)} onClose={onClose} title="Delete this entry?">
      <p className="text-sm text-dim">“{entry?.name}” will be removed from your tracker and your profile. This can't be undone.</p>
      <div className="mt-6 flex justify-end gap-2">
        <Button variant="quiet" onClick={onClose}>
          Cancel
        </Button>
        <Button variant="danger" loading={busy} onClick={del}>
          Delete
        </Button>
      </div>
    </Modal>
  );
}
