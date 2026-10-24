"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import useSWR, { mutate as globalMutate } from "swr";
import { AnimatePresence, motion } from "motion/react";
import { toast } from "sonner";
import { ArrowRight, Check, CircleAlert, ExternalLink, Heart, Lightbulb, Mail, Sparkles, Telescope, X, Target, Users } from "lucide-react";
import type { AnyMatchDTO, CoachAdvice, OpportunityMatchDTO, ProposalMatchDTO } from "@/lib/types";
import { api, daysLeft, firstName } from "@/lib/client";
import { oppTypeEmoji, oppTypeLabel } from "@/lib/taxonomy";
import { CountUp, DeadlinePill, OrgMark, ScoreRing, WarningChips } from "./bits";
import { Button, EmptyState, FieldChip, LinkButton, Segmented, Skeleton, cx } from "./ui";
import { OppMeta, OpportunityDetail, TrackButton } from "./OpportunityParts";
import { StatusPill, commitmentText, needsText } from "./projects/ProposalCard";

type Tab = "new" | "saved" | "all";
type Kind = "all" | "proposal" | "opportunity";

function greeting() {
  const h = new Date().getHours();
  return h < 5 ? "Still up" : h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
}

/** "For you": project proposals and opportunities the matcher thinks fit you, plus anything you were tagged in or invited to. */
export function MatchesView({ name }: { name: string }) {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const kindParam = params.get("kind");
  const kind: Kind = kindParam === "proposal" || kindParam === "opportunity" ? kindParam : "all";
  const [tab, setTab] = useState<Tab>("all");
  const { data, error, mutate, isLoading } = useSWR<{ items: AnyMatchDTO[] }>(`/api/matches?filter=all`);
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [openOpp, setOpenOpp] = useState<OpportunityMatchDTO | null>(null);
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

  const setKind = (k: Kind) => router.replace(k === "all" ? pathname : `${pathname}?kind=${k}`, { scroll: false });
  const all = useMemo(() => (data?.items ?? []).filter((m) => !hidden.has(m.id) && (kind === "all" || m.kind === kind)), [data, hidden, kind]);
  const list = tab === "new" ? all.filter((m) => newIds?.has(m.id)) : tab === "saved" ? all.filter((m) => m.saved) : all;
  const counts = useMemo(() => {
    const items = (data?.items ?? []).filter((m) => !hidden.has(m.id));
    return { all: items.length, proposal: items.filter((m) => m.kind === "proposal").length, opportunity: items.filter((m) => m.kind === "opportunity").length };
  }, [data, hidden]);
  const closingSoon = all.filter((m) => {
    if (m.kind !== "opportunity") return false;
    const n = daysLeft(m.opportunity.deadline);
    return n !== null && n >= 0 && n <= 14;
  }).length;
  const newCount = all.filter((m) => newIds?.has(m.id)).length;

  async function toggleSave(m: AnyMatchDTO) {
    const saved = !m.saved;
    mutate((d) => (d ? { items: d.items.map((x) => (x.id === m.id ? ({ ...x, saved } as AnyMatchDTO) : x)) } : d), { revalidate: false });
    try {
      await api(`/api/matches/${m.id}`, "PATCH", { saved });
      if (saved) toast.success("Saved");
    } catch {
      mutate();
    }
  }

  async function dismiss(m: AnyMatchDTO) {
    setHidden((h) => new Set(h).add(m.id));
    const unhide = () =>
      setHidden((h) => {
        const n = new Set(h);
        n.delete(m.id);
        return n;
      });
    try {
      await api(`/api/matches/${m.id}`, "PATCH", { dismissed: true });
      toast("Dismissed", {
        action: {
          label: "Undo",
          onClick: async () => {
            await api(`/api/matches/${m.id}`, "PATCH", { dismissed: false });
            unhide();
          },
        },
      });
    } catch {
      unhide();
    }
  }

  const KIND_CHIPS: { value: Kind; label: string; icon?: React.ReactNode }[] = [
    { value: "all", label: "Everything" },
    { value: "proposal", label: "Projects", icon: <Users className="size-4" /> },
    { value: "opportunity", label: "Opportunities", icon: <Sparkles className="size-4" /> },
  ];

  return (
    <div className="mx-auto max-w-3xl">
      <header className="mb-6">
        <h1 className="font-display text-3xl font-semibold sm:text-4xl">
          {greeting()}
          {name ? `, ${name}` : ""}.
        </h1>
        <p className="mt-2 text-dim">Projects and opportunities that fit your profile, best matches first.</p>
        <div className="mt-4 flex flex-wrap gap-x-6 gap-y-1">
          <Stat value={newCount} label={newCount === 1 ? "new match" : "new matches"} tone="brass" loading={!data} />
          <Stat value={closingSoon} label="closing within 2 weeks" tone="ember" loading={!data} />
          <Stat value={all.filter((m) => m.saved).length} label="saved" tone="dim" loading={!data} />
        </div>
      </header>

      <div className="-mx-4 mb-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:px-0" role="group" aria-label="Show">
        {KIND_CHIPS.map((c) => (
          <button
            key={c.value}
            onClick={() => setKind(c.value)}
            aria-pressed={kind === c.value}
            className={cx("inline-flex h-11 shrink-0 items-center gap-1.5 rounded-full border px-4 text-sm sm:h-9", kind === c.value ? "border-brass bg-brass/15 text-star" : "border-line-strong text-dim hover:text-star")}
          >
            {c.icon} {c.label}
            {data && <span className="tabular text-xs text-faint">{counts[c.value]}</span>}
          </button>
        ))}
      </div>

      <Segmented
        id="matches"
        value={tab}
        onChange={setTab}
        className="mb-6"
        options={[
          { value: "new", label: "New", count: newCount },
          { value: "saved", label: "Saved", count: all.filter((m) => m.saved).length },
          { value: "all", label: "All", count: all.length },
        ]}
      />

      {error && !data ? (
        <EmptyState icon={<Telescope className="size-10" />} title="Couldn't load your matches" action={<Button variant="ghost" onClick={() => mutate()}>Try again</Button>}>
          Check your connection and try again.
        </EmptyState>
      ) : isLoading && !data ? (
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
              <div className="flex flex-wrap justify-center gap-2">
                <Link href="/projects" className="inline-flex h-11 items-center rounded-full bg-brass px-5 font-medium text-brass-ink">
                  Browse projects
                </Link>
                <Link href="/settings" className="inline-flex h-11 items-center rounded-full border border-line-strong px-5 font-medium hover:bg-raised-2">
                  Improve your profile
                </Link>
              </div>
            )
          }
        >
          {tab === "saved"
            ? "Tap the heart on a match to keep it here."
            : tab === "new"
              ? "New matches appear here when members propose projects or share opportunities."
              : "Matches come from your fields, skills and what you're looking for. A fuller profile gets better matches."}
        </EmptyState>
      ) : (
        <motion.ul layout className="space-y-4">
          <AnimatePresence initial={true} mode="popLayout">
            {list.map((m, i) =>
              m.kind === "opportunity" ? (
                <MatchCard key={m.id} m={m} index={i} onOpen={() => setOpenOpp(m)} onSave={() => toggleSave(m)} onDismiss={() => dismiss(m)} onTracked={() => mutate()} />
              ) : (
                <ProjectMatchCard key={m.id} m={m} index={i} onSave={() => toggleSave(m)} onDismiss={() => dismiss(m)} />
              ),
            )}
          </AnimatePresence>
        </motion.ul>
      )}

      <OpportunityDetail o={openOpp?.opportunity ?? null} open={Boolean(openOpp)} onClose={() => setOpenOpp(null)} onTracked={() => mutate()} />
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

