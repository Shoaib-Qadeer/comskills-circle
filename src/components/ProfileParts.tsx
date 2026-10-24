"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Camera, Code2, Globe, Lock, Sparkles, Trash2, UserRound } from "lucide-react";
import type { MeDTO } from "@/lib/types";
import {
  FIELDS,
  FIELD_OF_STUDY_EXAMPLES,
  getField,
  LOOKING_FOR,
  SUGGESTED_SKILLS,
  SUGGESTED_TOOLS,
  VOLUNTEER_AREAS,
  VOLUNTEER_FOR,
  lookingForLabel,
} from "@/lib/taxonomy";
import { api } from "@/lib/client";
import { normalizeWhatsapp, prettyPhone } from "@/lib/phone";
import { resizePhoto } from "@/lib/image-resize";
import { Avatar, ChipInput, cx, ErrorText, FieldChip, Input, Label, Tag, Textarea, Toggle } from "./ui";

/** Everything a member edits about themselves (in onboarding and Settings). */
export type ProfileDraft = {
  name: string;
  university: string;
  city: string;
  country: string;
  whatsapp: string;
  contactEmail: string;
  fieldOfStudy: string;
  skills: string[];
  tools: string[];
  experience: string;
  links: { linkedin?: string; github?: string; portfolio?: string };
  lookingFor: MeDTO["lookingFor"];
  lookingForNote: string;
  volunteering: MeDTO["volunteering"];
  fields: string[];
  freeTags: string[];
};

export function draftFromMe(me: MeDTO): ProfileDraft {
  return {
    name: me.name,
    university: me.university,
    city: me.city,
    country: me.country || "Pakistan",
    whatsapp: me.whatsapp ?? "",
    contactEmail: me.contactEmail ?? me.email,
    fieldOfStudy: me.fieldOfStudy,
    skills: me.skills,
    tools: me.tools,
    experience: me.experience,
    links: me.links,
    lookingFor: me.lookingFor,
    lookingForNote: me.lookingForNote,
    volunteering: me.volunteering,
    fields: me.fields,
    freeTags: me.freeTags,
  };
}

/** The body sent to PATCH /api/me. */
export function draftToPatch(d: ProfileDraft) {
  return {
    ...d,
    whatsapp: d.whatsapp.trim() || null,
    contactEmail: d.contactEmail.trim() || null,
    links: Object.fromEntries(Object.entries(d.links).filter(([, v]) => v && v.trim())),
  };
}

export const linkOk = (v?: string) => !v || /^https?:\/\/\S+\.\S+/.test(v.trim());
const emailOk = (v: string) => !v.trim() || /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v.trim());

export function basicsProblems(d: ProfileDraft): string | null {
  if (d.name.trim().length < 2) return "Add your name.";
  if (!d.university.trim()) return "Add your university (or the last one you studied at).";
  if (!d.city.trim()) return "Add your city.";
  if (d.whatsapp.trim() && !normalizeWhatsapp(d.whatsapp)) return "Check your WhatsApp number, e.g. 0300 1234567.";
  if (!emailOk(d.contactEmail)) return "Check your contact email.";
  return null;
}
export function technicalProblems(d: ProfileDraft): string | null {
  if (!d.fieldOfStudy.trim()) return "Add your field of study.";
  if (!d.skills.length) return "Add at least one skill.";
  if (!Object.values(d.links).every((v) => linkOk(v))) return "Links should start with https://";
  return null;
}
export function lookingForProblems(d: ProfileDraft): string | null {
  if (!d.fields.length) return "Pick at least one field. It's how matching starts.";
  return null;
}

export const UNIVERSITY_SUGGESTIONS = [
  "COMSATS University Islamabad",
  "National University of Sciences and Technology (NUST)",
  "Quaid-i-Azam University",
  "University of the Punjab",
  "University of Karachi",
  "Lahore University of Management Sciences (LUMS)",
  "University of Agriculture, Faisalabad",
  "Aga Khan University",
  "FAST-NUCES",
  "International Islamic University Islamabad",
  "University of Engineering and Technology (UET) Lahore",
  "Government College University Lahore",
  "University of Peshawar",
  "Bahauddin Zakariya University",
  "Air University",
  "Riphah International University",
];

/* ------------------------------------------------------------------ photo */

