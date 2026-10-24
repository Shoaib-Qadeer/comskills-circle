"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import useSWR, { mutate as globalMutate } from "swr";
import { AnimatePresence, motion } from "motion/react";
import { ArrowLeft, Eye, Minus, Pencil, Plus } from "lucide-react";
import type { ProposalCardDTO, ProposalDetailDTO } from "@/lib/types";
import { SUGGESTED_SKILLS } from "@/lib/taxonomy";
import { api } from "@/lib/client";
import { Button, ChipInput, ErrorText, Input, Label, PageHeader, Panel, Textarea, cx } from "../ui";
import { FieldPicker } from "../ProfileParts";
import { ShareButtons, absoluteUrl } from "../ShareButtons";
import { ProposalCard } from "./ProposalCard";
import { PeopleWhoMightFit } from "./PeopleWhoMightFit";
import { proposalShareText } from "@/lib/share-text";

type Draft = {
  title: string;
  problem: string;
  idea: string;
  count: number;
  skills: string[];
  hoursPerWeek: string;
  duration: string;
  fields: string[];
  tags: string[];
  links: string[];
};

const EMPTY: Draft = { title: "", problem: "", idea: "", count: 2, skills: [], hoursPerWeek: "", duration: "", fields: [], tags: [], links: [""] };
const DRAFT_KEY = "circle-proposal-draft";
const DURATIONS = ["2 weeks", "1 month", "6 weeks", "3 months", "Until it's done"];

function fromDetail(p: ProposalDetailDTO): Draft {
  return {
    title: p.title,
    problem: p.problem,
    idea: p.idea,
    count: p.peopleNeeded.count,
    skills: p.peopleNeeded.skills,
    hoursPerWeek: p.commitment.hoursPerWeek ? String(p.commitment.hoursPerWeek) : "",
    duration: p.commitment.duration,
    fields: p.fields,
    tags: p.tags,
    links: p.links.length ? p.links : [""],
  };
}

function toBody(d: Draft) {
  return {
    title: d.title,
    problem: d.problem,
    idea: d.idea,
    peopleNeeded: { count: d.count, skills: d.skills },
    commitment: { hoursPerWeek: d.hoursPerWeek ? Math.max(0, Math.min(60, Math.round(Number(d.hoursPerWeek)))) : null, duration: d.duration.trim() },
    fields: d.fields,
    tags: d.tags,
    links: d.links.map((l) => l.trim()).filter(Boolean),
  };
}

function problemOf(d: Draft): string | null {
  if (d.title.trim().length < 5) return "Give your project a title (at least 5 characters).";
  if (d.problem.trim().length < 20) return "Describe the problem in a sentence or two.";
  if (d.idea.trim().length < 20) return "Describe your idea in a sentence or two.";
  if (!d.fields.length) return "Pick at least one field so the right people find it.";
  if (d.links.some((l) => l.trim() && !/^https?:\/\/\S+\.\S+/.test(l.trim()))) return "Links should start with https://";
  return null;
}

