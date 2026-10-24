"use client";

import { useEffect, useMemo } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import useSWR from "swr";
import { AnimatePresence, motion } from "motion/react";
import { toast } from "sonner";
import { Lightbulb, Plus, Sparkles, X } from "lucide-react";
import type { ProposalCardDTO } from "@/lib/types";
import { FIELDS } from "@/lib/taxonomy";
import { Button, EmptyState, PageHeader, Segmented, Skeleton, cx } from "../ui";
import { ProposalCard } from "./ProposalCard";

type Tab = "active" | "completed" | "mine";
const selectCls =
  "h-11 shrink-0 rounded-full border border-line-strong bg-night-2 px-3.5 text-sm text-star focus:border-brass focus:outline-none focus:ring-2 focus:ring-[var(--glow)] sm:h-10";

/** The home page: every project looking for people. Filters live in the URL so a filtered board can be shared. */
export function ProjectsBoard({ name }: { name: string }) {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const tab = (params.get("tab") as Tab) || "active";
  const status = params.get("status") ?? "";
  const skill = params.get("skill") ?? "";
  const field = params.get("field") ?? "";
  const openOnly = params.get("open") === "1";
  const { data, error, isLoading, mutate } = useSWR<{ items: ProposalCardDTO[]; threshold: number }>(`/api/proposals?tab=${tab}`, { keepPreviousData: true });

  useEffect(() => {
    if (params.get("welcome") === "1") toast.success(`You're in, ${name}! Here are the projects looking for people.`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function setParam(k: string, v: string | null) {
    const sp = new URLSearchParams(params.toString());
    sp.delete("welcome");
    if (v) sp.set(k, v);
    else sp.delete(k);
    router.replace(`${pathname}${sp.size ? `?${sp}` : ""}`, { scroll: false });
  }

  const items = data?.items ?? [];
  const threshold = data?.threshold ?? 60;
  // Only offer filter values that are actually used on the board
  const skills = useMemo(() => {
    const m = new Map<string, string>();
    items.forEach((p) => p.peopleNeeded.skills.forEach((s) => m.set(s.toLowerCase(), m.get(s.toLowerCase()) ?? s)));
    return Array.from(m.values()).sort((a, b) => a.localeCompare(b));
  }, [items]);
  const fields = useMemo(() => FIELDS.filter((f) => items.some((p) => p.fields.includes(f.slug))), [items]);

  const isForYou = (p: ProposalCardDTO) => Boolean(p.match && p.match.score >= threshold && !p.proposedByMe && p.myStatus !== "accepted" && p.acceptingMembers);
  const list = items.filter(
    (p) =>
      (!status || p.status === status) &&
      (!skill || p.peopleNeeded.skills.some((s) => s.toLowerCase() === skill.toLowerCase())) &&
      (!field || p.fields.includes(field)) &&
      (!openOnly || (p.acceptingMembers && p.acceptedCount < p.peopleNeeded.count && p.status !== "completed")),
  );
  const forYouCount = list.filter(isForYou).length;
  const filtering = Boolean(status || skill || field || openOnly);

  return (
    <div>
      <PageHeader
        title="Projects"
        subtitle="Pitch an idea, find teammates, build it together."
        action={
          <Link href="/projects/new" className="hidden h-10 items-center gap-2 rounded-full bg-brass px-4 text-sm font-medium text-brass-ink sm:inline-flex">
            <Plus className="size-4" /> Propose a project
          </Link>
        }
      />
      <div className="-mx-4 mb-4 overflow-x-auto px-4 [scrollbar-width:none] sm:mx-0 sm:px-0">
        <Segmented
          id="projects-tab"
          value={tab}
          onChange={(t) => setParam("tab", t === "active" ? null : t)}
          options={[
            { value: "active", label: "Active" },
            { value: "mine", label: "Mine" },
            { value: "completed", label: "Completed" },
          ]}
        />
      </div>

      <div className="-mx-4 mb-5 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:px-0">
        {tab !== "completed" && (
          <select aria-label="Status" value={status} onChange={(e) => setParam("status", e.target.value || null)} className={selectCls}>
            <option value="">Any status</option>
            <option value="open">Open</option>
            <option value="team_forming">Team forming</option>
            <option value="in_progress">In progress</option>
          </select>
        )}
        <select aria-label="Skill" value={skill} onChange={(e) => setParam("skill", e.target.value || null)} className={selectCls} disabled={!skills.length}>
          <option value="">Any skill</option>
          {skills.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <select aria-label="Field" value={field} onChange={(e) => setParam("field", e.target.value || null)} className={selectCls} disabled={!fields.length}>
          <option value="">Any field</option>
          {fields.map((f) => (
            <option key={f.slug} value={f.slug}>
              {f.emoji} {f.label}
            </option>
          ))}
        </select>
        {tab !== "completed" && (
          <button
            onClick={() => setParam("open", openOnly ? null : "1")}
            aria-pressed={openOnly}
            className={cx("h-11 shrink-0 rounded-full border px-4 text-sm sm:h-10", openOnly ? "border-aurora bg-aurora/15 text-star" : "border-line-strong text-dim hover:text-star")}
          >
            Has open spots
          </button>
        )}
        {filtering && (
          <button onClick={() => router.replace(tab === "active" ? pathname : `${pathname}?tab=${tab}`, { scroll: false })} className="inline-flex h-11 shrink-0 items-center gap-1 rounded-full px-3 text-sm text-dim hover:text-star sm:h-10">
            <X className="size-4" /> Clear
          </button>
        )}
      </div>

      <AnimatePresence>
        {tab === "active" && forYouCount > 0 && (
          <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mb-4 flex items-center gap-2 text-sm text-brass" aria-live="polite">
            <Sparkles className="size-4" /> {forYouCount} {forYouCount === 1 ? "project looks" : "projects look"} like a good fit for you. They're at the top.
          </motion.p>
        )}
      </AnimatePresence>

      {error && !data ? (
        <EmptyState icon={<Lightbulb className="size-10" />} title="Couldn't load projects" action={<Button variant="ghost" onClick={() => mutate()}>Try again</Button>}>
          Check your connection and try again.
        </EmptyState>
      ) : isLoading && !data ? (
        <div className="grid gap-3 md:grid-cols-2">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-56 rounded-[var(--radius-panel)]" />
          ))}
        </div>
      ) : list.length === 0 ? (
        <EmptyState
          icon={<Lightbulb className="size-10" />}
          title={filtering ? "No projects match these filters" : tab === "completed" ? "No completed projects yet" : tab === "mine" ? "You're not in any project yet" : "No proposals yet. Be the first to pitch an idea!"}
          action={
            !filtering &&
            tab !== "completed" && (
              <Link href="/projects/new" className="inline-flex h-11 items-center gap-2 rounded-full bg-brass px-5 font-medium text-brass-ink">
                <Plus className="size-4" /> Propose a project
              </Link>
            )
          }
        >
          {filtering
            ? "Try removing a filter."
            : tab === "completed"
              ? "Finished projects land here, so everyone can see what the community built."
              : tab === "mine"
                ? "Projects you propose, join or are invited to show up here."
                : "Got an idea that needs a team? Describe the problem and who you need. It takes two minutes."}
        </EmptyState>
      ) : (
        <motion.div layout className="grid gap-3 md:grid-cols-2">
          <AnimatePresence mode="popLayout">
            {list.map((p, i) => (
              <ProposalCard key={p.id} p={p} forYou={tab === "active" && isForYou(p)} index={i} />
            ))}
          </AnimatePresence>
        </motion.div>
      )}
    </div>
  );
}
