"use client";

import { useEffect, useMemo, useState } from "react";
import useSWR, { mutate as globalMutate } from "swr";
import { AnimatePresence, motion } from "motion/react";
import { toast } from "sonner";
import { Check, Download, Pencil, RefreshCw, Search, ShieldCheck, Trash2, Undo2, UserCheck, UserX } from "lucide-react";
import type { AppSettings } from "@/lib/settings";
import { api, timeAgo } from "@/lib/client";
import { downloadCsv } from "@/lib/csv";
import { Avatar, Button, Input, Label, Modal, Segmented, Skeleton, Tag, cx } from "../ui";

export type AdminUser = {
  id: string;
  email: string;
  name: string;
  photoUrl: string | null;
  status: "pending" | "approved" | "rejected";
  isAdmin: boolean;
  role: "participant" | "team";
  teamTitle: string | null;
  batch: string | null;
  batchLabel: string | null;
  signupHint: { batch: string | null; batchLabel: string | null; saysTeam: boolean };
  onboarded: boolean;
  university: string;
  city: string;
  fieldOfStudy: string;
  createdAt: string | null;
  lastSeenAt: string | null;
  posted: number;
  proposals: number;
  scholarships: number;
  matches: number;
};

const STATUS_TONE = { pending: "brass", approved: "aurora", rejected: "ember" } as const;
const selectCls = "h-11 w-full rounded-[var(--radius-field)] border border-line-strong bg-night-2 px-3.5 text-star focus:border-brass focus:outline-none sm:h-10";

