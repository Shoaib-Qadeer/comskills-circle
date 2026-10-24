"use client";

import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { CalendarClock, ExternalLink, Lock, PartyPopper, Users } from "lucide-react";
import type { ScholarshipStage } from "@/lib/types";
import type { ScholarshipDTO } from "@/lib/scholarships";
import { formatDate, todayKey } from "@/lib/client";
import { hostLabel } from "@/lib/url";
import { DeadlinePill } from "../bits";
import { Avatar, Input, Label, Tag, Textarea, cx } from "../ui";

export const STAGES: ScholarshipStage[] = ["applying", "applied", "rejected", "accepted"];
export const STAGE_LABEL: Record<ScholarshipStage, string> = { applying: "Applying", applied: "Applied", rejected: "Rejected", accepted: "Accepted" };
export const STAGE_TONE: Record<ScholarshipStage, "brass" | "violet" | "neutral" | "aurora"> = { applying: "brass", applied: "violet", rejected: "neutral", accepted: "aurora" };
export const STAGE_HINT: Record<ScholarshipStage, string> = {
  applying: "Working on the application",
  applied: "Submitted, waiting for a result",
  rejected: "Didn't work out this time",
  accepted: "You got in!",
};

export const COUNTRY_SUGGESTIONS = [
  "Germany",
  "United Kingdom",
  "United States",
  "Turkey",
  "China",
  "Hungary",
  "Italy",
  "France",
  "South Korea",
  "Japan",
  "Australia",
  "Canada",
  "Netherlands",
  "Sweden",
  "Malaysia",
  "Saudi Arabia",
  "Pakistan",
];

/** Form state for an entry (dates as YYYY-MM-DD strings, empty = not set). */
export type EntryDraft = {
  name: string;
  country: string;
  link: string;
  stage: ScholarshipStage;
  deadline: string;
  submittedAt: string;
  expectedResultAt: string;
  rejectedAt: string;
  lesson: string;
  programme: string;
  university: string;
  startDate: string;
  rejectedVisibility: "team" | "members";
  announceConsent: boolean;
};

export function emptyDraft(stage: ScholarshipStage = "applying"): EntryDraft {
  return {
    name: "",
    country: "",
    link: "",
    stage,
    deadline: "",
    submittedAt: stage === "applied" ? todayKey() : "",
    expectedResultAt: "",
    rejectedAt: stage === "rejected" ? todayKey() : "",
    lesson: "",
    programme: "",
    university: "",
    startDate: "",
    rejectedVisibility: "team",
    announceConsent: false,
  };
}

export function draftFromEntry(e: ScholarshipDTO): EntryDraft {
  return {
    name: e.name,
    country: e.country,
    link: e.link ?? "",
    stage: e.stage,
    deadline: e.deadline ?? "",
    submittedAt: e.submittedAt ?? "",
    expectedResultAt: e.expectedResultAt ?? "",
    rejectedAt: e.rejectedAt ?? "",
    lesson: e.lesson ?? "",
    programme: e.programme ?? "",
    university: e.university ?? "",
    startDate: e.startDate ?? "",
    rejectedVisibility: e.rejectedVisibility,
    announceConsent: e.announceConsent,
  };
}

const n = (v: string) => (v.trim() ? v.trim() : null);

/** Only the fields the chosen stage uses, plus the basics. */
export function draftToBody(d: EntryDraft, opts: { basics: boolean }) {
  const stageFields: Record<string, unknown> = {};
  if (d.stage === "applying") stageFields.deadline = n(d.deadline);
  if (d.stage === "applied") Object.assign(stageFields, { submittedAt: n(d.submittedAt), expectedResultAt: n(d.expectedResultAt) });
  if (d.stage === "rejected") Object.assign(stageFields, { rejectedAt: n(d.rejectedAt), lesson: n(d.lesson), rejectedVisibility: d.rejectedVisibility });
  if (d.stage === "accepted") Object.assign(stageFields, { programme: n(d.programme), university: n(d.university), startDate: n(d.startDate), announceConsent: d.announceConsent });
  return { ...(opts.basics ? { name: d.name.trim(), country: d.country.trim(), link: n(d.link) } : {}), stage: d.stage, ...stageFields };
}

export function draftProblem(d: EntryDraft, basics: boolean): string | null {
  if (basics && d.name.trim().length < 2) return "Add the scholarship's name.";
  if (basics && d.country.trim().length < 2) return "Add the country.";
  if (basics && d.link.trim() && !/^https?:\/\/\S+\.\S+/.test(d.link.trim())) return "The link should start with https://";
  if (d.stage === "applied" && !d.submittedAt) return "Add the date you submitted.";
  if (d.stage === "accepted" && !d.programme.trim()) return "Add the programme you were accepted to.";
  return null;
}

