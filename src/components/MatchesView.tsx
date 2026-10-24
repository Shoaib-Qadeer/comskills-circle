"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import useSWR, { mutate as globalMutate } from "swr";
import { AnimatePresence, motion } from "motion/react";
import { toast } from "sonner";
import { Check, CircleAlert, ExternalLink, Heart, Lightbulb, Sparkles, Telescope, X, Target } from "lucide-react";
import type { CoachAdvice, ConnectionDTO, MatchDTO } from "@/lib/types";
import { api, daysLeft, firstName } from "@/lib/client";
import { CountUp, DeadlinePill, OrgMark, ScoreRing, WarningChips } from "./bits";
import { Button, EmptyState, FieldChip, LinkButton, Segmented, Skeleton, cx } from "./ui";
import { OppMeta, OpportunityDetail } from "./OpportunityParts";
import { ConnectionCard, RequestIntroModal } from "./ConnectionParts";

type Tab = "new" | "saved" | "all";

function greeting() {
  const h = new Date().getHours();
  return h < 5 ? "Still up" : h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
}

export function MatchesView({ name }: { name: string }) {
  const params = useSearchParams();
  const [tab, setTab] = useState<Tab>("all");
  const { data, mutate, isLoading } = useSWR<{ items: MatchDTO[] }>(`/api/matches?filter=all`);
  const { data: suggested, mutate: mutateSuggested } = useSWR<{ items: ConnectionDTO[] }>("/api/connections/suggested");
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [open, setOpen] = useState<MatchDTO | null>(null);
  const [intro, setIntro] = useState<ConnectionDTO | null>(null);
  // Snapshot of what was unseen when the page opened, so "New" doesn't empty while you read it
  const [newIds, setNewIds] = useState<Set<string> | null>(null);
  const markedRef = useRef(false);

  useEffect(() => {
    if (params.get("welcome") === "1") toast.success("You're in. Here's what fits you so far.");
  }, [params]);

  useEffect(() => {
    if (!data || markedRef.current) return;
    const unseen = data.items.filter((m) => !m.seen);
    setNewIds(new Set(unseen.map((m) => m.id)));
    if (unseen.length) setTab("new");
    markedRef.current = true;
    if (unseen.length) {
      const t = setTimeout(async () => {
        await Promise.all(unseen.map((m) => api(`/api/matches/${m.id}`, "PATCH", { seen: true }).catch(() => null)));
        globalMutate("/api/notifications");
      }, 1500);
      return () => clearTimeout(t);
    }
  }, [data]);

  const all = useMemo(() => (data?.items ?? []).filter((m) => !hidden.has(m.id)), [data, hidden]);
  const list = tab === "new" ? all.filter((m) => newIds?.has(m.id)) : tab === "saved" ? all.filter((m) => m.saved) : all;
  const closingSoon = all.filter((m) => {
    const n = daysLeft(m.opportunity.deadline);
    return n !== null && n >= 0 && n <= 14;
  }).length;

  async function toggleSave(m: MatchDTO) {
    const saved = !m.saved;
    mutate((d) => (d ? { items: d.items.map((x) => (x.id === m.id ? { ...x, saved } : x)) } : d), { revalidate: false });
    try {
      await api(`/api/matches/${m.id}`, "PATCH", { saved });
      if (saved) toast.success("Saved");
    } catch {
      mutate();
    }
  }

  async function dismiss(m: MatchDTO) {
    setHidden((h) => new Set(h).add(m.id));
    try {
      await api(`/api/matches/${m.id}`, "PATCH", { dismissed: true });
      toast("Dismissed", {
        action: {
          label: "Undo",
          onClick: async () => {
            await api(`/api/matches/${m.id}`, "PATCH", { dismissed: false });
            setHidden((h) => {
              const n = new Set(h);
              n.delete(m.id);
              return n;
            });
          },
        },
      });
    } catch {
      setHidden((h) => {
        const n = new Set(h);
        n.delete(m.id);
        return n;
      });
    }
  }

  return (
    <div className="grid gap-10 xl:grid-cols-[1fr_320px]">
      <div className="min-w-0">
        <header className="mb-8">
          <h1 className="font-display text-3xl font-semibold sm:text-4xl">
            {greeting()}, {name}.
          </h1>
          <div className="mt-4 flex flex-wrap gap-x-6 gap-y-1">
            <Stat value={newIds?.size ?? 0} label={newIds?.size === 1 ? "new match" : "new matches"} tone="brass" loading={!data} />
            <Stat value={closingSoon} label="closing within 2 weeks" tone="ember" loading={!data} />
            <Stat value={all.filter((m) => m.saved).length} label="saved" tone="dim" loading={!data} />
          </div>
        </header>

        <Segmented
          id="matches"
          value={tab}
          onChange={setTab}
          className="mb-6"
          options={[
            { value: "new", label: "New", count: newIds?.size },
            { value: "saved", label: "Saved", count: all.filter((m) => m.saved).length },
            { value: "all", label: "All", count: all.length },
          ]}
        />

        {isLoading ? (
          <div className="space-y-4">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-40 rounded-[var(--radius-panel)]" />
            ))}
          </div>
        ) : list.length === 0 ? (
          <EmptyState
            icon={<Telescope className="size-10" />}
            title={tab === "saved" ? "Nothing saved yet" : tab === "new" ? "You're all caught up" : "No matches yet"}
            action={
              tab === "all" && (
                <Link href="/opportunities/new" className="inline-flex h-11 items-center rounded-full bg-brass px-5 font-medium text-brass-ink">
                  Share an opportunity
                </Link>
              )
            }
          >
            {tab === "saved"
              ? "Tap the heart on a match to keep it here."
              : tab === "new"
                ? "New matches appear here as classmates share opportunities."
                : "The more your class shares, the more you'll see. Start by sharing one yourself."}
          </EmptyState>
        ) : (
          <motion.ul layout className="space-y-4">
            <AnimatePresence initial={true} mode="popLayout">
              {list.map((m, i) => (
                <MatchCard key={m.id} m={m} index={i} onOpen={() => setOpen(m)} onSave={() => toggleSave(m)} onDismiss={() => dismiss(m)} />
              ))}
            </AnimatePresence>
          </motion.ul>
        )}
      </div>

      <aside className="xl:pt-2">
        <h2 className="font-display text-lg font-semibold">People in your network</h2>
        <p className="mb-4 mt-1 text-sm text-dim">Contacts classmates shared in your fields.</p>
        {!suggested ? (
          <Skeleton className="h-36 rounded-[var(--radius-panel)]" />
        ) : suggested.items.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-line-strong p-4 text-sm text-dim">
            No one yet. Know someone useful?{" "}
            <Link href="/connections" className="text-brass underline-offset-2 hover:underline">
              Add them to the class network
            </Link>
            .
          </p>
        ) : (
          <div className="space-y-3">
            {suggested.items.slice(0, 4).map((c, i) => (
              <ConnectionCard key={c.id} c={c} index={i} compact onRequest={setIntro} />
            ))}
            <Link href="/connections" className="block pt-1 text-sm text-brass hover:underline">
              See all connections
            </Link>
          </div>
        )}
      </aside>

      <OpportunityDetail o={open?.opportunity ?? null} open={Boolean(open)} onClose={() => setOpen(null)} />
      <RequestIntroModal c={intro} onClose={() => setIntro(null)} onSent={() => mutateSuggested()} />
    </div>
  );
}

