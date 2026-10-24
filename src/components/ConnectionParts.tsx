"use client";

import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { toast } from "sonner";
import { MapPin, MessageCircle, UserRound, Pencil, Trash2, UserPlus } from "lucide-react";
import type { ConnectionDTO } from "@/lib/types";
import { FIELDS, getField } from "@/lib/taxonomy";
import { api, firstName } from "@/lib/client";
import { Avatar, Button, ErrorText, FieldChip, Input, Label, LinkButton, Modal, Textarea, cx } from "./ui";

const CONTACT_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}|(?:\+|00)?\d(?:[\s.\-()]*\d){7,}/i;
const hasContact = (s: string) => CONTACT_RE.test(s.replace(/https?:\/\/\S+/gi, " "));

export function ConnectionCard({
  c,
  index = 0,
  onRequest,
  onEdit,
  onDeleted,
  compact,
}: {
  c: ConnectionDTO;
  index?: number;
  onRequest?: (c: ConnectionDTO) => void;
  onEdit?: (c: ConnectionDTO) => void;
  onDeleted?: () => void;
  compact?: boolean;
}) {
  const owner = c.addedBy ? (c.addedByMe ? "you" : firstName(c.addedBy.name)) : "a classmate";
  const [confirm, setConfirm] = useState(false);
  async function del() {
    try {
      await api(`/api/connections/${c.id}`, "DELETE");
      toast.success("Removed");
      onDeleted?.();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not remove");
    }
  }
  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={{ delay: Math.min(index, 12) * 0.04 }}
      className={cx("flex flex-col rounded-[var(--radius-panel)] border border-line bg-raised/80", compact ? "p-4" : "p-5")}
    >
      <div className="flex items-start gap-3">
        <Avatar name={c.name} size={compact ? 36 : 44} />
        <div className="min-w-0 flex-1">
          <h3 className="font-medium leading-snug">{c.name}</h3>
          {(c.role || c.organization) && <p className="text-sm text-dim">{[c.role, c.organization].filter(Boolean).join(", ")}</p>}
          {c.location && !compact && (
            <p className="mt-0.5 flex items-center gap-1 text-xs text-faint">
              <MapPin className="size-3" /> {c.location}
            </p>
          )}
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {(c.overlap?.length ? c.overlap : c.fields).map((f) => (
          <FieldChip key={f} slug={f} size="sm" />
        ))}
      </div>
      {c.note && !compact && <p className="mt-3 text-sm text-dim">{c.note}</p>}
      <div className="mt-4 flex items-center gap-2 text-xs text-faint">
        {c.addedBy && <Avatar name={c.addedBy.name} src={c.addedBy.photoUrl} size={18} />}
        Added by {owner}
      </div>
      <div className={cx("mt-auto flex flex-wrap items-center gap-2 pt-4")}>
        <span
          className={cx(
            "inline-flex h-7 items-center rounded-full border px-2.5 text-xs",
            c.contactPreference === "direct" ? "border-aurora/40 bg-aurora/10 text-aurora" : "border-violet/40 bg-violet/10 text-violet",
          )}
        >
          {c.contactPreference === "direct" ? "Message directly" : `Ask ${owner === "you" ? "you" : owner} for an intro first`}
        </span>
        <div className="ml-auto flex items-center gap-1">
          {c.linkedin && (
            <LinkButton href={c.linkedin} external size="sm" variant="ghost">
              <UserRound className="size-3.5" /> LinkedIn
            </LinkButton>
          )}
          {!c.addedByMe && c.contactPreference === "ask_first" && onRequest && (
            <Button size="sm" onClick={() => onRequest(c)}>
              <MessageCircle className="size-3.5" /> Request intro
            </Button>
          )}
          {c.addedByMe && onEdit && (
            <Button size="sm" variant="quiet" aria-label="Edit" onClick={() => onEdit(c)}>
              <Pencil className="size-3.5" />
            </Button>
          )}
          {c.addedByMe &&
            (confirm ? (
              <Button size="sm" variant="danger" onClick={del}>
                Remove
              </Button>
            ) : (
              <Button size="sm" variant="quiet" aria-label="Remove" onClick={() => setConfirm(true)}>
                <Trash2 className="size-3.5" />
              </Button>
            ))}
        </div>
      </div>
      {c.contactPreference === "direct" && !c.addedByMe && !compact && (
        <p className="mt-3 text-xs text-faint">When you write, mention you’re in M1 AIRE at LPI and that {owner} shared this.</p>
      )}
    </motion.article>
  );
}

