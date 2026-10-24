"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import useSWR, { mutate as globalMutate } from "swr";
import { AnimatePresence, motion } from "motion/react";
import { toast } from "sonner";
import { ArrowLeft, Check, Clock, ExternalLink, Flag, Hand, LogOut, Pencil, PartyPopper, Sparkles, Trash2, UserMinus, Users, X } from "lucide-react";
import { PROPOSAL_STATUS_LABEL, type ProposalDetailDTO, type ProposalStatus, type TeamMemberDTO } from "@/lib/types";
import { api, ClientError, firstName, timeAgo } from "@/lib/client";
import { hostLabel } from "@/lib/url";
import { proposalShareText } from "@/lib/share-text";
import { Avatar, Button, EmptyState, ErrorText, FieldChip, Input, Label, Modal, Panel, Skeleton, Tag, Textarea, Toggle, cx } from "../ui";
import { ShareButtons, absoluteUrl } from "../ShareButtons";
import { commitmentText, MyStatusTag, StatusPill } from "./ProposalCard";
import { PeopleWhoMightFit } from "./PeopleWhoMightFit";

const STEPS: ProposalStatus[] = ["open", "team_forming", "in_progress", "completed"];

export function ProposalPage({ id }: { id: string }) {
  const key = `/api/proposals/${id}`;
  const { data: p, error, mutate } = useSWR<ProposalDetailDTO>(key);
  const refresh = () => {
    mutate();
    globalMutate((k) => typeof k === "string" && k.startsWith("/api/proposals?"));
    globalMutate("/api/notifications");
  };

  if (error && !p) {
    const notFound = error instanceof ClientError && error.status === 404;
    return (
      <EmptyState icon={<Users className="size-10" />} title={notFound ? "Project not found" : "Couldn't load this project"} action={<Link href="/projects" className="inline-flex h-11 items-center rounded-full border border-line-strong px-5 text-sm">Back to projects</Link>}>
        {notFound ? "It may have been deleted." : "Check your connection and try again."}
      </EmptyState>
    );
  }
  if (!p) {
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        <Skeleton className="h-56 rounded-[var(--radius-panel)]" />
        <Skeleton className="h-40 rounded-[var(--radius-panel)]" />
      </div>
    );
  }

  const commitment = commitmentText(p.commitment);
  const url = absoluteUrl(`/projects/${p.id}`);
  return (
    <div className="mx-auto max-w-3xl pb-24 lg:pb-0">
      <Link href="/projects" className="mb-3 inline-flex h-11 items-center gap-1.5 text-sm text-dim hover:text-star">
        <ArrowLeft className="size-4" /> Projects
      </Link>

      <Panel className="p-4 sm:p-7">
        <div className="flex flex-wrap items-center gap-1.5">
          <StatusPill status={p.status} />
          {!p.acceptingMembers && p.status !== "completed" && <Tag>Not taking new people</Tag>}
          <MyStatusTag s={p.myStatus} />
        </div>
        {p.match && p.match.score > 0 && !p.proposedByMe && p.myStatus !== "accepted" && (
          <p className="mt-3 flex items-start gap-2 rounded-xl bg-brass/[0.08] px-3 py-2 text-sm">
            <Sparkles className="mt-0.5 size-4 shrink-0 text-brass" />
            <span>
              <span className="font-medium text-brass">Why it fits you: </span>
              {p.match.reason}
              {p.match.basic && <span className="ml-1 text-xs text-faint">(basic match)</span>}
            </span>
          </p>
        )}
        <h1 className="mt-3 font-display text-3xl font-semibold leading-tight">{p.title}</h1>
        <div className="mt-3 flex items-center gap-2 text-sm text-dim">
          {p.proposer ? (
            <Link href={`/members/${p.proposer.id}`} className="flex items-center gap-2 hover:text-star">
              <Avatar name={p.proposer.name} src={p.proposer.photoUrl} size={26} />
              {p.proposedByMe ? "You" : p.proposer.name}
            </Link>
          ) : (
            "A former member"
          )}
          <span className="text-faint">· proposed {timeAgo(p.createdAt)}</span>
        </div>

        <dl className="mt-5 grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl bg-night-2 p-3.5">
            <dt className="flex items-center gap-1.5 text-xs text-faint">
              <Users className="size-3.5" /> Team
            </dt>
            <dd className="mt-1 font-medium">
              {p.acceptedCount} of {p.peopleNeeded.count} {p.peopleNeeded.count === 1 ? "person" : "people"}
            </dd>
            {p.peopleNeeded.skills.length > 0 && (
              <dd className="mt-2 flex flex-wrap gap-1.5">
                {p.peopleNeeded.skills.map((s) => (
                  <Tag key={s} tone="brass">
                    {s}
                  </Tag>
                ))}
              </dd>
            )}
          </div>
          <div className="rounded-2xl bg-night-2 p-3.5">
            <dt className="flex items-center gap-1.5 text-xs text-faint">
              <Clock className="size-3.5" /> Commitment
            </dt>
            <dd className="mt-1 font-medium">{commitment ?? "Flexible"}</dd>
          </div>
        </dl>

        <section className="mt-6">
          <h2 className="text-sm text-faint">The problem</h2>
          <p className="mt-1 whitespace-pre-line leading-relaxed">{p.problem}</p>
        </section>
        <section className="mt-5">
          <h2 className="text-sm text-faint">The idea</h2>
          <p className="mt-1 whitespace-pre-line leading-relaxed">{p.idea}</p>
        </section>
        {(p.fields.length > 0 || p.tags.length > 0) && (
          <div className="mt-5 flex flex-wrap gap-1.5">
            {p.fields.map((f) => (
              <FieldChip key={f} slug={f} size="sm" />
            ))}
            {p.tags.map((t) => (
              <Tag key={t}>{t}</Tag>
            ))}
          </div>
        )}
        {p.links.length > 0 && (
          <ul className="mt-5 space-y-1.5">
            {p.links.map((l) => (
              <li key={l}>
                <a href={l} target="_blank" rel="noopener noreferrer nofollow" className="inline-flex min-h-10 items-center gap-1.5 text-sm text-brass hover:underline">
                  <ExternalLink className="size-4" /> {hostLabel(l)}
                </a>
              </li>
            ))}
          </ul>
        )}

        <div className="mt-6 flex flex-wrap items-center gap-2 border-t border-line pt-5">
          <ShareButtons text={proposalShareText(p, url)} url={url} compact />
          {!p.proposedByMe && <ReportButton id={p.id} />}
        </div>
      </Panel>

      {!p.canManage && <JoinArea p={p} onChange={refresh} />}

      <Panel as="section" className="mt-5 p-4 sm:p-7">
        <h2 className="font-display text-xl font-semibold">The team</h2>
        {p.teamMembers.length === 0 ? (
          <p className="mt-3 text-sm text-dim">No one on the team yet.{p.acceptingMembers && !p.proposedByMe ? " You could be the first!" : ""}</p>
        ) : (
          <ul className="mt-4 grid gap-2 sm:grid-cols-2">
            {p.teamMembers.map((m) => (
              <li key={m.id} className="min-w-0">
                <PersonRow m={m} />
              </li>
            ))}
          </ul>
        )}
      </Panel>

      {p.canManage && <ProposerTools p={p} onChange={refresh} />}
    </div>
  );
}