export function ProposalForm({ existing }: { existing?: ProposalDetailDTO }) {
  const router = useRouter();
  const editing = Boolean(existing);
  const [d, setD] = useState<Draft>(() => (existing ? fromDetail(existing) : EMPTY));
  const [view, setView] = useState<"form" | "preview">("form");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [posted, setPosted] = useState<{ id: string } | null>(null);
  const { data: board } = useSWR<{ items: ProposalCardDTO[] }>("/api/proposals?tab=active");

  // Draft survives a dropped connection (new proposals only)
  useEffect(() => {
    if (editing) return;
    try {
      const s = localStorage.getItem(DRAFT_KEY);
      if (s) setD({ ...EMPTY, ...JSON.parse(s) });
    } catch {}
  }, [editing]);
  useEffect(() => {
    if (editing || posted) return;
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(d));
    } catch {}
  }, [d, editing, posted]);

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD((p) => ({ ...p, [k]: v }));
  const skillSuggestions = useMemo(() => {
    const used = new Map<string, number>();
    (board?.items ?? []).forEach((p) => p.peopleNeeded.skills.forEach((s) => used.set(s, (used.get(s) ?? 0) + 1)));
    const fromBoard = Array.from(used).sort((a, b) => b[1] - a[1]).map(([s]) => s);
    return Array.from(new Set([...fromBoard, ...SUGGESTED_SKILLS])).slice(0, 14);
  }, [board]);

  const preview: ProposalCardDTO = {
    id: existing?.id ?? "preview",
    title: d.title || "Your project title",
    problem: d.problem || "The problem you're solving.",
    proposer: null,
    proposedByMe: true,
    status: existing?.status ?? "open",
    acceptingMembers: true,
    peopleNeeded: { count: d.count, skills: d.skills },
    acceptedCount: existing?.acceptedCount ?? 0,
    commitment: toBody(d).commitment,
    fields: d.fields,
    tags: d.tags,
    team: existing?.team ?? [],
    myStatus: null,
    match: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  function goPreview() {
    const p = problemOf(d);
    setError(p);
    if (!p) {
      setView("preview");
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  async function submit() {
    const p = problemOf(d);
    if (p) {
      setView("form");
      return setError(p);
    }
    setBusy(true);
    setError(null);
    try {
      if (existing) {
        await api(`/api/proposals/${existing.id}`, "PATCH", toBody(d));
        globalMutate(`/api/proposals/${existing.id}`);
        router.push(`/projects/${existing.id}`);
        return;
      }
      const r = await api<{ id: string; firstPost: boolean }>("/api/proposals", "POST", toBody(d));
      try {
        localStorage.removeItem(DRAFT_KEY);
      } catch {}
      setPosted({ id: r.id });
      globalMutate((k) => typeof k === "string" && k.startsWith("/api/proposals"));
      window.scrollTo({ top: 0 });
      try {
        const confetti = (await import("canvas-confetti")).default;
        setTimeout(() => confetti({ particleCount: 120, spread: 80, origin: { y: 0.6 }, colors: ["#f2c14e", "#5eead4", "#a78bfa", "#eef0ff"], disableForReducedMotion: true }), 350);
      } catch {}
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save. Check your connection and try again.");
      setView("form");
    } finally {
      setBusy(false);
    }
  }

  if (posted) return <Posted id={posted.id} title={d.title} problem={d.problem} />;

  return (
    <div className="mx-auto max-w-3xl">
      <Link href={existing ? `/projects/${existing.id}` : "/projects"} className="mb-3 inline-flex h-11 items-center gap-1.5 text-sm text-dim hover:text-star">
        <ArrowLeft className="size-4" /> {existing ? "Back to the project" : "Projects"}
      </Link>
      <PageHeader title={editing ? "Edit your project" : "Propose a project"} subtitle={editing ? "Changes re-run matching, so the right people see it." : "Describe the problem and who you need. Members who fit will see it first."} />

      <AnimatePresence mode="wait" initial={false}>
        {view === "form" ? (
          <motion.div key="form" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-5">
            <Panel as="section" className="space-y-5 p-4 sm:p-6">
              <h2 className="font-display text-lg font-semibold">Your idea</h2>
              <div>
                <Label htmlFor="pr-title" hint={`${d.title.length}/90`}>
                  Title
                </Label>
                <Input id="pr-title" value={d.title} maxLength={90} onChange={(e) => set("title", e.target.value)} placeholder="Dengue early-warning map for Lahore" className="font-display text-lg" />
              </div>
              <div>
                <Label htmlFor="pr-problem" hint={`${d.problem.length}/600`}>
                  The problem
                </Label>
                <Textarea id="pr-problem" rows={4} maxLength={600} value={d.problem} onChange={(e) => set("problem", e.target.value)} placeholder="What's wrong today, and who does it affect?" />
              </div>
              <div>
                <Label htmlFor="pr-idea" hint={`${d.idea.length}/900`}>
                  Your idea
                </Label>
                <Textarea id="pr-idea" rows={5} maxLength={900} value={d.idea} onChange={(e) => set("idea", e.target.value)} placeholder="What do you want to build or study, and what would a first version look like?" />
                <p className="mt-1.5 text-xs text-faint">English, Urdu or Roman Urdu are all fine.</p>
              </div>
            </Panel>

            <Panel as="section" className="space-y-6 p-4 sm:p-6">
              <h2 className="font-display text-lg font-semibold">Who you need</h2>
              <div>
                <Label>People needed</Label>
                <div className="inline-flex items-center gap-1 rounded-full border border-line-strong bg-night-2 p-1">
                  <button type="button" aria-label="One fewer person" onClick={() => set("count", Math.max(1, d.count - 1))} className="grid size-10 place-items-center rounded-full text-dim hover:bg-raised-2 hover:text-star">
                    <Minus className="size-4" />
                  </button>
                  <motion.span key={d.count} initial={{ scale: 0.7, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="tabular w-10 text-center font-display text-xl font-semibold" aria-live="polite">
                    {d.count}
                  </motion.span>
                  <button type="button" aria-label="One more person" onClick={() => set("count", Math.min(20, d.count + 1))} className="grid size-10 place-items-center rounded-full text-dim hover:bg-raised-2 hover:text-star">
                    <Plus className="size-4" />
                  </button>
                </div>
              </div>
              <div>
                <Label hint={`${d.skills.length}/10`}>Skills you're looking for</Label>
                <ChipInput values={d.skills} onChange={(v) => set("skills", v)} suggestions={skillSuggestions} max={10} placeholder="Python, wet-lab, design…" />
              </div>
              <div className="grid gap-4 sm:grid-cols-[160px_1fr]">
                <div>
                  <Label htmlFor="pr-hours" hint="Optional">
                    Hours per week
                  </Label>
                  <Input id="pr-hours" type="number" inputMode="numeric" min={0} max={60} value={d.hoursPerWeek} onChange={(e) => set("hoursPerWeek", e.target.value)} placeholder="5" />
                </div>
                <div>
                  <Label htmlFor="pr-dur" hint="Optional">
                    How long
                  </Label>
                  <Input id="pr-dur" maxLength={40} value={d.duration} onChange={(e) => set("duration", e.target.value)} placeholder="8 weeks" />
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {DURATIONS.map((x) => (
                      <button
                        key={x}
                        type="button"
                        onClick={() => set("duration", x)}
                        className={cx("h-9 rounded-full border px-3 text-sm sm:h-7 sm:text-xs", d.duration === x ? "border-brass bg-brass/15 text-star" : "border-dashed border-line-strong text-dim hover:text-star")}
                      >
                        {x}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </Panel>

            <Panel as="section" className="space-y-6 p-4 sm:p-6">
              <h2 className="font-display text-lg font-semibold">Topic and links</h2>
              <div>
                <Label>Fields (up to 4)</Label>
                <FieldPicker value={d.fields} onChange={(v) => set("fields", v)} max={4} text={`${d.title}\n${d.problem}\n${d.idea}`} onTags={(t) => set("tags", Array.from(new Set([...d.tags, ...t])).slice(0, 6))} />
              </div>
              <div>
                <Label hint="Optional">Other topics</Label>
                <ChipInput values={d.tags} onChange={(v) => set("tags", v.map((x) => x.toLowerCase()))} max={6} placeholder="dengue, gis, flutter…" />
              </div>
              <div>
                <Label hint="Up to 3, optional">Links (a doc, repo or dataset)</Label>
                <div className="space-y-2">
                  {d.links.map((l, i) => (
                    <Input
                      key={i}
                      type="url"
                      inputMode="url"
                      aria-label={`Link ${i + 1}`}
                      value={l}
                      placeholder="https://…"
                      invalid={Boolean(l.trim()) && !/^https?:\/\/\S+\.\S+/.test(l.trim())}
                      onChange={(e) => set("links", d.links.map((x, j) => (j === i ? e.target.value : x)))}
                    />
                  ))}
                  {d.links.length < 3 && (
                    <button type="button" onClick={() => set("links", [...d.links, ""])} className="inline-flex h-10 items-center gap-1.5 text-sm text-brass hover:underline">
                      <Plus className="size-4" /> Add another link
                    </button>
                  )}
                </div>
              </div>
            </Panel>
          </motion.div>
        ) : (
          <motion.div key="preview" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} className="space-y-5">
            <p className="text-sm text-dim">This is how your project appears on the board.</p>
            <div className="pointer-events-none max-w-xl">
              <ProposalCard p={preview} forYou={false} />
            </div>
            <Panel className="space-y-4 p-4 sm:p-6">
              <div>
                <p className="text-sm text-faint">The problem</p>
                <p className="mt-1 whitespace-pre-line">{d.problem}</p>
              </div>
              <div>
                <p className="text-sm text-faint">Your idea</p>
                <p className="mt-1 whitespace-pre-line">{d.idea}</p>
              </div>
            </Panel>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="sticky bottom-20 z-10 mt-6 rounded-[28px] border border-line-strong bg-raised/95 p-2 pl-4 shadow-2xl backdrop-blur lg:bottom-6">
        <ErrorText>{error}</ErrorText>
        <div className="flex items-center justify-end gap-2">
          {view === "form" ? (
            <>
              <span className="mr-auto hidden text-sm text-dim sm:block">Check it, then post.</span>
              <Button size="lg" onClick={goPreview}>
                <Eye className="size-4" /> Preview
              </Button>
            </>
          ) : (
            <>
              <Button variant="quiet" onClick={() => setView("form")}>
                <Pencil className="size-4" /> Edit
              </Button>
              <Button size="lg" loading={busy} onClick={submit}>
                {editing ? "Save changes" : "Post project"}
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Posted({ id, title, problem }: { id: string; title: string; problem: string }) {
  const url = absoluteUrl(`/projects/${id}`);
  return (
    <div className="mx-auto max-w-2xl">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center pb-8 pt-4 text-center">
        <div className="relative mb-10 h-32 w-full max-w-sm">
          {[2, 1].map((i) => (
            <div key={i} className="absolute inset-x-0 top-0 mx-auto h-24 rounded-[var(--radius-panel)] border border-line bg-raised/60" style={{ transform: `translateY(${i * 12}px) scale(${1 - i * 0.05})` }} />
          ))}
          <motion.div
            initial={{ y: -110, opacity: 0, rotate: -6, scale: 1.05 }}
            animate={{ y: 0, opacity: 1, rotate: 0, scale: 1 }}
            transition={{ type: "spring", stiffness: 180, damping: 16 }}
            className="absolute inset-x-0 top-0 mx-auto flex h-24 items-center rounded-[var(--radius-panel)] border border-brass/50 bg-raised px-6 text-left shadow-[0_20px_60px_-25px_var(--glow)]"
          >
            <p className="line-clamp-2 font-display text-lg font-semibold">{title}</p>
          </motion.div>
        </div>
        <h1 className="font-display text-3xl font-semibold">Your project is live</h1>
        <p className="mt-2 max-w-md text-dim">Members whose skills fit will see it first. Share it with your batch group, too.</p>
        <ShareButtons className="mt-6 justify-center" text={proposalShareText({ title, problem }, url)} url={url} />
      </motion.div>
      <div className="rounded-[var(--radius-panel)] border border-line bg-raised/80 p-4 sm:p-6">
        <PeopleWhoMightFit proposalId={id} fresh />
      </div>
      <div className="mt-6 flex flex-wrap justify-center gap-2">
        <Link href={`/projects/${id}`} className="inline-flex h-11 items-center rounded-full bg-brass px-5 font-medium text-brass-ink">
          Open the project page
        </Link>
        <Link href="/projects" className="inline-flex h-11 items-center rounded-full border border-line-strong px-5 hover:bg-raised-2">
          Back to projects
        </Link>
      </div>
    </div>
  );
}