function Stat({ value, label, tone, loading }: { value: number; label: string; tone: "brass" | "ember" | "dim"; loading?: boolean }) {
  return (
    <div className="flex items-baseline gap-2">
      <span className={cx("font-display text-3xl font-semibold", tone === "brass" ? "text-brass" : tone === "ember" ? "text-ember" : "text-star")}>
        {loading ? "–" : <CountUp value={value} />}
      </span>
      <span className="text-sm text-dim">{label}</span>
    </div>
  );
}

function MatchCard({ m, index, onOpen, onSave, onDismiss }: { m: MatchDTO; index: number; onOpen: () => void; onSave: () => void; onDismiss: () => void }) {
  const o = m.opportunity;
  const [coachOpen, setCoachOpen] = useState(false);
  const tagged = m.source === "tagged";
  const strongAuto = !tagged || m.score >= 60;
  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0, transition: { delay: Math.min(index, 10) * 0.04, type: "spring", stiffness: 260, damping: 26 } }}
      exit={{ opacity: 0, x: 80, transition: { duration: 0.22 } }}
      className={cx(
        "relative overflow-hidden rounded-[var(--radius-panel)] border bg-raised/80 p-5 sm:p-6",
        tagged ? "border-brass/50 shadow-[0_0_0_1px_var(--glow),0_20px_50px_-30px_var(--glow)]" : "border-line",
      )}
    >
      {tagged && m.taggedBy && (
        <div className="-mx-5 -mt-5 mb-5 flex items-center gap-2 border-b border-brass/25 bg-brass/[0.08] px-5 py-2.5 text-sm sm:-mx-6 sm:-mt-6 sm:px-6">
          <Target className="size-4 text-brass" />
          <span>
            <span className="font-medium text-brass">{firstName(m.taggedBy.name)} thought of you</span>
            {m.taggedNote && <span className="text-dim"> — “{m.taggedNote}”</span>}
          </span>
        </div>
      )}
      <div className="flex gap-4">
        <div className="hidden sm:block">{strongAuto ? <ScoreRing score={m.score} /> : <OrgMark name={o.organization} url={o.url} />}</div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <button onClick={onOpen} className="text-left">
              <h3 className="font-display text-xl font-semibold leading-snug hover:text-brass">{o.title}</h3>
            </button>
            <div className="sm:hidden">{strongAuto && <ScoreRing score={m.score} size={44} />}</div>
          </div>
          <OppMeta o={o} className="mt-1" />
          {m.reason && strongAuto && (
            <p className="mt-3 leading-relaxed">
              {m.reason}
              {m.basic && <span className="ml-1.5 text-xs text-faint">(basic match)</span>}
            </p>
          )}
          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            {o.fields.slice(0, 3).map((f) => (
              <FieldChip key={f} slug={f} size="sm" />
            ))}
          </div>
          <div className="mt-3">
            <WarningChips warnings={o.warnings} deadline={o.deadline} hideUnknown />
          </div>
          <div className="mt-5 flex flex-wrap items-center gap-2">
            {o.url && (
              <LinkButton href={o.url} external variant="primary" size="sm">
                <ExternalLink className="size-3.5" /> Open
              </LinkButton>
            )}
            <Button variant="ghost" size="sm" onClick={onOpen}>
              Details
            </Button>
            <SaveButton saved={m.saved} onClick={onSave} />
            <CoachToggle open={coachOpen} onClick={() => setCoachOpen((v) => !v)} />
            <span className="ml-auto flex items-center gap-3">
              <DeadlinePill deadline={o.deadline} />
              <Button variant="quiet" size="sm" onClick={onDismiss} aria-label="Dismiss match">
                <X className="size-4" />
              </Button>
            </span>
          </div>
          <AnimatePresence initial={false}>{coachOpen && <CoachPanel matchId={m.id} initial={m.coach} />}</AnimatePresence>
        </div>
      </div>
    </motion.li>
  );
}

