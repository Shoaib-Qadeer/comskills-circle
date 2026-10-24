"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { EyeOff, Users, Handshake, Sparkles } from "lucide-react";
import type { MeDTO, Visibility } from "@/lib/types";
import { FIELDS, getField } from "@/lib/taxonomy";
import { api } from "@/lib/client";
import { Avatar, cx, FieldChip, Input, Label, ErrorText } from "./ui";

export type ProfileDraft = Omit<MeDTO, "id" | "email" | "isAdmin" | "hasPosted" | "onboarded">;

export function draftFromMe(me: MeDTO): ProfileDraft {
  const { id: _i, email: _e, isAdmin: _a, hasPosted: _h, onboarded: _o, ...rest } = me;
  return rest;
}

/** Taxonomy chip grid with optional AI-suggested ghost chips. */
export function FieldPicker({
  value,
  onChange,
  headline,
  summary,
  max = 6,
}: {
  value: string[];
  onChange: (v: string[]) => void;
  headline: string;
  summary: string;
  max?: number;
}) {
  const [suggested, setSuggested] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const lastText = useRef("");

  // Ask for suggestions once the person has written something, debounced.
  useEffect(() => {
    const text = `${headline}\n${summary}`.trim();
    if (text.length < 25 || text === lastText.current) return;
    const t = setTimeout(async () => {
      lastText.current = text;
      setLoading(true);
      try {
        const r = await api<{ fields: string[] }>("/api/me/suggest", "POST", { headline, summary, fields: value });
        setSuggested(r.fields);
      } catch {
        /* suggestions are optional */
      } finally {
        setLoading(false);
      }
    }, 1200);
    return () => clearTimeout(t);
  }, [headline, summary, value]);

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
            <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-dashed border-brass/40 bg-brass/5 p-3">
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
        {FIELDS.map((f, i) => (
          <motion.div key={f.slug} initial={{ opacity: 0, scale: 0.85 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.012 }}>
            <FieldChip slug={f.slug} selected={value.includes(f.slug)} onClick={() => toggle(f.slug)} />
          </motion.div>
        ))}
      </div>
      <p className="mt-3 text-sm text-faint">
        {value.length}/{max} chosen
      </p>
    </div>
  );
}

const VIS: { value: Visibility; title: string; body: string; icon: typeof EyeOff }[] = [
  { value: "private", title: "Private", body: "Only the matcher reads your goals. You still get matches, and nobody sees your profile.", icon: EyeOff },
  { value: "class", title: "Class", body: "Classmates see your direction, fields and links, and can send opportunities your way.", icon: Users },
  { value: "open", title: "Open to collaborate", body: "Everything in Class, plus what you can help with and what you want to team up on.", icon: Handshake },
];

export function VisibilityPicker({ value, onChange }: { value: Visibility; onChange: (v: Visibility) => void }) {
  return (
    <div role="radiogroup" className="grid gap-3">
      {VIS.map((v) => {
        const active = v.value === value;
        return (
          <button
            key={v.value}
            role="radio"
            aria-checked={active}
            onClick={() => onChange(v.value)}
            className={cx(
              "relative flex items-start gap-4 rounded-2xl border p-4 text-left transition-colors",
              active ? "border-brass bg-brass/[0.07]" : "border-line-strong hover:border-line-strong hover:bg-raised-2",
            )}
          >
            <span className={cx("grid size-10 shrink-0 place-items-center rounded-xl", active ? "bg-brass text-brass-ink" : "bg-night-2 text-dim")}>
              <v.icon className="size-5" />
            </span>
            <span>
              <span className="block font-medium">{v.title}</span>
              <span className="mt-0.5 block text-sm text-dim">{v.body}</span>
            </span>
            {active && <motion.span layoutId="vis-dot" className="absolute right-4 top-4 size-2.5 rounded-full bg-brass" />}
          </button>
        );
      })}
    </div>
  );
}

/** Exactly what a classmate will see for the chosen visibility. */
export function ProfilePreview({ d, name, photoUrl }: { d: ProfileDraft; name: string; photoUrl: string | null }) {
  return (
    <div className="rounded-2xl border border-line bg-night-2 p-5">
      <p className="mb-4 text-sm text-faint">What classmates see</p>
      <AnimatePresence mode="wait">
        {d.visibility === "private" ? (
          <motion.div key="p" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col items-center py-6 text-center">
            <div className="mb-3 flex -space-x-2">
              {[0, 1, 2].map((i) => (
                <span key={i} className="size-7 rounded-full border border-line-strong bg-raised-2" />
              ))}
            </div>
            <p className="font-medium">Nothing about you</p>
            <p className="mt-1 text-sm text-dim">On the Class page you’re one of the “classmates exploring privately”.</p>
          </motion.div>
        ) : (
          <motion.div key="v" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="flex items-center gap-3">
              <Avatar name={name} src={photoUrl} size={44} ring={d.visibility === "open" ? "aurora" : undefined} />
              <div className="min-w-0">
                <p className="font-medium">{name}</p>
                <p className="truncate text-sm text-dim">{d.headline || "Your headline"}</p>
              </div>
            </div>
            {d.fields.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-1.5">
                {d.fields.map((f) => (
                  <FieldChip key={f} slug={f} size="sm" />
                ))}
              </div>
            )}
            {d.visibility === "open" && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="mt-4 space-y-1 text-sm">
                <p className="text-aurora">Open to collaborate</p>
                {d.skillsOffered.length > 0 && <p className="text-dim">Can help with {d.skillsOffered.join(", ")}</p>}
              </motion.div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function LinksFields({ links, onChange }: { links: ProfileDraft["links"]; onChange: (l: ProfileDraft["links"]) => void }) {
  const items: { k: keyof ProfileDraft["links"]; label: string; ph: string }[] = [
    { k: "linkedin", label: "LinkedIn", ph: "https://www.linkedin.com/in/…" },
    { k: "cv", label: "CV (link)", ph: "https://drive.google.com/…" },
    { k: "portfolio", label: "Portfolio or website", ph: "https://…" },
    { k: "github", label: "GitHub", ph: "https://github.com/…" },
  ];
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {items.map((it) => {
        const v = links[it.k] || "";
        const bad = v.length > 0 && !/^https?:\/\/\S+\.\S+/.test(v);
        return (
          <div key={it.k}>
            <Label htmlFor={`link-${it.k}`}>{it.label}</Label>
            <Input id={`link-${it.k}`} type="url" inputMode="url" placeholder={it.ph} value={v} invalid={bad} onChange={(e) => onChange({ ...links, [it.k]: e.target.value })} />
            <ErrorText>{bad && "Start with https://"}</ErrorText>
          </div>
        );
      })}
    </div>
  );
}

export function linksValid(links: ProfileDraft["links"]) {
  return Object.values(links).every((v) => !v || /^https?:\/\/\S+\.\S+/.test(v));
}

export function fieldLabels(slugs: string[]) {
  return slugs.map((s) => getField(s).label).join(", ");
}