const cardMotion = (index: number) => ({
  layout: true,
  initial: { opacity: 0, y: 14 },
  animate: { opacity: 1, y: 0, transition: { delay: Math.min(index, 10) * 0.04, type: "spring" as const, stiffness: 260, damping: 26 } },
  exit: { opacity: 0, x: 80, transition: { duration: 0.22 } },
});

function Banner({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="-mx-4 -mt-4 mb-4 flex items-start gap-2 border-b border-brass/25 bg-brass/[0.08] px-4 py-2.5 text-sm sm:-mx-6 sm:-mt-6 sm:mb-5 sm:px-6">
      <span className="mt-0.5 shrink-0 text-brass">{icon}</span>
      <span className="min-w-0">{children}</span>
    </div>
  );
}

function ProjectMatchCard({ m, index, onSave, onDismiss }: { m: ProposalMatchDTO; index: number; onSave: () => void; onDismiss: () => void }) {
  const p = m.proposal;
  const invited = m.source === "invited" || p.myStatus === "invited";
  const commitment = commitmentText(p.commitment);
  return (
    <motion.li {...cardMotion(index)} className={cx("relative overflow-hidden rounded-[var(--radius-panel)] border bg-raised/80 p-4 sm:p-6", invited ? "border-brass/50 shadow-[0_0_0_1px_var(--glow),0_20px_50px_-30px_var(--glow)]" : "border-line")}>
      {invited && (
        <Banner icon={<Mail className="size-4" />}>
          <span className="font-medium text-brass">{p.proposer ? `${firstName(p.proposer.name)} invited you` : "You were invited"}</span>
          <span className="text-dim"> to join this project.</span>
        </Banner>
      )}
      <div className="flex gap-4">
        <div className="hidden sm:block">
          <ScoreRing score={m.score} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="mb-1 flex flex-wrap items-center gap-1.5 text-xs text-faint">
                <Users className="size-3.5" /> Project <StatusPill status={p.status} />
              </div>
              <Link href={`/projects/${p.id}`} className="font-display text-xl font-semibold leading-snug hover:text-brass">
                {p.title}
              </Link>
            </div>
            <div className="shrink-0 sm:hidden">
              <ScoreRing score={m.score} size={44} />
            </div>
          </div>
          <p className="mt-1 line-clamp-2 text-sm text-dim">{p.problem}</p>
          {m.reason && (
            <p className="mt-3 leading-relaxed">
              {m.reason}
              {m.basic && <span className="ml-1.5 text-xs text-faint">(basic match)</span>}
            </p>
          )}
          <p className="mt-2 text-sm text-dim">
            {needsText(p)}
            {commitment && <span className="text-faint"> · {commitment}</span>}
          </p>
          {p.peopleNeeded.skills.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {p.peopleNeeded.skills.slice(0, 5).map((s) => (
                <span key={s} className="rounded-full border border-line-strong px-2.5 py-0.5 text-xs text-dim">
                  {s}
                </span>
              ))}
            </div>
          )}
          <div className="mt-5 flex flex-wrap items-center gap-2">
            <LinkButton href={`/projects/${p.id}`} variant="primary" size="sm">
              {invited ? "See the invite" : "See the project"} <ArrowRight className="size-3.5" />
            </LinkButton>
            <SaveButton saved={m.saved} onClick={onSave} />
            <span className="ml-auto">
              <Button variant="quiet" size="sm" onClick={onDismiss} aria-label="Dismiss match">
                <X className="size-4" />
              </Button>
            </span>
          </div>
        </div>
      </div>
    </motion.li>
  );
}