export function BasicsFields({ d, set }: { d: EntryDraft; set: <K extends keyof EntryDraft>(k: K, v: EntryDraft[K]) => void }) {
  return (
    <div className="space-y-4">
      <div>
        <Label htmlFor="sc-name">Scholarship or programme</Label>
        <Input id="sc-name" value={d.name} maxLength={120} onChange={(e) => set("name", e.target.value)} placeholder="DAAD EPOS, Chevening, Fulbright…" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="sc-country">Country</Label>
          <Input id="sc-country" list="sc-countries" value={d.country} maxLength={60} onChange={(e) => set("country", e.target.value)} placeholder="Germany" />
          <datalist id="sc-countries">
            {COUNTRY_SUGGESTIONS.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </div>
        <div>
          <Label htmlFor="sc-link" hint="Optional">
            Link
          </Label>
          <Input id="sc-link" type="url" inputMode="url" value={d.link} onChange={(e) => set("link", e.target.value)} placeholder="https://…" />
        </div>
      </div>
    </div>
  );
}

/** The fields each stage asks for (the brief's table). */
export function StageFields({ d, set }: { d: EntryDraft; set: <K extends keyof EntryDraft>(k: K, v: EntryDraft[K]) => void }) {
  if (d.stage === "applying")
    return (
      <div className="max-w-56">
        <Label htmlFor="sc-deadline" hint="Optional">
          Application deadline
        </Label>
        <Input id="sc-deadline" type="date" value={d.deadline} onChange={(e) => set("deadline", e.target.value)} />
        <p className="mt-1.5 text-xs text-faint">We'll remind you 7 days and 1 day before.</p>
      </div>
    );
  if (d.stage === "applied")
    return (
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="sc-sub">Date submitted</Label>
          <Input id="sc-sub" type="date" value={d.submittedAt} onChange={(e) => set("submittedAt", e.target.value)} />
        </div>
        <div>
          <Label htmlFor="sc-exp" hint="Optional">
            Expected result
          </Label>
          <Input id="sc-exp" type="date" value={d.expectedResultAt} onChange={(e) => set("expectedResultAt", e.target.value)} />
        </div>
      </div>
    );
  if (d.stage === "rejected")
    return (
      <div className="space-y-5">
        <p className="rounded-xl bg-night-2 px-3.5 py-2.5 text-sm text-dim">Rejections are part of the process. Logging them helps the team (and you) see the full picture.</p>
        <div className="max-w-56">
          <Label htmlFor="sc-rej" hint="Optional">
            Date
          </Label>
          <Input id="sc-rej" type="date" value={d.rejectedAt} onChange={(e) => set("rejectedAt", e.target.value)} />
        </div>
        <div>
          <Label htmlFor="sc-lesson" hint={`Optional · ${d.lesson.length}/400`}>
            What I learned
          </Label>
          <Textarea id="sc-lesson" rows={3} maxLength={400} value={d.lesson} onChange={(e) => set("lesson", e.target.value)} placeholder="e.g. My research proposal needed a clearer methodology section." />
        </div>
        <VisibilityChoice value={d.rejectedVisibility} onChange={(v) => set("rejectedVisibility", v)} />
      </div>
    );
  return (
    <div className="space-y-4">
      <div>
        <Label htmlFor="sc-prog">Programme</Label>
        <Input id="sc-prog" value={d.programme} maxLength={120} onChange={(e) => set("programme", e.target.value)} placeholder="MSc Bioinformatics" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="sc-uni" hint="Optional">
            University
          </Label>
          <Input id="sc-uni" value={d.university} maxLength={120} onChange={(e) => set("university", e.target.value)} placeholder="TU Munich" />
        </div>
        <div>
          <Label htmlFor="sc-start" hint="Optional">
            Start date
          </Label>
          <Input id="sc-start" type="date" value={d.startDate} onChange={(e) => set("startDate", e.target.value)} />
        </div>
      </div>
      <label className="flex min-h-11 cursor-pointer items-start gap-3 rounded-2xl border border-aurora/40 bg-aurora/[0.06] p-3.5 text-sm">
        <input type="checkbox" checked={d.announceConsent} onChange={(e) => set("announceConsent", e.target.checked)} className="mt-0.5 size-5 shrink-0 accent-[var(--aurora)]" />
        <span>
          <span className="font-medium">Can the team share this win on News?</span>
          <span className="block text-dim">They'll post a short congratulations with your name and programme.</span>
        </span>
      </label>
    </div>
  );
}

export function VisibilityChoice({ value, onChange }: { value: "team" | "members"; onChange: (v: "team" | "members") => void }) {
  const opts = [
    { v: "team" as const, title: "Only me and the Comskills team", body: "Other members won't see this entry.", icon: Lock },
    { v: "members" as const, title: "All members", body: "Shows on your profile, like your other entries.", icon: Users },
  ];
  return (
    <div role="radiogroup" aria-label="Who can see this rejection" className="grid gap-2">
      <p className="text-sm font-medium">Who can see this?</p>
      {opts.map((o) => (
        <button
          key={o.v}
          type="button"
          role="radio"
          aria-checked={value === o.v}
          onClick={() => onChange(o.v)}
          className={cx("flex items-start gap-3 rounded-2xl border p-3 text-left", value === o.v ? "border-brass bg-brass/[0.07]" : "border-line-strong hover:bg-raised-2")}
        >
          <o.icon className={cx("mt-0.5 size-5 shrink-0", value === o.v ? "text-brass" : "text-faint")} />
          <span>
            <span className="block text-sm font-medium">{o.title}</span>
            <span className="block text-sm text-dim">{o.body}</span>
          </span>
        </button>
      ))}
    </div>
  );
}

/** One entry; `actions` lets the owner's tracker add buttons. Also used read-only on profiles and team views. */
export function EntryCard({ e, actions, showOwner }: { e: ScholarshipDTO; actions?: React.ReactNode; showOwner?: boolean }) {
  return (
    <motion.div layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.96 }} className="min-w-0 rounded-2xl border border-line bg-raised/80 p-4">
      {showOwner && e.owner && (
        <p className="mb-2 flex items-center gap-2 text-sm text-dim">
          <Avatar name={e.owner.name} src={e.owner.photoUrl} size={22} /> {e.owner.name}
          {e.ownerBatch && <span className="text-faint">· {e.ownerBatch}</span>}
        </p>
      )}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-medium leading-snug">{e.name}</p>
          <p className="text-sm text-dim">{e.country}</p>
        </div>
        <Tag tone={STAGE_TONE[e.stage]}>{STAGE_LABEL[e.stage]}</Tag>
      </div>
      <div className="mt-2 space-y-1 text-sm">
        {e.stage === "applying" &&
          (e.deadline ? (
            <p className="flex flex-wrap items-center gap-2">
              <CalendarClock className="size-4 text-faint" /> Deadline {formatDate(e.deadline)} <DeadlinePill deadline={e.deadline} />
            </p>
          ) : (
            <p className="text-faint">No deadline added</p>
          ))}
        {e.stage === "applied" && (
          <p className="text-dim">
            Submitted {e.submittedAt ? formatDate(e.submittedAt) : "—"}
            {e.expectedResultAt && ` · result expected ${formatDate(e.expectedResultAt)}`}
          </p>
        )}
        {e.stage === "rejected" && (
          <>
            {e.rejectedAt && <p className="text-dim">On {formatDate(e.rejectedAt)}</p>}
            {e.lesson && <p className="italic text-dim">“{e.lesson}”</p>}
            {e.isMine && (
              <p className="flex items-center gap-1.5 text-xs text-faint">
                {e.rejectedVisibility === "team" ? <Lock className="size-3.5" /> : <Users className="size-3.5" />}
                {e.rejectedVisibility === "team" ? "Only you and the Comskills team" : "Visible to all members"}
              </p>
            )}
          </>
        )}
        {e.stage === "accepted" && (
          <>
            <p className="flex items-start gap-1.5">
              <PartyPopper className="mt-0.5 size-4 shrink-0 text-aurora" />
              <span>
                {e.programme}
                {e.university && ` at ${e.university}`}
                {e.startDate && <span className="text-dim"> · starts {formatDate(e.startDate)}</span>}
              </span>
            </p>
            {e.isMine && (e.announcedAt ? <p className="text-xs text-aurora">Announced on News 🎉</p> : e.announceConsent ? <p className="text-xs text-faint">The team may share this on News.</p> : null)}
          </>
        )}
        {e.link && (
          <a href={e.link} target="_blank" rel="noopener noreferrer nofollow" className="inline-flex min-h-9 items-center gap-1 text-sm text-brass hover:underline">
            <ExternalLink className="size-3.5" /> {hostLabel(e.link)}
          </a>
        )}
      </div>
      {actions && <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-line pt-3">{actions}</div>}
    </motion.div>
  );
}

/** A compact read-only list for profiles. */
export function ProfileScholarships({ items }: { items: ScholarshipDTO[] }) {
  const [shown, setShown] = useState(4);
  useEffect(() => setShown(4), [items]);
  if (!items.length) return <p className="mt-3 text-sm text-faint">Nothing shared yet.</p>;
  return (
    <div className="mt-4 space-y-2">
      {items.slice(0, shown).map((e) => (
        <EntryCard key={e.id} e={e} />
      ))}
      {items.length > shown && (
        <button onClick={() => setShown(items.length)} className="h-10 text-sm text-brass hover:underline">
          Show all {items.length}
        </button>
      )}
    </div>
  );
}