export function PhotoPicker({ name, photoUrl, onChange }: { name: string; photoUrl: string | null; onChange: (url: string | null) => void }) {
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function pick(file: File | undefined) {
    if (!file) return;
    setErr(null);
    setBusy(true);
    try {
      const blob = await resizePhoto(file);
      const res = await fetch("/api/me/photo", { method: "POST", headers: { "content-type": blob.type }, body: blob });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Upload failed. Try again.");
      onChange(data.photoUrl);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Upload failed. Try again.");
    } finally {
      setBusy(false);
      if (ref.current) ref.current.value = "";
    }
  }

  async function remove() {
    setBusy(true);
    try {
      await api("/api/me/photo", "DELETE");
      onChange(null);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not remove the photo.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center gap-4">
      <button
        type="button"
        onClick={() => ref.current?.click()}
        className="group relative shrink-0 rounded-full"
        aria-label={photoUrl ? "Change your photo" : "Add a photo"}
        disabled={busy}
      >
        <Avatar name={name || "?"} src={photoUrl} size={72} />
        <span className="absolute -bottom-1 -right-1 grid size-8 place-items-center rounded-full border border-line-strong bg-raised text-brass shadow group-hover:bg-raised-2">
          {busy ? <span className="size-4 animate-spin rounded-full border-2 border-current border-r-transparent" /> : <Camera className="size-4" />}
        </span>
      </button>
      <div className="min-w-0">
        <p className="text-sm font-medium">{photoUrl ? "Looking good" : "Add a photo (optional)"}</p>
        <p className="text-xs text-faint">A clear face helps people recognise you. It's resized on your phone first, so it uploads fast.</p>
        <div className="mt-1 flex gap-1">
          <button type="button" onClick={() => ref.current?.click()} className="inline-flex h-9 items-center rounded-full px-2 text-sm text-brass hover:underline" disabled={busy}>
            {photoUrl ? "Change" : "Choose a photo"}
          </button>
          {photoUrl && (
            <button type="button" onClick={remove} className="inline-flex h-9 items-center gap-1 rounded-full px-2 text-sm text-dim hover:text-ember" disabled={busy}>
              <Trash2 className="size-3.5" /> Remove
            </button>
          )}
        </div>
        <ErrorText>{err}</ErrorText>
      </div>
      <input ref={ref} type="file" accept="image/*" className="hidden" onChange={(e) => pick(e.target.files?.[0])} />
    </div>
  );
}

/* ------------------------------------------------------------------ sections */

type SectionProps = { d: ProfileDraft; set: <K extends keyof ProfileDraft>(k: K, v: ProfileDraft[K]) => void };

export function BasicsFields({ d, set, accountEmail }: SectionProps & { accountEmail: string }) {
  const normalized = d.whatsapp.trim() ? normalizeWhatsapp(d.whatsapp) : null;
  return (
    <div className="space-y-5">
      <div>
        <Label htmlFor="p-name">Your name</Label>
        <Input id="p-name" value={d.name} onChange={(e) => set("name", e.target.value)} maxLength={80} autoComplete="name" />
      </div>
      <div>
        <Label htmlFor="p-uni" hint="Current or most recent">
          University
        </Label>
        <Input id="p-uni" list="uni-list" value={d.university} onChange={(e) => set("university", e.target.value)} maxLength={120} placeholder="e.g. COMSATS University Islamabad" />
        <datalist id="uni-list">
          {UNIVERSITY_SUGGESTIONS.map((u) => (
            <option key={u} value={u} />
          ))}
        </datalist>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="p-city">City</Label>
          <Input id="p-city" value={d.city} onChange={(e) => set("city", e.target.value)} maxLength={80} autoComplete="address-level2" placeholder="Lahore" />
        </div>
        <div>
          <Label htmlFor="p-country">Country</Label>
          <Input id="p-country" value={d.country} onChange={(e) => set("country", e.target.value)} maxLength={80} autoComplete="country-name" />
        </div>
      </div>
      <div className="rounded-2xl border border-line p-4">
        <p className="mb-3 flex items-center gap-2 text-sm text-dim">
          <Lock className="size-4 text-aurora" /> Only people you connect with can see these.
        </p>
        <div className="space-y-4">
          <div>
            <Label htmlFor="p-wa" hint="Optional">
              WhatsApp number
            </Label>
            <Input id="p-wa" type="tel" inputMode="tel" autoComplete="tel" value={d.whatsapp} onChange={(e) => set("whatsapp", e.target.value)} placeholder="0300 1234567" invalid={Boolean(d.whatsapp.trim()) && !normalized} />
            {d.whatsapp.trim() && <p className={cx("mt-1.5 text-xs", normalized ? "text-faint" : "text-ember")}>{normalized ? `Saved as ${prettyPhone(normalized)}` : "That doesn't look like a phone number yet."}</p>}
          </div>
          <div>
            <Label htmlFor="p-cemail" hint="Defaults to your sign-in email">
              Contact email
            </Label>
            <Input id="p-cemail" type="email" inputMode="email" value={d.contactEmail} onChange={(e) => set("contactEmail", e.target.value)} placeholder={accountEmail} invalid={!emailOk(d.contactEmail)} />
          </div>
        </div>
      </div>
    </div>
  );
}

export function TechnicalFields({ d, set }: SectionProps) {
  const [ex, setEx] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setEx((i) => (i + 1) % FIELD_OF_STUDY_EXAMPLES.length), 2400);
    return () => clearInterval(t);
  }, []);
  const links: { k: keyof ProfileDraft["links"]; label: string; ph: string }[] = [
    { k: "linkedin", label: "LinkedIn", ph: "https://www.linkedin.com/in/…" },
    { k: "github", label: "GitHub", ph: "https://github.com/…" },
    { k: "portfolio", label: "Portfolio or website", ph: "https://…" },
  ];
  return (
    <div className="space-y-6">
      <div>
        <Label htmlFor="p-fos">Field of study</Label>
        <div className="relative">
          <Input id="p-fos" value={d.fieldOfStudy} onChange={(e) => set("fieldOfStudy", e.target.value)} maxLength={120} />
          {!d.fieldOfStudy && (
            <AnimatePresence mode="wait">
              <motion.span key={ex} initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -5 }} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-faint">
                {FIELD_OF_STUDY_EXAMPLES[ex]}
              </motion.span>
            </AnimatePresence>
          )}
        </div>
      </div>
      <div>
        <Label hint={`${d.skills.length}/15`}>Skills</Label>
        <ChipInput values={d.skills} onChange={(v) => set("skills", v)} suggestions={SUGGESTED_SKILLS} max={15} placeholder="Type a skill and press Enter" />
      </div>
      <div>
        <Label hint="Optional">Tools you use</Label>
        <ChipInput values={d.tools} onChange={(v) => set("tools", v)} suggestions={SUGGESTED_TOOLS} max={15} placeholder="Python, R, Figma…" />
      </div>
      <div>
        <Label htmlFor="p-exp" hint={`${d.experience.length}/1200`}>
          Past projects or experience
        </Label>
        <Textarea
          id="p-exp"
          rows={5}
          maxLength={1200}
          value={d.experience}
          onChange={(e) => set("experience", e.target.value)}
          placeholder="For example: Final-year project on detecting plant disease from leaf photos. Lab work on antibiotic resistance. Volunteered teaching Python to school students."
        />
        <p className="mt-1.5 text-xs text-faint">English, Urdu or Roman Urdu are all fine.</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        {links.map((l) => {
          const v = d.links[l.k] || "";
          return (
            <div key={l.k}>
              <Label htmlFor={`p-link-${l.k}`} hint="Optional">
                {l.label}
              </Label>
              <Input id={`p-link-${l.k}`} type="url" inputMode="url" value={v} placeholder={l.ph} invalid={!linkOk(v)} onChange={(e) => set("links", { ...d.links, [l.k]: e.target.value })} />
              <ErrorText>{!linkOk(v) && "Start with https://"}</ErrorText>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function LookingForFields({ d, set }: SectionProps) {
  const toggle = (v: ProfileDraft["lookingFor"][number]) => set("lookingFor", d.lookingFor.includes(v) ? d.lookingFor.filter((x) => x !== v) : [...d.lookingFor, v]);
  const text = [d.fieldOfStudy, d.skills.join(", "), d.experience, d.lookingForNote].filter(Boolean).join("\n");
  return (
    <div className="space-y-7">
      <div>
        <Label>I'm looking for</Label>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Looking for">
          {LOOKING_FOR.map((l) => {
            const on = d.lookingFor.includes(l.value);
            return (
              <motion.button
                key={l.value}
                type="button"
                whileTap={{ scale: 0.94 }}
                onClick={() => toggle(l.value)}
                aria-pressed={on}
                className={cx("inline-flex h-11 items-center gap-2 rounded-full border px-4 text-sm transition-colors", on ? "border-brass bg-brass/15 text-star" : "border-line-strong text-dim hover:text-star")}
              >
                <span aria-hidden>{l.emoji}</span> {l.label}
              </motion.button>
            );
          })}
        </div>
      </div>
      <div>
        <Label htmlFor="p-lfn" hint={`${d.lookingForNote.length}/400`}>
          Tell us a bit more
        </Label>
        <Textarea
          id="p-lfn"
          rows={3}
          maxLength={400}
          value={d.lookingForNote}
          onChange={(e) => set("lookingForNote", e.target.value)}
          placeholder="e.g. A fully funded master's in bioinformatics in Europe, and teammates for a health-data project."
        />
      </div>
      <div>
        <Label>Fields you care about</Label>
        <FieldPicker value={d.fields} onChange={(v) => set("fields", v)} text={text} onTags={(t) => set("freeTags", Array.from(new Set([...d.freeTags, ...t])).slice(0, 8))} />
      </div>
    </div>
  );
}

export function VolunteeringFields({ d, set }: SectionProps) {
  const v = d.volunteering;
  const setV = (patch: Partial<ProfileDraft["volunteering"]>) => set("volunteering", { ...v, ...patch });
  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-line p-4">
        <Toggle
          checked={v.open}
          onChange={(open) => setV(open ? { open, for: v.for ?? "comskills" } : { open: false })}
          label="I'm open to volunteering"
          description="The Comskills team looks here when they need mentors, hosts or helpers."
        />
      </div>
      <AnimatePresence initial={false}>
        {v.open && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="space-y-6 overflow-hidden">
            <div>
              <Label>For</Label>
              <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Volunteer for">
                {VOLUNTEER_FOR.map((o) => (
                  <button
                    key={o.value}
                    type="button"
                    role="radio"
                    aria-checked={v.for === o.value}
                    onClick={() => setV({ for: o.value })}
                    className={cx("h-11 rounded-full border px-4 text-sm", v.for === o.value ? "border-brass bg-brass/15 text-star" : "border-line-strong text-dim hover:text-star")}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <Label>Areas</Label>
              <div className="flex flex-wrap gap-2">
                {VOLUNTEER_AREAS.map((a) => {
                  const on = v.areas.includes(a);
                  return (
                    <button
                      key={a}
                      type="button"
                      aria-pressed={on}
                      onClick={() => setV({ areas: on ? v.areas.filter((x) => x !== a) : [...v.areas, a] })}
                      className={cx("h-10 rounded-full border px-3.5 text-sm", on ? "border-aurora bg-aurora/15 text-star" : "border-line-strong text-dim hover:text-star")}
                    >
                      {a}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="max-w-48">
              <Label htmlFor="p-hours" hint="Optional">
                Hours per month
              </Label>
              <Input
                id="p-hours"
                type="number"
                inputMode="numeric"
                min={0}
                max={200}
                value={v.hoursPerMonth ?? ""}
                onChange={(e) => setV({ hoursPerMonth: e.target.value === "" ? null : Math.max(0, Math.min(200, Math.round(Number(e.target.value)))) })}
                placeholder="4"
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ------------------------------------------------------------------ fields picker */

/** Taxonomy chip grid with AI-suggested ghost chips (debounced; optional). */
export function FieldPicker({ value, onChange, text, max = 6, onTags }: { value: string[]; onChange: (v: string[]) => void; text: string; max?: number; onTags?: (t: string[]) => void }) {
  const [suggested, setSuggested] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const lastText = useRef("");

  useEffect(() => {
    const t0 = text.trim();
    if (t0.length < 25 || t0 === lastText.current) return;
    const t = setTimeout(async () => {
      lastText.current = t0;
      setLoading(true);
      try {
        const r = await api<{ fields: string[]; freeTags: string[] }>("/api/me/suggest", "POST", { text: t0, chosen: value });
        setSuggested(r.fields);
        if (r.freeTags?.length) onTags?.(r.freeTags);
      } catch {
        /* suggestions are optional */
      } finally {
        setLoading(false);
      }
    }, 1200);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text]);

  const toggle = (slug: string) => {
    if (value.includes(slug)) onChange(value.filter((v) => v !== slug));
    else if (value.length < max) onChange([...value, slug]);
  };
  const ghosts = suggested.filter((s) => !value.includes(s));

  return (
    <div>
      <AnimatePresence>
        {(ghosts.length > 0 || loading) && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="mb-4 overflow-hidden">
            <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-dashed border-brass/40 bg-brass/5 p-3" aria-live="polite">
              <span className="mr-1 flex items-center gap-1.5 text-sm text-brass">
                <Sparkles className="size-4" /> {loading ? "Reading what you wrote…" : "Suggested from what you wrote"}
              </span>
              {ghosts.map((s) => (
                <FieldChip key={s} slug={s} ghost onClick={() => toggle(s)} />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      <div className="flex flex-wrap gap-2">
        {FIELDS.map((f) => (
          <FieldChip key={f.slug} slug={f.slug} selected={value.includes(f.slug)} onClick={() => toggle(f.slug)} />
        ))}
      </div>
      <p className="mt-3 text-sm text-faint">
        {value.length}/{max} chosen
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ preview */

/** Exactly what other members see on your card. */
export function ProfilePreview({ d, photoUrl, teamTitle, batchLabel }: { d: ProfileDraft; photoUrl: string | null; teamTitle?: string | null; batchLabel?: string | null }) {
  return (
    <div className="rounded-2xl border border-line bg-night-2 p-5">
      <p className="mb-4 text-sm text-faint">What other members see</p>
      <div className="flex items-start gap-3">
        <Avatar name={d.name} src={photoUrl} size={52} />
        <div className="min-w-0">
          <p className="font-display text-lg font-semibold leading-tight">{d.name}</p>
          <p className="mt-0.5 text-sm text-dim">{[d.fieldOfStudy, [d.university, d.city].filter(Boolean).join(" · ")].filter(Boolean).join(" — ")}</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {teamTitle ? <Tag tone="violet">Team · {teamTitle}</Tag> : batchLabel ? <Tag>{batchLabel}</Tag> : null}
            {d.volunteering.open && <Tag tone="aurora">Open to volunteer</Tag>}
          </div>
        </div>
      </div>
      {d.skills.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-1.5">
          {d.skills.slice(0, 6).map((s) => (
            <Tag key={s} tone="brass">
              {s}
            </Tag>
          ))}
        </div>
      )}
      {d.lookingFor.length > 0 && <p className="mt-3 text-sm text-dim">Looking for: {d.lookingFor.map(lookingForLabel).join(", ")}</p>}
      {d.fields.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {d.fields.map((f) => (
            <FieldChip key={f} slug={f} size="sm" />
          ))}
        </div>
      )}
      <p className="mt-4 flex items-center gap-2 text-xs text-faint">
        <Lock className="size-3.5" /> WhatsApp and email stay hidden until you accept a connect request.
      </p>
    </div>
  );
}

export function LinkPills({ links }: { links: ProfileDraft["links"] }) {
  const items = [
    links.linkedin && { href: links.linkedin, label: "LinkedIn", icon: UserRound },
    links.github && { href: links.github, label: "GitHub", icon: Code2 },
    links.portfolio && { href: links.portfolio, label: "Website", icon: Globe },
  ].filter(Boolean) as { href: string; label: string; icon: typeof Globe }[];
  if (!items.length) return null;
  return (
    <div className="flex flex-wrap gap-2">
      {items.map((i) => (
        <a key={i.label} href={i.href} target="_blank" rel="noopener noreferrer nofollow" className="inline-flex h-10 items-center gap-1.5 rounded-full border border-line-strong px-3.5 text-sm hover:bg-raised-2">
          <i.icon className="size-4" /> {i.label}
        </a>
      ))}
    </div>
  );
}

export function fieldLabels(slugs: string[]) {
  return slugs.map((s) => getField(s).label).join(", ");
}