function PersonRow({ m, children }: { m: TeamMemberDTO; children?: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 rounded-2xl border border-line bg-night-2/50 p-3">
      <Link href={`/members/${m.id}`} className="shrink-0">
        <Avatar name={m.name} src={m.photoUrl} size={40} />
      </Link>
      <div className="min-w-0 flex-1">
        <Link href={`/members/${m.id}`} className="font-medium hover:text-brass">
          {m.name}
        </Link>
        {m.fieldOfStudy && <p className="truncate text-sm text-dim">{m.fieldOfStudy}</p>}
        {m.skills.length > 0 && <p className="truncate text-xs text-faint">{m.skills.slice(0, 4).join(" · ")}</p>}
        {m.note && <p className="mt-1.5 text-sm italic text-dim">“{m.note}”</p>}
        {children}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ joiners */

function JoinArea({ p, onChange }: { p: ProposalDetailDTO; onChange: () => void }) {
  const [sheet, setSheet] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [busy, setBusy] = useState(false);
  const s = p.myStatus;

  async function leave() {
    setBusy(true);
    try {
      await api(`/api/proposals/${p.id}/interest`, "DELETE");
      toast(s === "accepted" ? "You left the team" : s === "invited" ? "Invite declined" : "Interest withdrawn");
      setConfirmLeave(false);
      onChange();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Something went wrong. Try again.");
    } finally {
      setBusy(false);
    }
  }

  let body: React.ReactNode;
  if (s === "accepted") {
    body = (
      <div className="flex flex-wrap items-center gap-3">
        <span className="flex items-center gap-2 font-medium text-aurora">
          <Check className="size-5" /> You're on the team
        </span>
        <Button variant="quiet" onClick={() => setConfirmLeave(true)}>
          <LogOut className="size-4" /> Leave
        </Button>
      </div>
    );
  } else if (s === "interested") {
    body = (
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-sm">
          <span className="font-medium text-brass">You're interested.</span> <span className="text-dim">{p.proposer ? `${firstName(p.proposer.name)} will` : "The proposer will"} accept or decline soon.</span>
        </span>
        <Button variant="quiet" loading={busy} onClick={leave}>
          Withdraw
        </Button>
      </div>
    );
  } else if (s === "invited") {
    body = (
      <div>
        <p className="font-medium">
          <span className="text-brass">You're invited!</span> {p.proposer ? `${firstName(p.proposer.name)} thinks you'd be a great fit.` : ""}
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button size="lg" onClick={() => setSheet(true)}>
            <Check className="size-4" /> Accept the invite
          </Button>
          <Button variant="ghost" loading={busy} onClick={leave}>
            No thanks
          </Button>
        </div>
      </div>
    );
  } else if (s === "declined") {
    body = <p className="text-sm text-dim">The proposer went with other people this time. Plenty more projects on the board!</p>;
  } else if (s === "removed") {
    body = <p className="text-sm text-dim">You were removed from this team.</p>;
  } else if (p.status === "completed") {
    body = <p className="text-sm text-dim">This project is completed.</p>;
  } else if (!p.acceptingMembers) {
    body = <p className="text-sm text-dim">This team isn't taking new members right now.</p>;
  } else {
    body = (
      <div className="flex flex-wrap items-center gap-3">
        <Button size="lg" onClick={() => setSheet(true)}>
          <Hand className="size-4" /> I'm interested
        </Button>
        <span className="text-sm text-dim">Tell them what you can bring.{s === "left" ? " You left before, but you can ask again." : ""}</span>
      </div>
    );
  }

  return (
    <>
      <Panel className="mt-5 p-4 sm:p-6">{body}</Panel>
      <InterestSheet open={sheet} onClose={() => setSheet(false)} p={p} onDone={onChange} invited={s === "invited"} />
      <Modal open={confirmLeave} onClose={() => setConfirmLeave(false)} title="Leave this team?">
        <p className="text-sm text-dim">The proposer will be told you left. You can ask to join again later if they're still taking people.</p>
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="quiet" onClick={() => setConfirmLeave(false)}>
            Stay
          </Button>
          <Button variant="danger" loading={busy} onClick={leave}>
            Leave the team
          </Button>
        </div>
      </Modal>
    </>
  );
}

function InterestSheet({ open, onClose, p, onDone, invited }: { open: boolean; onClose: () => void; p: ProposalDetailDTO; onDone: () => void; invited: boolean }) {
  const [note, setNote] = useState(invited ? "Happy to join! I can help with " : "");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  async function send() {
    setErr(null);
    setBusy(true);
    try {
      await api(`/api/proposals/${p.id}/interest`, "POST", { note: note.trim() });
      toast.success(p.proposer ? `Sent! ${firstName(p.proposer.name)} will see what you can bring.` : "Sent!");
      onClose();
      onDone();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Couldn't send. Try again.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal open={open} onClose={onClose} title={invited ? "Accept the invite" : "I'm interested"}>
      <Label htmlFor="int-note" hint={`${note.length}/400`}>
        What can you bring?
      </Label>
      <Textarea
        id="int-note"
        rows={4}
        maxLength={400}
        value={note}
        onChange={(e) => setNote(e.target.value)}
        autoFocus
        placeholder="e.g. I've done PCR and qPCR in my lab course, and I can give about 5 hours a week."
      />
      <p className="mt-1.5 text-xs text-faint">Only the proposer sees this note.</p>
      <ErrorText>{err}</ErrorText>
      <div className="mt-6 flex justify-end gap-2">
        <Button variant="quiet" onClick={onClose}>
          Cancel
        </Button>
        <Button loading={busy} onClick={send}>
          Send
        </Button>
      </div>
    </Modal>
  );
}

function ReportButton({ id }: { id: string }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  async function send() {
    setErr(null);
    setBusy(true);
    try {
      await api(`/api/proposals/${id}/report`, "POST", { reason });
      toast.success("Thanks. The admins will take a look.");
      setOpen(false);
      setReason("");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Couldn't send. Try again.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <button onClick={() => setOpen(true)} className="ml-auto inline-flex h-10 items-center gap-1.5 rounded-full px-3 text-sm text-faint hover:text-ember sm:h-8">
        <Flag className="size-4" /> Report
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title="Report this project">
        <p className="text-sm text-dim">Only the admins see reports. The proposer isn't told who reported it.</p>
        <Label htmlFor="rep" className="mt-4">
          What's wrong?
        </Label>
        <Textarea id="rep" rows={3} maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} autoFocus />
        <ErrorText>{err}</ErrorText>
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="quiet" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button loading={busy} onClick={send} disabled={reason.trim().length < 5}>
            Send report
          </Button>
        </div>
      </Modal>
    </>
  );
}

/* ------------------------------------------------------------------ proposer */

function ProposerTools({ p, onChange }: { p: ProposalDetailDTO; onChange: () => void }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [removing, setRemoving] = useState<TeamMemberDTO | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [hideFull, setHideFull] = useState(false);
  const m = p.manage!;
  const full = p.acceptedCount >= p.peopleNeeded.count;

  async function patch(body: Record<string, unknown>, key: string, msg: string) {
    setBusy(key);
    try {
      await api(`/api/proposals/${p.id}`, "PATCH", body);
      toast.success(msg);
      onChange();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't save. Try again.");
    } finally {
      setBusy(null);
    }
  }
  async function setMember(u: TeamMemberDTO, status: "accepted" | "declined" | "removed") {
    setBusy(u.id + status);
    try {
      await api(`/api/proposals/${p.id}/members/${u.id}`, "PATCH", { status });
      toast.success(status === "accepted" ? `${firstName(u.name)} is on the team. They've been told.` : status === "declined" ? "Declined" : `${firstName(u.name)} was removed`);
      if (status === "accepted" && p.acceptedCount + 1 === p.peopleNeeded.count) {
        try {
          const confetti = (await import("canvas-confetti")).default;
          confetti({ particleCount: 90, spread: 70, origin: { y: 0.7 }, colors: ["#f2c14e", "#5eead4", "#a78bfa"], disableForReducedMotion: true });
        } catch {}
      }
      setRemoving(null);
      onChange();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Something went wrong. Try again.");
    } finally {
      setBusy(null);
    }
  }
  async function del() {
    setBusy("delete");
    try {
      await api(`/api/proposals/${p.id}`, "DELETE");
      toast.success("Project deleted");
      globalMutate((k) => typeof k === "string" && k.startsWith("/api/proposals"));
      router.push("/projects");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't delete. Try again.");
      setBusy(null);
    }
  }

  return (
    <section id="manage" className="mt-5 scroll-mt-20 space-y-5">
      <AnimatePresence>
        {full && !hideFull && (p.status === "open" || p.status === "team_forming") && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, height: 0 }} className="rounded-[var(--radius-panel)] border border-aurora/40 bg-aurora/[0.08] p-4 sm:p-5">
            <p className="flex items-center gap-2 font-medium">
              <PartyPopper className="size-5 text-aurora" /> Your team is complete!
            </p>
            <p className="mt-1 text-sm text-dim">Move the project to “In progress” and stop accepting new people?</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button loading={busy === "start"} onClick={() => patch({ status: "in_progress", acceptingMembers: false }, "start", "Project is in progress. The team has been told.")}>
                Yes, let's start
              </Button>
              <Button variant="quiet" onClick={() => setHideFull(true)}>
                Not yet
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <Panel className="p-4 sm:p-7">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-display text-xl font-semibold">Manage your project</h2>
            <p className="mt-1 text-sm text-dim">Only you{p.proposedByMe ? "" : " (and the proposer)"} can see this.</p>
          </div>
          <div className="flex gap-2">
            <Link href={`/projects/${p.id}/edit`} className="inline-flex h-11 items-center gap-1.5 rounded-full border border-line-strong px-4 text-sm hover:bg-raised-2 sm:h-10">
              <Pencil className="size-4" /> Edit
            </Link>
            <Button variant="quiet" onClick={() => setDeleting(true)} aria-label="Delete project">
              <Trash2 className="size-4" />
            </Button>
          </div>
        </div>

        <p className="mb-2 mt-6 text-sm font-medium">Status</p>
        <ol className="grid grid-cols-2 gap-2 sm:grid-cols-4" aria-label="Project status">
          {STEPS.map((s, i) => {
            const current = p.status === s;
            const done = STEPS.indexOf(p.status) > i;
            return (
              <li key={s}>
                <button
                  type="button"
                  aria-current={current ? "step" : undefined}
                  disabled={current || busy !== null}
                  onClick={() => (s === "completed" ? setCompleting(true) : patch({ status: s }, s, `Status: ${PROPOSAL_STATUS_LABEL[s]}. The team has been told.`))}
                  className={cx(
                    "flex h-11 w-full items-center justify-center gap-1.5 rounded-full border px-2 text-sm transition-colors",
                    current ? "border-brass bg-brass text-brass-ink" : done ? "border-aurora/40 text-aurora" : "border-line-strong text-dim hover:text-star",
                  )}
                >
                  {done && <Check className="size-3.5" />}
                  {PROPOSAL_STATUS_LABEL[s]}
                </button>
              </li>
            );
          })}
        </ol>
        <div className="mt-5 rounded-2xl border border-line p-4">
          <Toggle
            checked={p.acceptingMembers}
            onChange={(v) => patch({ acceptingMembers: v }, "accepting", v ? "Open to new people" : "Closed to new people")}
            label="Accepting new members"
            description={p.status === "completed" ? "Completed projects don't take new people." : "Turn off when the team is set. Invited people can still join."}
          />
        </div>

        <h3 className="mb-3 mt-7 font-display text-lg font-semibold">
          Interested <span className="tabular text-sm font-normal text-faint">{m.interested.length}</span>
        </h3>
        {m.interested.length === 0 ? (
          <p className="text-sm text-dim">No one yet. Share the project, or invite people who might fit below.</p>
        ) : (
          <ul className="space-y-2">
            {m.interested.map((u) => (
              <li key={u.id}>
                <PersonRow m={u}>
                  <div className="mt-2.5 flex flex-wrap gap-2">
                    <Button size="sm" loading={busy === u.id + "accepted"} onClick={() => setMember(u, "accepted")}>
                      <Check className="size-3.5" /> Accept
                    </Button>
                    <Button size="sm" variant="ghost" loading={busy === u.id + "declined"} onClick={() => setMember(u, "declined")}>
                      <X className="size-3.5" /> Decline
                    </Button>
                  </div>
                </PersonRow>
              </li>
            ))}
          </ul>
        )}

        {p.teamMembers.length > 0 && (
          <>
            <h3 className="mb-3 mt-7 font-display text-lg font-semibold">On the team</h3>
            <ul className="space-y-2">
              {p.teamMembers.map((u) => (
                <li key={u.id}>
                  <PersonRow m={u}>
                    <button onClick={() => setRemoving(u)} className="mt-1.5 inline-flex h-10 items-center gap-1.5 text-sm text-faint hover:text-ember sm:h-8">
                      <UserMinus className="size-3.5" /> Remove
                    </button>
                  </PersonRow>
                </li>
              ))}
            </ul>
          </>
        )}

        {m.invited.length > 0 && (
          <>
            <h3 className="mb-2 mt-7 text-sm font-medium text-dim">Invited, waiting for a reply</h3>
            <div className="flex flex-wrap gap-2">
              {m.invited.map((u) => (
                <Link key={u.id} href={`/members/${u.id}`} className="flex h-10 items-center gap-2 rounded-full border border-line-strong pl-1 pr-3 text-sm hover:bg-raised-2">
                  <Avatar name={u.name} src={u.photoUrl} size={30} /> {firstName(u.name)}
                </Link>
              ))}
            </div>
          </>
        )}
        {m.past.length > 0 && (
          <details className="mt-6 text-sm">
            <summary className="cursor-pointer py-2 text-dim">Earlier ({m.past.length})</summary>
            <ul className="mt-2 space-y-1.5 text-dim">
              {m.past.map((u) => (
                <li key={u.id} className="flex items-center gap-2">
                  <Avatar name={u.name} src={u.photoUrl} size={24} /> {u.name} <span className="text-faint">· {u.status}</span>
                  {u.status === "declined" && (
                    <button className="ml-auto h-9 text-brass hover:underline" onClick={() => setMember(u, "accepted")}>
                      Accept after all
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </details>
        )}
      </Panel>

      {p.status !== "completed" && (
        <Panel className="p-4 sm:p-7">
          <PeopleWhoMightFit proposalId={p.id} />
        </Panel>
      )}

      <Modal open={Boolean(removing)} onClose={() => setRemoving(null)} title={`Remove ${removing?.name ?? ""}?`}>
        <p className="text-sm text-dim">They'll be told they were removed from the team.</p>
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="quiet" onClick={() => setRemoving(null)}>
            Cancel
          </Button>
          <Button variant="danger" loading={busy === `${removing?.id}removed`} onClick={() => removing && setMember(removing, "removed")}>
            Remove
          </Button>
        </div>
      </Modal>
      <Modal open={completing} onClose={() => setCompleting(false)} title="Mark as completed?">
        <p className="text-sm text-dim">Congratulations! Completed projects move to the Completed tab and stop taking new people. The team will be told.</p>
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="quiet" onClick={() => setCompleting(false)}>
            Not yet
          </Button>
          <Button
            loading={busy === "completed"}
            onClick={async () => {
              await patch({ status: "completed" }, "completed", "Project completed. Well done, team!");
              setCompleting(false);
            }}
          >
            Mark completed
          </Button>
        </div>
      </Modal>
      <DeleteModal open={deleting} onClose={() => setDeleting(false)} busy={busy === "delete"} onConfirm={del} />
    </section>
  );
}

function DeleteModal({ open, onClose, busy, onConfirm }: { open: boolean; onClose: () => void; busy: boolean; onConfirm: () => void }) {
  const [text, setText] = useState("");
  return (
    <Modal open={open} onClose={onClose} title="Delete this project?">
      <p className="text-sm text-dim">This removes it for everyone, along with the team list. It can't be undone. Type DELETE to confirm.</p>
      <Input className="mt-4" value={text} onChange={(e) => setText(e.target.value)} aria-label="Type DELETE to confirm" autoCapitalize="characters" />
      <div className="mt-6 flex justify-end gap-2">
        <Button variant="quiet" onClick={onClose}>
          Cancel
        </Button>
        <Button variant="danger" disabled={text !== "DELETE"} loading={busy} onClick={onConfirm}>
          Delete project
        </Button>
      </div>
    </Modal>
  );
}