function MatchCard({ m, index, onOpen, onSave, onDismiss, onTracked }: { m: OpportunityMatchDTO; index: number; onOpen: () => void; onSave: () => void; onDismiss: () => void; onTracked: () => void }) {
  const o = m.opportunity;
  const [coachOpen, setCoachOpen] = useState(false);
  const tagged = m.source === "tagged";
  const strongAuto = !tagged || m.score >= 60;
  return (
    <motion.li {...cardMotion(index)} className={cx("relative overflow-hidden rounded-[var(--radius-panel)] border bg-raised/80 p-4 sm:p-6", tagged ? "border-brass/50 shadow-[0_0_0_1px_var(--glow),0_20px_50px_-30px_var(--glow)]" : "border-line")}>
      {tagged && m.taggedBy && (
        <Banner icon={<Target className="size-4" />}>
          <span className="font-medium text-brass">{firstName(m.taggedBy.name)} thought of you</span>
          {m.taggedNote && <span className="text-dim"> · “{m.taggedNote}”</span>}
        </Banner>
      )}
      <div className="flex gap-4">
        <div className="hidden sm:block">{strongAuto ? <ScoreRing score={m.score} /> : <OrgMark name={o.organization} url={o.url} />}</div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="mb-1 text-xs text-faint">
                <span aria-hidden>{oppTypeEmoji(o.type)}</span> {oppTypeLabel(o.type)}
              </p>
              <button onClick={onOpen} className="text-left">
                <h3 className="font-display text-xl font-semibold leading-snug hover:text-brass">{o.title}</h3>
              </button>
            </div>
            <div className="shrink-0 sm:hidden">{strongAuto && <ScoreRing score={m.score} size={44} />}</div>
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
            <TrackButton o={o} onTracked={onTracked} className="h-10 px-3 text-sm sm:h-8" />
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
      className={cx("inline-flex h-10 items-center gap-1.5 rounded-full px-3 text-sm transition-colors sm:h-8", open ? "bg-brass/10 text-brass" : "text-dim hover:text-star")}
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
      className={cx("relative inline-flex h-10 items-center gap-1.5 rounded-full px-3 text-sm transition-colors sm:h-8", saved ? "text-ember" : "text-dim hover:text-star")}
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
