"use client";

import { useState } from "react";
import Link from "next/link";
import useSWR, { mutate as globalMutate } from "swr";
import { motion } from "motion/react";
import { toast } from "sonner";
import { ArrowLeft, Check, Clock, HandHeart, Lock, Mail, MapPin, MessageCircle, Pencil, UserPlus, X } from "lucide-react";
import type { MemberProfileDTO, ProposalCardDTO } from "@/lib/types";
import type { ScholarshipDTO } from "@/lib/scholarships";
import { ProfileScholarships } from "../scholarships/ScholarshipParts";
import { StatusPill } from "../projects/ProposalCard";
import { getField, lookingForLabel } from "@/lib/taxonomy";
import { api, ClientError, firstName } from "@/lib/client";
import { prettyPhone, waMeLink } from "@/lib/phone";
import { Avatar, Button, EmptyState, ErrorText, FieldChip, Label, LinkButton, Modal, Panel, Skeleton, Tag, Textarea } from "../ui";
import { LinkPills } from "../ProfileParts";
import { RoleBadge } from "./MembersView";

type FullProfile = MemberProfileDTO & { projects: (ProposalCardDTO & { role: "proposer" | "member" })[]; scholarships: ScholarshipDTO[] };

export function MemberProfile({ id }: { id: string }) {
  const key = `/api/members/${id}`;
  const { data: p, error, mutate } = useSWR<FullProfile>(key);

  if (error && !p) {
    const notFound = error instanceof ClientError && error.status === 404;
    return (
      <EmptyState icon={<UserPlus className="size-10" />} title={notFound ? "Member not found" : "Couldn't load this profile"} action={<Link href="/members" className="inline-flex h-11 items-center rounded-full border border-line-strong px-5 text-sm">Back to members</Link>}>
        {notFound ? "They may have left the community." : "Check your connection and try again."}
      </EmptyState>
    );
  }
  if (!p) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-40 rounded-[var(--radius-panel)]" />
        <Skeleton className="h-64 rounded-[var(--radius-panel)]" />
      </div>
    );
  }

  const v = p.volunteering;
  return (
    <div className="mx-auto max-w-3xl">
      <Link href="/members" className="mb-4 inline-flex h-11 items-center gap-1.5 text-sm text-dim hover:text-star">
        <ArrowLeft className="size-4" /> Members
      </Link>

      <Panel className="p-5 sm:p-7">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
          <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
            <Avatar name={p.name} src={p.photoUrl} size={88} ring={p.isMe ? "brass" : undefined} />
          </motion.div>
          <div className="min-w-0 flex-1">
            <h1 className="font-display text-3xl font-semibold leading-tight">{p.name}</h1>
            {p.fieldOfStudy && <p className="mt-1 text-lg text-dim">{p.fieldOfStudy}</p>}
            <p className="mt-1 flex items-center gap-1.5 text-sm text-dim">
              <MapPin className="size-4 text-faint" />
              {[p.university, [p.city, p.country].filter(Boolean).join(", ")].filter(Boolean).join(" · ")}
            </p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              <RoleBadge m={p} />
              {p.role === "team" && p.batchLabel && <Tag>{p.batchLabel}</Tag>}
              {v.open && (
                <Tag tone="aurora">
                  <HandHeart className="size-3" /> Open to volunteer
                </Tag>
              )}
            </div>
          </div>
        </div>
        <div className="mt-6 border-t border-line pt-5">
          <ConnectArea p={p} onChange={() => mutate()} />
        </div>
      </Panel>

      <div className="mt-5 space-y-5">
        <Panel as="section" className="p-5 sm:p-7">
          <h2 className="font-display text-xl font-semibold">Technical background</h2>
          {p.skills.length > 0 && (
            <div className="mt-4">
              <p className="mb-2 text-sm text-faint">Skills</p>
              <div className="flex flex-wrap gap-1.5">
                {p.skills.map((s) => (
                  <Tag key={s} tone="brass">
                    {s}
                  </Tag>
                ))}
              </div>
            </div>
          )}
          {p.tools.length > 0 && (
            <div className="mt-4">
              <p className="mb-2 text-sm text-faint">Tools</p>
              <div className="flex flex-wrap gap-1.5">
                {p.tools.map((s) => (
                  <Tag key={s}>{s}</Tag>
                ))}
              </div>
            </div>
          )}
          {p.experience && (
            <div className="mt-5">
              <p className="mb-1.5 text-sm text-faint">Past projects and experience</p>
              <p className="whitespace-pre-line leading-relaxed">{p.experience}</p>
            </div>
          )}
          <div className="mt-5">
            <LinkPills links={p.links} />
          </div>
        </Panel>

        <Panel as="section" className="p-5 sm:p-7">
          <h2 className="font-display text-xl font-semibold">Looking for</h2>
          {p.lookingFor.length > 0 ? (
            <div className="mt-4 flex flex-wrap gap-1.5">
              {p.lookingFor.map((l) => (
                <Tag key={l} tone="brass">
                  {lookingForLabel(l)}
                </Tag>
              ))}
            </div>
          ) : (
            <p className="mt-3 text-sm text-faint">Not shared yet.</p>
          )}
          {p.lookingForNote && <p className="mt-4 whitespace-pre-line leading-relaxed text-dim">{p.lookingForNote}</p>}
          {p.fields.length > 0 && (
            <div className="mt-5 flex flex-wrap gap-1.5">
              {p.fields.map((f) => (
                <FieldChip key={f} slug={f} size="sm" />
              ))}
            </div>
          )}
          {p.freeTags.length > 0 && <p className="mt-3 text-sm text-faint">Also into: {p.freeTags.join(", ")}</p>}
        </Panel>

        <Panel as="section" className="p-5 sm:p-7">
          <h2 className="font-display text-xl font-semibold">Volunteering</h2>
          {v.open ? (
            <div className="mt-3 space-y-2 text-sm">
              <p>
                Open to volunteer for <span className="font-medium">{v.for === "both" ? "Comskills and other causes" : v.for === "other" ? "other causes" : "Comskills"}</span>
                {v.hoursPerMonth ? `, about ${v.hoursPerMonth} hours a month` : ""}.
              </p>
              {v.areas.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {v.areas.map((a) => (
                    <Tag key={a} tone="aurora">
                      {a}
                    </Tag>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <p className="mt-3 text-sm text-faint">Not volunteering right now.</p>
          )}
        </Panel>

        <Panel as="section" className="p-5 sm:p-7">
          <h2 className="font-display text-xl font-semibold">Projects</h2>
          {p.projects.length === 0 ? (
            <p className="mt-3 text-sm text-faint">Not in any project yet.</p>
          ) : (
            <ul className="mt-4 space-y-2">
              {p.projects.map((pr) => (
                <li key={pr.id}>
                  <Link href={`/projects/${pr.id}`} className="flex items-center gap-3 rounded-2xl border border-line bg-night-2/50 p-3 hover:border-line-strong">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{pr.title}</span>
                      <span className="block text-xs text-faint">{pr.role === "proposer" ? "Proposed it" : "On the team"}</span>
                    </span>
                    <StatusPill status={pr.status} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel as="section" className="p-5 sm:p-7">
          <h2 className="font-display text-xl font-semibold">Scholarships</h2>
          <ProfileScholarships items={p.scholarships} />
        </Panel>

        <p className="pb-4 text-center text-xs text-faint">
          Joined {new Date(p.joinedAt).toLocaleDateString("en-GB", { month: "long", year: "numeric" })}
          {p.fields[0] ? ` · ${getField(p.fields[0]).emoji}` : ""}
        </p>
      </div>
    </div>
  );
}

/** Connect button and, once connected (or for yourself and admins), the contact details. */
function ConnectArea({ p, onChange }: { p: MemberProfileDTO; onChange: () => void }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const c = p.connect;

  async function answer(status: "accepted" | "declined") {
    if (c.state !== "incoming") return;
    setBusy(true);
    try {
      await api(`/api/connect/${c.requestId}`, "PATCH", { status });
      toast.success(status === "accepted" ? `You're connected with ${firstName(p.name)}` : "Request declined");
      onChange();
      globalMutate("/api/notifications");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Something went wrong. Try again.");
    } finally {
      setBusy(false);
    }
  }
  async function withdraw() {
    if (c.state !== "outgoing") return;
    setBusy(true);
    try {
      await api(`/api/connect/${c.requestId}`, "DELETE");
      toast("Request withdrawn");
      onChange();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Something went wrong. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      {c.state === "self" && (
        <div className="flex flex-wrap items-center gap-3">
          <Link href="/settings" className="inline-flex h-11 items-center gap-2 rounded-full bg-brass px-5 text-sm font-medium text-brass-ink">
            <Pencil className="size-4" /> Edit my profile
          </Link>
          <span className="flex items-center gap-1.5 text-sm text-faint">
            <Lock className="size-4" /> Your contacts show only to people you connect with.
          </span>
        </div>
      )}
      {c.state === "none" && (
        <div className="flex flex-wrap items-center gap-3">
          <Button size="lg" onClick={() => setOpen(true)}>
            <UserPlus className="size-4" /> Connect
          </Button>
          <span className="text-sm text-faint">If {firstName(p.name)} accepts, you'll both see each other's WhatsApp and email.</span>
        </div>
      )}
      {c.state === "outgoing" && (
        <div className="flex flex-wrap items-center gap-3">
          <span className="inline-flex h-11 items-center gap-2 rounded-full border border-line-strong px-4 text-sm text-dim">
            <Clock className="size-4" /> Request sent
          </span>
          <Button variant="quiet" loading={busy} onClick={withdraw}>
            Withdraw
          </Button>
        </div>
      )}
      {c.state === "incoming" && (
        <div className="rounded-2xl border border-brass/40 bg-brass/[0.07] p-4">
          <p className="font-medium">{firstName(p.name)} wants to connect with you</p>
          {c.message && <p className="mt-1 text-sm italic text-dim">“{c.message}”</p>}
          <div className="mt-3 flex flex-wrap gap-2">
            <Button loading={busy} onClick={() => answer("accepted")}>
              <Check className="size-4" /> Accept
            </Button>
            <Button variant="ghost" disabled={busy} onClick={() => answer("declined")}>
              <X className="size-4" /> Decline
            </Button>
          </div>
        </div>
      )}
      {c.state === "declined" && <p className="text-sm text-faint">{firstName(p.name)} didn't accept your request. They can still ask to connect with you.</p>}

      {p.contacts && (
        <div className="space-y-2">
          {c.state === "connected" && (
            <p className="flex items-center gap-1.5 text-sm text-aurora">
              <Check className="size-4" /> Connected
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            {p.contacts.whatsapp && (
              <LinkButton href={waMeLink(p.contacts.whatsapp)} external variant="primary">
                <MessageCircle className="size-4" /> WhatsApp {prettyPhone(p.contacts.whatsapp)}
              </LinkButton>
            )}
            {p.contacts.email && (
              <LinkButton href={`mailto:${p.contacts.email}`} variant="ghost">
                <Mail className="size-4" /> {p.contacts.email}
              </LinkButton>
            )}
            {!p.contacts.whatsapp && !p.contacts.email && <p className="text-sm text-faint">No contact details added yet.</p>}
          </div>
          {c.state !== "connected" && c.state !== "self" && <p className="text-xs text-faint">You can see these because you're an admin. Members only see them after connecting.</p>}
        </div>
      )}

      <ConnectModal open={open} onClose={() => setOpen(false)} p={p} onSent={onChange} />
    </div>
  );
}

function ConnectModal({ open, onClose, p, onSent }: { open: boolean; onClose: () => void; p: MemberProfileDTO; onSent: () => void }) {
  const [message, setMessage] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  async function send() {
    setErr(null);
    setBusy(true);
    try {
      const r = await api<{ status: string }>("/api/connect", "POST", { to: p.id, message });
      toast.success(r.status === "accepted" ? `${firstName(p.name)} had asked you too, so you're now connected.` : `Request sent to ${firstName(p.name)}`);
      setMessage("");
      onClose();
      onSent();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not send. Try again.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal open={open} onClose={onClose} title={`Connect with ${firstName(p.name)}`}>
      <p className="text-sm text-dim">If they accept, you'll both see each other's WhatsApp and email. Until then, nothing is shared.</p>
      <Label htmlFor="cn-msg" hint={`${message.length}/300`} className="mt-5">
        A short note (optional)
      </Label>
      <Textarea id="cn-msg" rows={3} maxLength={300} value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Hi! I saw you work on genomics. I'd love to team up on a project." autoFocus />
      <ErrorText>{err}</ErrorText>
      <div className="mt-6 flex justify-end gap-2">
        <Button variant="quiet" onClick={onClose}>
          Cancel
        </Button>
        <Button loading={busy} onClick={send}>
          Send request
        </Button>
      </div>
    </Modal>
  );
}
