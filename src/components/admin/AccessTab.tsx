"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Archive, ArchiveRestore, Plus } from "lucide-react";
import type { AppSettings } from "@/lib/settings";
import { Button, ErrorText, Input, Label, Panel, Skeleton, Tag, Textarea, Toggle } from "../ui";
import { parseEmails, SaveBar, useSettingsDraft } from "./shared";

function slugify(label: string, taken: Set<string>): string {
  const base =
    label
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 32) || "batch";
  let id = base;
  for (let i = 2; taken.has(id); i++) id = `${base}-${i}`;
  return id;
}

export function AccessTab() {
  const { draft, setDraft, dirty, save, saving, reset } = useSettingsDraft();
  const [preText, setPreText] = useState<string | null>(null);
  const [newBatch, setNewBatch] = useState("");
  useEffect(() => {
    if (draft && preText === null) setPreText(draft.access.preApprovedEmails.join("\n"));
  }, [draft, preText]);
  if (!draft || preText === null) return <Skeleton className="h-80 rounded-[var(--radius-panel)]" />;
  const pre = parseEmails(preText);
  const setAccess = (patch: Partial<AppSettings["access"]>) => setDraft({ ...draft, access: { ...draft.access, ...patch } });
  const setBatches = (batches: AppSettings["batches"]) => setDraft({ ...draft, batches });

  function addBatch() {
    const label = newBatch.trim();
    if (!label) return;
    const id = slugify(label, new Set(draft!.batches.map((b) => b.id)));
    setBatches([...draft!.batches, { id, label, archived: false }]);
    setNewBatch("");
  }

  return (
    <div className="max-w-3xl space-y-5">
      <Panel className="p-4 sm:p-6">
        <Toggle
          checked={draft.access.requireApproval}
          onChange={(v) => setAccess({ requireApproval: v })}
          label="New sign-ups wait for approval"
          description="Keep this on. Turning it off lets anyone who confirms their email straight in (for emergencies only)."
        />
        {!draft.access.requireApproval && <p className="mt-3 rounded-xl bg-ember/10 px-3 py-2 text-sm text-ember">Approval is off: anyone with a confirmed email can join right now.</p>}
      </Panel>

      <Panel className="p-4 sm:p-6">
        <h2 className="font-display text-lg font-semibold">Batches</h2>
        <p className="mt-1 text-sm text-dim">People choose one at sign-up, and you confirm it when approving. Renaming keeps everyone in the batch. Archived batches disappear from sign-up but stay on profiles.</p>
        <ul className="mt-5 space-y-2">
          <AnimatePresence initial={false}>
            {draft.batches.map((b, i) => (
              <motion.li key={b.id} layout initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="flex items-center gap-2">
                <Input
                  aria-label={`Batch name ${i + 1}`}
                  value={b.label}
                  maxLength={60}
                  onChange={(e) => setBatches(draft.batches.map((x) => (x.id === b.id ? { ...x, label: e.target.value } : x)))}
                  className={b.archived ? "opacity-60" : undefined}
                />
                {b.archived && <Tag>archived</Tag>}
                <Button
                  variant="quiet"
                  size="sm"
                  aria-label={b.archived ? `Restore ${b.label}` : `Archive ${b.label}`}
                  title={b.archived ? "Restore" : "Archive"}
                  onClick={() => setBatches(draft.batches.map((x) => (x.id === b.id ? { ...x, archived: !x.archived } : x)))}
                >
                  {b.archived ? <ArchiveRestore className="size-4" /> : <Archive className="size-4" />}
                </Button>
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
        {!draft.batches.length && <p className="mt-4 text-sm text-faint">No batches yet. Add your first one, e.g. “Batch 1 (2025)”.</p>}
        <form
          className="mt-4 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            addBatch();
          }}
        >
          <Input value={newBatch} onChange={(e) => setNewBatch(e.target.value)} placeholder="Batch 2 (2026)" maxLength={60} aria-label="New batch name" />
          <Button type="submit" variant="ghost" disabled={!newBatch.trim()}>
            <Plus className="size-4" /> Add
          </Button>
        </form>
        <ErrorText>{draft.batches.some((b) => !b.label.trim()) && "Every batch needs a name."}</ErrorText>
      </Panel>

      <Panel className="p-4 sm:p-6">
        <Label htmlFor="pre" hint={`${pre.valid.length} emails`}>
          Pre-approved emails
        </Label>
        <p className="mb-3 text-sm text-dim">These people are let in as soon as they confirm their email. Empty by default. One per line, or separated by commas.</p>
        <Textarea
          id="pre"
          rows={6}
          value={preText}
          onChange={(e) => {
            setPreText(e.target.value);
            setAccess({ preApprovedEmails: parseEmails(e.target.value).valid });
          }}
          placeholder={"ayesha@example.com\nbilal@example.com"}
        />
        <ErrorText>{pre.invalid.length > 0 && `Not saved, doesn't look like an email: ${pre.invalid.slice(0, 3).join(", ")}`}</ErrorText>
      </Panel>
      <SaveBar
        dirty={dirty}
        saving={saving}
        onSave={save}
        onReset={() => {
          reset();
          setPreText(null);
        }}
      />
    </div>
  );
}