export function RequestIntroModal({ c, onClose, onSent }: { c: ConnectionDTO | null; onClose: () => void; onSent?: () => void }) {
  const [msg, setMsg] = useState("");
  const [sending, setSending] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    if (c) {
      const field = c.fields[0] ? getField(c.fields[0]).label.toLowerCase() : "their field";
      setMsg(`Hi ${c.addedBy ? firstName(c.addedBy.name) : ""}, could you introduce me to ${c.name}? I'm interested in ${field} internships because…`);
      setErr(null);
    }
  }, [c]);
  async function send() {
    if (!c) return;
    setSending(true);
    setErr(null);
    try {
      await api("/api/intro-requests", "POST", { connectionId: c.id, message: msg });
      toast.success(`Request sent to ${c.addedBy ? firstName(c.addedBy.name) : "your classmate"}`);
      onSent?.();
      onClose();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not send");
    } finally {
      setSending(false);
    }
  }
  return (
    <Modal open={Boolean(c)} onClose={onClose} title={c ? `Ask for an intro to ${c.name}` : ""}>
      <p className="mb-4 text-sm text-dim">
        {c?.addedBy ? firstName(c.addedBy.name) : "Your classmate"} will see your request in their Connections and decide how to connect you.
      </p>
      <Label htmlFor="intro-msg" hint={`${msg.length}/500`}>
        Your message
      </Label>
      <Textarea id="intro-msg" rows={5} maxLength={500} value={msg} onChange={(e) => setMsg(e.target.value)} />
      <ErrorText>{err}</ErrorText>
      <div className="mt-5 flex justify-end gap-2">
        <Button variant="quiet" onClick={onClose}>
          Cancel
        </Button>
        <Button loading={sending} onClick={send} disabled={msg.trim().length < 10}>
          Send request
        </Button>
      </div>
    </Modal>
  );
}

type ConnForm = {
  name: string;
  role: string;
  organization: string;
  location: string;
  fields: string[];
  linkedin: string;
  contactPreference: "direct" | "ask_first";
  note: string;
  consent: boolean;
};
const emptyForm: ConnForm = { name: "", role: "", organization: "", location: "", fields: [], linkedin: "", contactPreference: "ask_first", note: "", consent: false };

