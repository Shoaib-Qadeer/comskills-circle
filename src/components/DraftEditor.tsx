"use client";

import type { DegreeLevel, ExtractedDraft, Funding, OppType, RemoteMode } from "@/lib/types";
import { DEGREE_LEVELS, FIELDS, FUNDED_TYPES, FUNDING, OPPORTUNITY_TYPES, PAID_TYPES } from "@/lib/taxonomy";
import { ChipInput, FieldChip, Input, Label, Textarea, cx } from "./ui";

/** Highlights fields the extractor couldn't find, so the poster knows where to look. */
function Missing({ show }: { show: boolean }) {
  if (!show) return null;
  return <span className="text-xs font-normal text-brass">Couldn’t find this — add it if you know</span>;
}

const selectCls =
  "h-11 w-full appearance-none rounded-[var(--radius-field)] border border-line-strong bg-night-2 px-3.5 text-star focus:border-brass focus:outline-none focus:ring-2 focus:ring-[var(--glow)]";
const missingCls = "border-brass/60 bg-brass/[0.06]";

function TriState({ value, onChange, labels }: { value: boolean | null; onChange: (v: boolean | null) => void; labels: [string, string, string] }) {
  const opts: { v: boolean | null; l: string }[] = [
    { v: true, l: labels[0] },
    { v: false, l: labels[1] },
    { v: null, l: labels[2] },
  ];
  return (
    <div className="inline-flex rounded-full border border-line-strong bg-night-2 p-1">
      {opts.map((o) => (
        <button
          key={String(o.v)}
          type="button"
          onClick={() => onChange(o.v)}
          aria-pressed={value === o.v}
          className={cx("h-10 rounded-full px-3 text-sm sm:h-8", value === o.v ? "bg-raised-2 text-star" : "text-dim hover:text-star")}
        >
          {o.l}
        </button>
      ))}
    </div>
  );
}