function CoachToggle({ open, onClick }: { open: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      aria-expanded={open}
      className={cx("inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-sm transition-colors", open ? "bg-brass/10 text-brass" : "text-dim hover:text-star")}
    >
      <Lightbulb className="size-4" /> How to approach this
    </button>
  );
}

function CoachPanel({ matchId, initial }: { matchId: string; initial: CoachAdvice | null }) {
  const [coach, setCoach] = useState<CoachAdvice | null>(initial);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(!initial);

  async function load(refresh = false) {
    setLoading(true);
    setError(null);
    try {
      const r = await api<{ coach: CoachAdvice }>(`/api/matches/${matchId}/coach${refresh ? "?refresh=1" : ""}`, "POST");
      setCoach(r.coach);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Advice isn't available right now.");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    if (!initial) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
      <div className="mt-5 rounded-2xl border border-brass/25 bg-brass/[0.05] p-4 sm:p-5" aria-live="polite">
        {loading ? (
          <div className="space-y-2.5">
            <p className="flex items-center gap-2 text-sm text-brass">
              <Sparkles className="size-4" /> Reading the posting against your profile…
            </p>
            <Skeleton className="h-4 w-11/12" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-2/3" />
          </div>
        ) : error ? (
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <span className="text-ember">{error}</span>
            <Button size="sm" variant="ghost" onClick={() => load()}>
              Try again
            </Button>
          </div>
        ) : coach ? (
          <div className="space-y-4 text-sm leading-relaxed">
            <p className="text-base">{coach.whyYou}</p>
            {coach.highlight.length > 0 && (
              <div>
                <p className="mb-1.5 font-medium text-aurora">Put forward</p>
                <ul className="space-y-1">
                  {coach.highlight.map((h) => (
                    <li key={h} className="flex gap-2">
                      <Check className="mt-0.5 size-4 shrink-0 text-aurora" />
                      {h}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {coach.gaps.length > 0 && (
              <div>
                <p className="mb-1.5 font-medium text-brass">Check before applying</p>
                <ul className="space-y-1">
                  {coach.gaps.map((g) => (
                    <li key={g} className="flex gap-2">
                      <CircleAlert className="mt-0.5 size-4 shrink-0 text-brass" />
                      {g}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {coach.firstStep && (
              <p className="rounded-xl bg-night-2 px-3 py-2.5">
                <span className="font-medium">This week: </span>
                {coach.firstStep}
              </p>
            )}
            <div className="flex items-center justify-between gap-3 text-xs text-faint">
              <span>AI suggestions from your profile and the posting. Double-check the details.</span>
              <button onClick={() => load(true)} className="shrink-0 hover:text-star">
                Regenerate
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </motion.div>
  );
}

function SaveButton({ saved, onClick }: { saved: boolean; onClick: () => void }) {
  const [burst, setBurst] = useState(0);
  return (
    <button
      onClick={() => {
        if (!saved) setBurst((b) => b + 1);
        onClick();
      }}
      aria-pressed={saved}
      aria-label={saved ? "Unsave" : "Save"}
      className={cx("relative inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-sm transition-colors", saved ? "text-ember" : "text-dim hover:text-star")}
    >
      <motion.span key={burst} initial={burst ? { scale: 0.6 } : false} animate={{ scale: [0.6, 1.35, 1] }} transition={{ duration: 0.35 }}>
        <Heart className={cx("size-4", saved && "fill-current")} />
      </motion.span>
      {saved ? "Saved" : "Save"}
      <AnimatePresence>
        {burst > 0 && saved && (
          <motion.span key={`b${burst}`} className="pointer-events-none absolute left-3 top-1/2" initial={{ opacity: 1 }} animate={{ opacity: 0 }} transition={{ duration: 0.6 }}>
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <motion.span
                key={i}
                className="absolute size-1.5 rounded-full bg-ember"
                initial={{ x: 0, y: 0 }}
                animate={{ x: Math.cos((i / 6) * Math.PI * 2) * 16, y: Math.sin((i / 6) * Math.PI * 2) * 16 }}
                transition={{ duration: 0.5, ease: "easeOut" }}
              />
            ))}
          </motion.span>
        )}
      </AnimatePresence>
    </button>
  );
}