export function PeopleTab() {
  const { data, mutate, error } = useSWR<{ items: AdminUser[] }>("/api/admin/users");
  const { data: sdata } = useSWR<{ settings: AppSettings }>("/api/admin/settings");
  const batches = sdata?.settings.batches ?? [];
  const [filter, setFilter] = useState<"pending" | "approved" | "rejected" | "all">("pending");
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<AdminUser | null>(null);
  const [sheet, setSheet] = useState<{ users: AdminUser[]; mode: "approve" | "edit" } | null>(null);

  const counts = useMemo(() => {
    const c = { pending: 0, approved: 0, rejected: 0, all: data?.items.length ?? 0 };
    data?.items.forEach((u) => c[u.status]++);
    return c;
  }, [data]);
  useEffect(() => {
    if (data && counts.pending === 0 && filter === "pending") setFilter("approved");
    // only on first load
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data === undefined]);

  const needle = q.trim().toLowerCase();
  const list = (data?.items ?? []).filter(
    (u) => (filter === "all" || u.status === filter) && (!needle || `${u.name} ${u.email} ${u.university} ${u.batchLabel ?? ""}`.toLowerCase().includes(needle)),
  );

  async function patch(body: Record<string, unknown>, key: string, success: string) {
    setBusy(key);
    try {
      await api<{ updated: number }>("/api/admin/users", "PATCH", body);
      toast.success(success);
      await mutate();
      globalMutate("/api/admin");
      globalMutate("/api/notifications");
      return true;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not update");
      return false;
    } finally {
      setBusy(null);
    }
  }

  async function rematch(u: AdminUser) {
    setBusy(`m-${u.id}`);
    try {
      const r = await api<{ matchCount: number }>("/api/admin", "POST", { action: "rematchUser", userId: u.id });
      toast.success(`${u.name} now has ${r.matchCount} matches`);
      mutate();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not re-match");
    } finally {
      setBusy(null);
    }
  }

  function exportCsv() {
    downloadCsv(
      "comskills-members.csv",
      ["name", "email", "status", "role", "team title", "batch", "university", "city", "field of study", "onboarded", "joined", "last seen", "projects proposed", "scholarship entries", "opportunities shared", "matches"],
      (data?.items ?? []).map((u) => [
        u.name,
        u.email,
        u.status,
        u.isAdmin ? "admin" : u.role,
        u.teamTitle ?? "",
        u.batchLabel ?? "",
        u.university,
        u.city,
        u.fieldOfStudy,
        u.onboarded ? "yes" : "no",
        u.createdAt ?? "",
        u.lastSeenAt ?? "",
        u.proposals,
        u.scholarships,
        u.posted,
        u.matches,
      ]),
    );
  }

  const pending = (data?.items ?? []).filter((u) => u.status === "pending");

  return (
    <div>
      <div className="mb-5 space-y-3">
        <div className="-mx-4 overflow-x-auto px-4 [scrollbar-width:none] sm:mx-0 sm:px-0">
          <Segmented
            id="people-filter"
            value={filter}
            onChange={setFilter}
            options={[
              { value: "pending", label: "Waiting", count: counts.pending },
              { value: "approved", label: "Approved", count: counts.approved },
              { value: "rejected", label: "Declined", count: counts.rejected },
              { value: "all", label: "All", count: counts.all },
            ]}
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-48 flex-1">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-faint" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, email, university, batch" className="pl-10" aria-label="Search people" type="search" />
          </div>
          {pending.length > 1 && (
            <Button onClick={() => setSheet({ users: pending, mode: "approve" })}>
              <Check className="size-4" /> Approve all {pending.length}
            </Button>
          )}
          <Button variant="ghost" onClick={exportCsv} disabled={!data?.items.length}>
            <Download className="size-4" /> CSV
          </Button>
        </div>
      </div>

      {error && !data ? (
        <p className="rounded-2xl border border-ember/40 p-5 text-ember">Couldn't load people. Refresh to try again.</p>
      ) : !data ? (
        <Skeleton className="h-64 rounded-[var(--radius-panel)]" />
      ) : list.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-line-strong p-8 text-center text-dim">
          {filter === "pending" ? "Nobody is waiting. New sign-ups appear here after they confirm their email." : "No one here."}
        </p>
      ) : (
        <ul className="space-y-2">
          <AnimatePresence initial={false}>
            {list.map((u) => (
              <motion.li layout key={u.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: 40 }} className="rounded-2xl border border-line bg-raised/70 p-4">
                <div className="flex items-start gap-3">
                  <Avatar name={u.name} src={u.photoUrl} size={40} />
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-2 font-medium">
                      {u.name}
                      <Tag tone={STATUS_TONE[u.status]}>{u.status === "rejected" ? "declined" : u.status === "pending" ? "waiting" : "approved"}</Tag>
                      {u.isAdmin && (
                        <Tag tone="violet">
                          <ShieldCheck className="size-3" /> admin
                        </Tag>
                      )}
                      {u.role === "team" && <Tag tone="violet">team{u.teamTitle ? ` · ${u.teamTitle}` : ""}</Tag>}
                      {u.batchLabel && <Tag>{u.batchLabel}</Tag>}
                    </p>
                    <p className="truncate text-sm text-dim">{u.email}</p>
                    {(u.signupHint.batchLabel || u.signupHint.saysTeam) && (
                      <p className="mt-0.5 text-xs text-brass">
                        At sign-up: {[u.signupHint.batchLabel, u.signupHint.saysTeam ? "says they're on the team" : null].filter(Boolean).join(", ")}
                      </p>
                    )}
                    <p className="mt-0.5 text-xs text-faint">
                      Joined {u.createdAt ? timeAgo(u.createdAt) : "unknown"}
                      {u.lastSeenAt && `, last seen ${timeAgo(u.lastSeenAt)}`}
                      {u.status === "approved" && (u.onboarded ? `, ${u.proposals} projects, ${u.scholarships} tracker entries, ${u.matches} matches` : ", hasn't finished their profile")}
                    </p>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-1.5 sm:pl-[52px]">
                  {!u.isAdmin && u.status !== "approved" && (
                    <Button size="sm" onClick={() => setSheet({ users: [u], mode: "approve" })}>
                      <UserCheck className="size-3.5" /> Approve
                    </Button>
                  )}
                  {!u.isAdmin && u.status !== "rejected" && (
                    <Button size="sm" variant="ghost" loading={busy === u.id + "r"} onClick={() => patch({ ids: [u.id], status: "rejected" }, u.id + "r", u.status === "approved" ? `Revoked ${u.name}` : `Declined ${u.name}`)}>
                      <UserX className="size-3.5" /> {u.status === "approved" ? "Revoke" : "Decline"}
                    </Button>
                  )}
                  {!u.isAdmin && u.status === "rejected" && (
                    <Button size="sm" variant="quiet" loading={busy === u.id + "p"} onClick={() => patch({ ids: [u.id], status: "pending" }, u.id + "p", `${u.name} is back in the waiting list`)}>
                      <Undo2 className="size-3.5" /> Back to waiting
                    </Button>
                  )}
                  {u.status === "approved" && (
                    <Button size="sm" variant="ghost" onClick={() => setSheet({ users: [u], mode: "edit" })}>
                      <Pencil className="size-3.5" /> Role & batch
                    </Button>
                  )}
                  {u.status === "approved" && u.onboarded && (
                    <Button size="sm" variant="quiet" loading={busy === `m-${u.id}`} onClick={() => rematch(u)} aria-label={`Re-run matching for ${u.name}`} title="Re-run matching">
                      <RefreshCw className="size-3.5" />
                    </Button>
                  )}
                  {!u.isAdmin && (
                    <Button size="sm" variant="quiet" onClick={() => setDeleting(u)} aria-label={`Delete ${u.name}`}>
                      <Trash2 className="size-3.5" />
                    </Button>
                  )}
                </div>
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
      )}
      <RoleSheet
        sheet={sheet}
        batches={batches}
        busy={busy === "sheet"}
        onClose={() => setSheet(null)}
        onSubmit={async (body) => {
          const ok = await patch(
            body,
            "sheet",
            sheet?.mode === "approve" ? `Approved ${sheet.users.length === 1 ? sheet.users[0].name : `${sheet.users.length} people`}. They'll get an email.` : "Saved",
          );
          if (ok) setSheet(null);
        }}
      />
      <DeleteUserModal user={deleting} onClose={() => setDeleting(null)} onDone={() => mutate()} />
    </div>
  );
}

/** Approve (or edit) with role, team title and batch in one go. Bulk approval can keep each person's own batch choice. */
function RoleSheet({
  sheet,
  batches,
  busy,
  onClose,
  onSubmit,
}: {
  sheet: { users: AdminUser[]; mode: "approve" | "edit" } | null;
  batches: AppSettings["batches"];
  busy: boolean;
  onClose: () => void;
  onSubmit: (body: Record<string, unknown>) => void;
}) {
  const one = sheet?.users.length === 1 ? sheet.users[0] : null;
  const [role, setRole] = useState<"participant" | "team">("participant");
  const [title, setTitle] = useState("");
  const [batch, setBatch] = useState("");
  const [useHints, setUseHints] = useState(true);
  useEffect(() => {
    if (!sheet) return;
    const u = sheet.users[0];
    setRole(one ? (sheet.mode === "edit" ? u.role : u.signupHint.saysTeam ? "team" : "participant") : "participant");
    setTitle(one?.teamTitle ?? "");
    setBatch(one ? (sheet.mode === "edit" ? u.batch ?? "" : u.signupHint.batch ?? "") : "");
    setUseHints(true);
  }, [sheet, one]);
  if (!sheet) return <Modal open={false} onClose={onClose} title="">{null}</Modal>;
  const many = !one;

  async function submit() {
    if (!sheet) return;
    if (many && useHints) {
      onSubmit({ ids: sheet.users.map((u) => u.id), status: "approved", role: "participant", useSignupBatch: true });
      return;
    }
    onSubmit({
      ids: sheet.users.map((u) => u.id),
      ...(sheet.mode === "approve" ? { status: "approved" } : {}),
      role,
      teamTitle: role === "team" ? title.trim() || null : null,
      batch: batch || null,
    });
  }

  return (
    <Modal open onClose={onClose} title={sheet.mode === "approve" ? (one ? `Approve ${one.name}` : `Approve ${sheet.users.length} people`) : `Role & batch for ${one?.name}`}>
      <div className="space-y-5">
        {many && (
          <label className="flex min-h-11 cursor-pointer items-start gap-3 text-sm">
            <input type="checkbox" checked={useHints} onChange={(e) => setUseHints(e.target.checked)} className="mt-0.5 size-5 accent-[var(--brass)]" />
            <span>
              Approve everyone as participants, each in the batch they chose at sign-up.
              <span className="block text-xs text-faint">Untick to set one role and batch for all of them.</span>
            </span>
          </label>
        )}
        {(!many || !useHints) && (
          <>
            <div>
              <Label>Role</Label>
              <div className="flex gap-2" role="radiogroup" aria-label="Role">
                {(["participant", "team"] as const).map((r) => (
                  <button
                    key={r}
                    type="button"
                    role="radio"
                    aria-checked={role === r}
                    onClick={() => setRole(r)}
                    className={cx("h-11 flex-1 rounded-full border text-sm sm:h-10", role === r ? "border-brass bg-brass/15 text-star" : "border-line-strong text-dim")}
                  >
                    {r === "team" ? "Comskills team" : "Participant"}
                  </button>
                ))}
              </div>
              {one?.signupHint.saysTeam && <p className="mt-1.5 text-xs text-brass">They said they're on the Comskills team.</p>}
            </div>
            {role === "team" && (
              <div>
                <Label htmlFor="rs-title" hint="Shown on their profile">
                  Team title
                </Label>
                <Input id="rs-title" maxLength={60} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Mentor – scholarships" />
              </div>
            )}
            <div>
              <Label htmlFor="rs-batch">Batch</Label>
              <select id="rs-batch" className={selectCls} value={batch} onChange={(e) => setBatch(e.target.value)}>
                <option value="">No batch</option>
                {batches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.label}
                    {b.archived ? " (archived)" : ""}
                  </option>
                ))}
              </select>
              {!batches.length && <p className="mt-1.5 text-xs text-faint">Add batches in Admin → Access.</p>}
              {one?.signupHint.batchLabel && <p className="mt-1.5 text-xs text-brass">They chose {one.signupHint.batchLabel} at sign-up.</p>}
            </div>
          </>
        )}
      </div>
      <div className="mt-6 flex justify-end gap-2">
        <Button variant="quiet" onClick={onClose}>
          Cancel
        </Button>
        <Button loading={busy} onClick={submit}>
          {sheet.mode === "approve" ? "Approve" : "Save"}
        </Button>
      </div>
    </Modal>
  );
}

function DeleteUserModal({ user, onClose, onDone }: { user: AdminUser | null; onClose: () => void; onDone: () => void }) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => setText(""), [user]);
  async function go() {
    if (!user) return;
    setBusy(true);
    try {
      await api("/api/admin/users", "DELETE", { id: user.id, confirm: "DELETE" });
      toast.success(`Deleted ${user.name}`);
      onDone();
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not delete");
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal open={Boolean(user)} onClose={onClose} title={`Delete ${user?.name ?? ""}?`}>
      <p className="text-sm text-dim">
        Removes their profile, photo, matches, connect requests, tracker entries, the projects they proposed and their place in other projects. Opportunities they shared stay, marked as shared by a former member. They could sign up again; to block someone, use Decline instead.
      </p>
      <Input className="mt-4" value={text} onChange={(e) => setText(e.target.value)} placeholder="Type DELETE" aria-label="Type DELETE to confirm" autoCapitalize="characters" />
      <div className="mt-6 flex justify-end gap-2">
        <Button variant="quiet" onClick={onClose}>
          Cancel
        </Button>
        <Button variant="danger" disabled={text !== "DELETE"} loading={busy} onClick={go}>
          Delete account
        </Button>
      </div>
    </Modal>
  );
}