export function DraftEditor({ d, onChange, highlightMissing = true }: { d: ExtractedDraft; onChange: (d: ExtractedDraft) => void; highlightMissing?: boolean }) {
  const set = <K extends keyof ExtractedDraft>(k: K, v: ExtractedDraft[K]) => onChange({ ...d, [k]: v });
  const miss = (v: unknown) => highlightMissing && (v === null || v === "" || (Array.isArray(v) && v.length === 0));
  const funded = FUNDED_TYPES.includes(d.type);
  const paidType = PAID_TYPES.includes(d.type);
  return (
    <div className="grid gap-5 sm:grid-cols-2">
      <div className="sm:col-span-2">
        <Label htmlFor="d-title">Title</Label>
        <Input id="d-title" value={d.title} onChange={(e) => set("title", e.target.value)} className="font-display text-lg font-semibold" maxLength={160} />
      </div>
      <div>
        <Label htmlFor="d-org" hint={<Missing show={miss(d.organization)} />}>
          Organization
        </Label>
        <Input id="d-org" value={d.organization ?? ""} onChange={(e) => set("organization", e.target.value || null)} className={cx(miss(d.organization) && missingCls)} />
      </div>
      <div>
        <Label htmlFor="d-type">Type</Label>
        <select id="d-type" className={selectCls} value={d.type} onChange={(e) => set("type", e.target.value as OppType)}>
          {OPPORTUNITY_TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.emoji} {t.label}
            </option>
          ))}
        </select>
      </div>
      <div>
        <Label htmlFor="d-country" hint={<Missing show={miss(d.country)} />}>
          Country
        </Label>
        <Input id="d-country" value={d.country ?? ""} onChange={(e) => set("country", e.target.value || null)} className={cx(miss(d.country) && missingCls)} placeholder="Germany, or Online" maxLength={80} />
      </div>
      <div>
        <Label htmlFor="d-loc" hint="Optional">
          City or campus
        </Label>
        <Input id="d-loc" value={d.location ?? ""} onChange={(e) => set("location", e.target.value || null)} placeholder="Munich" maxLength={120} />
      </div>
      <div className="sm:col-span-2">
        <Label hint={<Missing show={miss(d.degreeLevel)} />}>Who is it for?</Label>
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Degree level">
          {DEGREE_LEVELS.map((l) => {
            const on = d.degreeLevel.includes(l.value);
            return (
              <button
                key={l.value}
                type="button"
                aria-pressed={on}
                onClick={() => {
                  const v = l.value as DegreeLevel;
                  if (v === "any") return set("degreeLevel", on ? [] : ["any"]);
                  const rest = d.degreeLevel.filter((x) => x !== "any" && x !== v);
                  set("degreeLevel", on ? rest : [...rest, v]);
                }}
                className={cx("h-11 rounded-full border px-4 text-sm sm:h-9", on ? "border-brass bg-brass/15 text-star" : "border-line-strong text-dim hover:text-star")}
              >
                {l.label}
              </button>
            );
          })}
        </div>
      </div>
      <div>
        <Label htmlFor="d-funding" hint={funded ? <Missing show={miss(d.funding)} /> : "Optional"}>
          Funding
        </Label>
        <select id="d-funding" className={cx(selectCls, funded && miss(d.funding) && missingCls)} value={d.funding ?? ""} onChange={(e) => set("funding", (e.target.value || null) as Funding | null)}>
          <option value="">Not stated</option>
          {FUNDING.map((f) => (
            <option key={f.value} value={f.value}>
              {f.label}
            </option>
          ))}
        </select>
      </div>
      <div>
        <Label htmlFor="d-remote">On site or online?</Label>
        <select id="d-remote" className={cx(selectCls, miss(d.remote) && missingCls)} value={d.remote ?? ""} onChange={(e) => set("remote", (e.target.value || null) as RemoteMode | null)}>
          <option value="">Not stated</option>
          <option value="onsite">On site</option>
          <option value="hybrid">Hybrid</option>
          <option value="remote">Remote</option>
        </select>
      </div>
      <div>
        <Label htmlFor="d-deadline" hint={<Missing show={miss(d.deadline)} />}>
          Application deadline
        </Label>
        <Input id="d-deadline" type="date" value={d.deadline ?? ""} onChange={(e) => set("deadline", e.target.value || null)} className={cx(miss(d.deadline) && missingCls)} />
      </div>
      <div>
        <Label htmlFor="d-start">Start date</Label>
        <Input id="d-start" type="date" value={d.startDate ?? ""} onChange={(e) => set("startDate", e.target.value || null)} />
      </div>
      <div>
        <Label htmlFor="d-dur" hint="Optional">
          Duration (months)
        </Label>
        <Input
          id="d-dur"
          type="number"
          inputMode="decimal"
          step="0.5"
          min={0}
          max={60}
          value={d.durationMonths ?? ""}
          onChange={(e) => set("durationMonths", e.target.value === "" ? null : Math.max(0, Math.min(60, Number(e.target.value))))}
          placeholder="24"
        />
      </div>
      {paidType && (
        <div>
          <Label>Paid?</Label>
          <TriState value={d.paid} onChange={(v) => set("paid", v)} labels={["Paid", "Unpaid", "Not stated"]} />
        </div>
      )}
      <div className="sm:col-span-2">
        <Label hint={<Missing show={miss(d.fields)} />}>Fields (up to 4)</Label>
        <div className="flex flex-wrap gap-1.5">
          {FIELDS.map((f) => (
            <FieldChip
              key={f.slug}
              slug={f.slug}
              size="sm"
              selected={d.fields.includes(f.slug)}
              onClick={() => set("fields", d.fields.includes(f.slug) ? d.fields.filter((x) => x !== f.slug) : d.fields.length < 4 ? [...d.fields, f.slug] : d.fields)}
            />
          ))}
        </div>
      </div>
      <div className="sm:col-span-2">
        <Label>Other topics</Label>
        <ChipInput values={d.tags} onChange={(v) => set("tags", v.map((x) => x.toLowerCase()))} max={6} placeholder="e.g. genomics, nlp, ielts…" />
      </div>
      <div className="sm:col-span-2">
        <Label htmlFor="d-elig">Eligibility</Label>
        <Input id="d-elig" value={d.eligibility ?? ""} onChange={(e) => set("eligibility", e.target.value || null)} placeholder="Bachelor's with 16 years of education, IELTS 6.5…" maxLength={240} />
      </div>
      <div className="sm:col-span-2">
        <Label htmlFor="d-sum" hint={<Missing show={miss(d.summary)} />}>
          Summary
        </Label>
        <Textarea id="d-sum" rows={3} value={d.summary} onChange={(e) => set("summary", e.target.value)} className={cx(miss(d.summary) && missingCls)} maxLength={600} />
      </div>
    </div>
  );
}

export function emptyDraft(url = ""): ExtractedDraft {
  return {
    url,
    title: "",
    organization: null,
    location: null,
    remote: null,
    type: "scholarship",
    country: null,
    degreeLevel: [],
    funding: null,
    deadline: null,
    startDate: null,
    durationMonths: null,
    paid: null,
    fields: [],
    tags: [],
    eligibility: null,
    summary: "",
  };
}