export function ConnectionFormModal({ open, editing, onClose, onSaved }: { open: boolean; editing: ConnectionDTO | null; onClose: () => void; onSaved: () => void }) {
  const [f, setF] = useState<ConnForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    if (!open) return;
    setErr(null);
    setF(
      editing
        ? {
            name: editing.name,
            role: editing.role || "",
            organization: editing.organization || "",
            location: editing.location || "",
            fields: editing.fields,
            linkedin: editing.linkedin || "",
            contactPreference: editing.contactPreference,
            note: editing.note || "",
            consent: true,
          }
        : emptyForm,
    );
  }, [open, editing]);
  const set = <K extends keyof ConnForm>(k: K, v: ConnForm[K]) => setF((p) => ({ ...p, [k]: v }));
  const contactProblem = [f.name, f.role, f.organization, f.location, f.note].some(hasContact);
  const linkedinBad = f.linkedin.length > 0 && !/^https?:\/\/\S+\.\S+/.test(f.linkedin);
  const valid = f.name.trim().length >= 2 && f.fields.length > 0 && f.consent && !contactProblem && !linkedinBad;

  async function save() {
    setSaving(true);
    setErr(null);
    const body = {
      ...f,
      role: f.role || null,
      organization: f.organization || null,
      location: f.location || null,
      linkedin: f.linkedin || null,
      note: f.note || null,
    };
    try {
      if (editing) await api(`/api/connections/${editing.id}`, "PATCH", body);
      else await api("/api/connections", "POST", body);
      toast.success(editing ? "Saved" : `${f.name} added to the class network`);
      onSaved();
      onClose();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={editing ? "Edit connection" : "Add someone you know"} wide>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Label htmlFor="c-name">Name</Label>
          <Input id="c-name" value={f.name} onChange={(e) => set("name", e.target.value)} placeholder="Dr. Jane Doe" />
        </div>
        <div>
          <Label htmlFor="c-role">Role</Label>
          <Input id="c-role" value={f.role} onChange={(e) => set("role", e.target.value)} placeholder="Postdoc in neuropsychology" />
        </div>
        <div>
          <Label htmlFor="c-org">Organization</Label>
          <Input id="c-org" value={f.organization} onChange={(e) => set("organization", e.target.value)} placeholder="Institut du Cerveau" />
        </div>
        <div>
          <Label htmlFor="c-loc">Location</Label>
          <Input id="c-loc" value={f.location} onChange={(e) => set("location", e.target.value)} placeholder="Paris" />
        </div>
        <div>
          <Label htmlFor="c-li" hint="Public profile link only">
            LinkedIn
          </Label>
          <Input id="c-li" type="url" value={f.linkedin} invalid={linkedinBad} onChange={(e) => set("linkedin", e.target.value)} placeholder="https://www.linkedin.com/in/…" />
        </div>
        <div className="sm:col-span-2">
          <Label>Fields (up to 4)</Label>
          <div className="flex max-h-40 flex-wrap gap-1.5 overflow-y-auto">
            {FIELDS.map((x) => (
              <FieldChip
                key={x.slug}
                slug={x.slug}
                size="sm"
                selected={f.fields.includes(x.slug)}
                onClick={() =>
                  set("fields", f.fields.includes(x.slug) ? f.fields.filter((s) => s !== x.slug) : f.fields.length < 4 ? [...f.fields, x.slug] : f.fields)
                }
              />
            ))}
          </div>
        </div>
        <div className="sm:col-span-2">
          <Label htmlFor="c-note" hint="Optional">
            Note for classmates
          </Label>
          <Textarea id="c-note" rows={2} maxLength={240} value={f.note} onChange={(e) => set("note", e.target.value)} placeholder="Met at a conference; happy to talk to students about lab internships." />
        </div>
        <div className="sm:col-span-2">
          <Label>How should classmates reach them?</Label>
          <div className="grid gap-2 sm:grid-cols-2">
            {(
              [
                { v: "ask_first", t: "Ask me for an intro first", d: "Classmates send you a request; you decide." },
                { v: "direct", t: "Message directly", d: "Classmates can contact them on LinkedIn." },
              ] as const
            ).map((o) => (
              <button
                key={o.v}
                type="button"
                onClick={() => set("contactPreference", o.v)}
                aria-pressed={f.contactPreference === o.v}
                className={cx("rounded-2xl border p-3 text-left", f.contactPreference === o.v ? "border-brass bg-brass/[0.07]" : "border-line-strong hover:bg-raised-2")}
              >
                <span className="block text-sm font-medium">{o.t}</span>
                <span className="block text-xs text-dim">{o.d}</span>
              </button>
            ))}
          </div>
        </div>
        <label className="flex items-start gap-3 text-sm sm:col-span-2">
          <input type="checkbox" checked={f.consent} onChange={(e) => set("consent", e.target.checked)} className="mt-0.5 size-4 accent-[var(--brass)]" />
          <span>This is a public profile, or this person agreed to be listed.</span>
        </label>
      </div>
      <ErrorText>{contactProblem ? "Please share only a public profile link, not phone numbers or emails." : err}</ErrorText>
      <div className="mt-6 flex justify-end gap-2">
        <Button variant="quiet" onClick={onClose}>
          Cancel
        </Button>
        <Button loading={saving} disabled={!valid} onClick={save}>
          <UserPlus className="size-4" /> {editing ? "Save" : "Add connection"}
        </Button>
      </div>
    </Modal>
  );
}
