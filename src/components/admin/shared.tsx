"use client";

import { useEffect, useState } from "react";
import useSWR, { mutate as globalMutate } from "swr";
import { AnimatePresence, motion } from "motion/react";
import { toast } from "sonner";
import type { AppSettings, PromptKey } from "@/lib/settings";
import { api, formatDate } from "@/lib/client";
import { CountUp } from "../bits";
import { Button, Input, Label, cx } from "../ui";

export type Overview = {
  counts: { users: number; pending: number; onboarded: number; active7: number; open: number; archived: number; matches: number };
  ai: {
    provider: string;
    model: string;
    keyConfigured: boolean;
    enabled: boolean;
    dailyCallLimit: number;
    dailyTokenLimit: number;
    usage: { date: string; calls: number; inputTokens: number; outputTokens: number; errors: number }[];
  };
};


export type AdminTab = "overview" | "people" | "access" | "email" | "ai" | "content";

export function Stat({ label, value, tone, onClick }: { label: string; value: number | undefined; tone?: "brass" | "ember" | "aurora"; onClick?: () => void }) {
  const inner = (
    <>
      <p className={cx("font-display text-3xl font-semibold", tone === "brass" ? "text-brass" : tone === "ember" ? "text-ember" : tone === "aurora" ? "text-aurora" : "")}>
        {value === undefined ? "–" : <CountUp value={value} />}
      </p>
      <p className="mt-1 text-sm text-dim">{label}</p>
    </>
  );
  return onClick ? (
    <button onClick={onClick} className="rounded-2xl border border-line bg-raised/60 p-4 text-left transition-colors hover:border-line-strong">
      {inner}
    </button>
  ) : (
    <div className="rounded-2xl border border-line bg-raised/60 p-4">{inner}</div>
  );
}

export function Meter({ label, used, limit }: { label: string; used: number; limit: number }) {
  const pct = limit ? Math.min(100, (used / limit) * 100) : 0;
  return (
    <div>
      <div className="flex items-baseline justify-between text-sm">
        <span className="text-dim">{label}</span>
        <span className="tabular">
          {used.toLocaleString("en-GB")} <span className="text-faint">/ {limit.toLocaleString("en-GB")}</span>
        </span>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-night-2">
        <motion.div className={cx("h-full rounded-full", pct > 85 ? "bg-ember" : "bg-brass")} initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.8 }} />
      </div>
    </div>
  );
}

export function UsageChart({ usage }: { usage: Overview["ai"]["usage"] }) {
  const max = Math.max(1, ...usage.map((u) => u.inputTokens + u.outputTokens));
  return (
    <div className="mt-6">
      <p className="mb-2 text-sm text-dim">Tokens per day, last 14 days</p>
      <div className="flex h-28 items-end gap-1.5" role="img" aria-label="Daily AI token use over the last 14 days">
        {usage.map((u, i) => {
          const t = u.inputTokens + u.outputTokens;
          return (
            <div key={u.date} className="group relative flex h-full flex-1 flex-col justify-end">
              <motion.div
                className={cx("rounded-t-md", i === usage.length - 1 ? "bg-brass" : "bg-violet/60")}
                initial={{ height: 0 }}
                animate={{ height: `${Math.max(t ? 4 : 1, (t / max) * 100)}%` }}
                transition={{ delay: i * 0.02 }}
              />
              <span className="pointer-events-none absolute -top-14 left-1/2 z-10 hidden w-max -translate-x-1/2 rounded-lg border border-line-strong bg-raised px-2 py-1 text-xs group-hover:block">
                {formatDate(u.date)}
                <br />
                {t.toLocaleString("en-GB")} tokens, {u.calls} calls{u.errors ? `, ${u.errors} errors` : ""}
              </span>
            </div>
          );
        })}
      </div>
      <div className="mt-1 flex justify-between text-xs text-faint">
        <span>{usage[0] && formatDate(usage[0].date)}</span>
        <span>Today</span>
      </div>
    </div>
  );
}

export type SettingsRes = { settings: AppSettings; defaults: AppSettings; defaultPrompts: Record<PromptKey, string> };

export function useSettingsDraft() {
  const { data, mutate } = useSWR<SettingsRes>("/api/admin/settings");
  const [draft, setDraft] = useState<AppSettings | null>(null);
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (data && !draft) setDraft(data.settings);
  }, [data, draft]);
  const dirty = Boolean(data && draft && JSON.stringify(draft) !== JSON.stringify(data.settings));
  async function save() {
    if (!draft) return;
    setSaving(true);
    try {
      const r = await api<{ settings: AppSettings }>("/api/admin/settings", "PUT", draft);
      await mutate({ ...data!, settings: r.settings }, { revalidate: false });
      setDraft(r.settings);
      globalMutate("/api/admin");
      toast.success("Settings saved");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save");
    } finally {
      setSaving(false);
    }
  }
  return { data, draft, setDraft, dirty, save, saving, reset: () => data && setDraft(data.settings) };
}

export function SaveBar({ dirty, saving, onSave, onReset }: { dirty: boolean; saving: boolean; onSave: () => void; onReset: () => void }) {
  return (
    <AnimatePresence>
      {dirty && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }} className="sticky bottom-20 z-20 mt-6 flex justify-end lg:bottom-6">
          <div className="flex items-center gap-3 rounded-full border border-line-strong bg-raised px-4 py-2 shadow-2xl">
            <span className="text-sm text-dim">Unsaved changes</span>
            <Button variant="quiet" size="sm" onClick={onReset}>
              Discard
            </Button>
            <Button size="sm" loading={saving} onClick={onSave}>
              Save
            </Button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function NumberField({ id, label, hint, value, onChange, min, max, step = 1 }: { id: string; label: string; hint?: string; value: number; onChange: (v: number) => void; min: number; max: number; step?: number }) {
  return (
    <div>
      <Label htmlFor={id} hint={hint}>
        {label}
      </Label>
      <Input
        id={id}
        type="number"
        inputMode="decimal"
        min={min}
        max={max}
        step={step}
        value={Number.isFinite(value) ? value : ""}
        onChange={(e) => onChange(Math.max(min, Math.min(max, Number(e.target.value || 0))))}
        className="tabular"
      />
    </div>
  );
}

export function parseEmails(text: string): { valid: string[]; invalid: string[] } {
  const parts = text
    .split(/[\s,;]+/)
    .map((x) => x.trim().toLowerCase())
    .filter(Boolean);
  const valid: string[] = [];
  const invalid: string[] = [];
  for (const p of parts) (/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(p) ? valid : invalid).push(p);
  return { valid: Array.from(new Set(valid)), invalid };
}

