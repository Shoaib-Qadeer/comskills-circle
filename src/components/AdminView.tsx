"use client";

import { useEffect, useMemo, useState } from "react";
import useSWR, { mutate as globalMutate } from "swr";
import { AnimatePresence, motion } from "motion/react";
import { toast } from "sonner";
import { Check, Download, FlaskConical, RefreshCw, RotateCcw, Search, ShieldCheck, Trash2, UserCheck, UserX, Undo2 } from "lucide-react";
import type { AppSettings, PromptKey } from "@/lib/settings";
import type { OpportunityDTO } from "@/lib/types";
import { api, formatDate, timeAgo } from "@/lib/client";
import { CountUp } from "./bits";
import { Avatar, Button, ErrorText, Input, Label, Modal, PageHeader, Panel, Segmented, Skeleton, Tag, Textarea, Toggle, cx } from "./ui";

type Overview = {
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

type AdminUser = {
  id: string;
  email: string;
  name: string;
  photoUrl: string | null;
  status: "pending" | "approved" | "rejected";
  isAdmin: boolean;
  onboarded: boolean;
  visibility: string;
  headline: string;
  fields: string[];
  createdAt: string | null;
  lastSeenAt: string | null;
  posted: number;
  matches: number;
};

type Tab = "overview" | "people" | "access" | "ai" | "content";

export function AdminView() {
  const [tab, setTab] = useState<Tab>("overview");
  const { data: overview } = useSWR<Overview>("/api/admin", { refreshInterval: 30_000 });
  return (
    <div>
      <PageHeader title="Admin" subtitle="Only you can see this page. Approve members, tune the AI and keep the board tidy." />
      <div className="-mx-4 mb-8 overflow-x-auto px-4 [scrollbar-width:none] sm:mx-0 sm:px-0">
        <Segmented
          id="admin-tab"
          value={tab}
          onChange={setTab}
          options={[
            { value: "overview", label: "Overview" },
            { value: "people", label: "People", count: overview?.counts.pending },
            { value: "access", label: "Access" },
            { value: "ai", label: "AI" },
            { value: "content", label: "Content" },
          ]}
        />
      </div>
      <AnimatePresence mode="wait">
        <motion.div key={tab} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }}>
          {tab === "overview" && <OverviewTab data={overview} go={setTab} />}
          {tab === "people" && <PeopleTab />}
          {tab === "access" && <AccessTab />}
          {tab === "ai" && <AiTab overview={overview} />}
          {tab === "content" && <ContentTab />}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

/* ------------------------------------------------------------------ overview */

function Stat({ label, value, tone, onClick }: { label: string; value: number | undefined; tone?: "brass" | "ember" | "aurora"; onClick?: () => void }) {
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

function OverviewTab({ data, go }: { data?: Overview; go: (t: Tab) => void }) {
  const today = data?.ai.usage.at(-1);
  const tokensToday = today ? today.inputTokens + today.outputTokens : 0;
  return (
    <div className="space-y-8">
      {data && data.counts.pending > 0 && (
        <button onClick={() => go("people")} className="flex w-full items-center gap-3 rounded-2xl border border-brass/40 bg-brass/[0.08] p-4 text-left">
          <UserCheck className="size-5 text-brass" />
          <span className="flex-1">
            <span className="font-medium">{data.counts.pending} {data.counts.pending === 1 ? "person is" : "people are"} waiting for approval.</span>{" "}
            <span className="text-dim">Review them in People.</span>
          </span>
        </button>
      )}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="waiting for approval" value={data?.counts.pending} tone={data?.counts.pending ? "brass" : undefined} onClick={() => go("people")} />
        <Stat label="active members" value={data?.counts.onboarded} onClick={() => go("people")} />
        <Stat label="seen this week" value={data?.counts.active7} />
        <Stat label="accounts in total" value={data?.counts.users} />
        <Stat label="open opportunities" value={data?.counts.open} tone="aurora" onClick={() => go("content")} />
        <Stat label="in the archive" value={data?.counts.archived} onClick={() => go("content")} />
        <Stat label="active matches" value={data?.counts.matches} />
      </div>
      <Panel className="p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-display text-lg font-semibold">AI today</h2>
            <p className="text-sm text-dim">
              {data ? `${data.ai.provider}, ${data.ai.model || "no model set"}` : "…"}
              {data && !data.ai.enabled && <span className="text-ember"> (switched off)</span>}
            </p>
          </div>
          <Button variant="ghost" size="sm" onClick={() => go("ai")}>
            AI settings
          </Button>
        </div>
        {data && (
          <>
            <div className="mt-5 grid gap-5 sm:grid-cols-2">
              <Meter label="Calls" used={today?.calls ?? 0} limit={data.ai.dailyCallLimit} />
              <Meter label="Tokens" used={tokensToday} limit={data.ai.dailyTokenLimit} />
            </div>
            <UsageChart usage={data.ai.usage} />
          </>
        )}
      </Panel>
    </div>
  );
}

function Meter({ label, used, limit }: { label: string; used: number; limit: number }) {
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

function UsageChart({ usage }: { usage: Overview["ai"]["usage"] }) {
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

/* ------------------------------------------------------------------ people */

const STATUS_TONE = { pending: "brass", approved: "aurora", rejected: "ember" } as const;

function PeopleTab() {
  const { data, mutate } = useSWR<{ items: AdminUser[] }>("/api/admin/users");
  const [filter, setFilter] = useState<"pending" | "approved" | "rejected" | "all">("pending");
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<AdminUser | null>(null);
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

  const list = (data?.items ?? []).filter(
    (u) => (filter === "all" || u.status === filter) && (!q || `${u.name} ${u.email}`.toLowerCase().includes(q.toLowerCase())),
  );

  async function setStatus(ids: string[], status: AdminUser["status"], key: string) {
    setBusy(key);
    try {
      const r = await api<{ updated: number }>("/api/admin/users", "PATCH", { ids, status });
      toast.success(status === "approved" ? `Approved ${r.updated}` : status === "rejected" ? `Declined ${r.updated}` : `Moved ${r.updated} back to pending`);
      await mutate();
      globalMutate("/api/admin");
      globalMutate("/api/notifications");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not update");
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
    const rows = [["name", "email", "status", "onboarded", "visibility", "joined", "last seen", "shared", "matches"]];
    (data?.items ?? []).forEach((u) =>
      rows.push([u.name, u.email, u.status, String(u.onboarded), u.visibility, u.createdAt ?? "", u.lastSeenAt ?? "", String(u.posted), String(u.matches)]),
    );
    const csv = rows.map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(",")).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = "members.csv";
    a.click();
    URL.revokeObjectURL(a.href);
  }

  const pendingIds = (data?.items ?? []).filter((u) => u.status === "pending").map((u) => u.id);

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center gap-3">
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
        <div className="relative min-w-48 flex-1">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-faint" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name or email" className="pl-10" aria-label="Search people" />
        </div>
        {pendingIds.length > 1 && (
          <Button loading={busy === "all"} onClick={() => setStatus(pendingIds, "approved", "all")}>
            <Check className="size-4" /> Approve all {pendingIds.length}
          </Button>
        )}
        <Button variant="ghost" onClick={exportCsv} disabled={!data?.items.length}>
          <Download className="size-4" /> CSV
        </Button>
      </div>

      {!data ? (
        <Skeleton className="h-64 rounded-[var(--radius-panel)]" />
      ) : list.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-line-strong p-8 text-center text-dim">
          {filter === "pending" ? "Nobody is waiting. New sign-ups appear here." : "No one here."}
        </p>
      ) : (
        <ul className="space-y-2">
          <AnimatePresence initial={false}>
            {list.map((u) => (
              <motion.li
                layout
                key={u.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: 40 }}
                className="flex flex-wrap items-center gap-x-4 gap-y-3 rounded-2xl border border-line bg-raised/70 p-4"
              >
                <Avatar name={u.name} src={u.photoUrl} size={40} />
                <div className="min-w-0 flex-1 basis-56">
                  <p className="flex flex-wrap items-center gap-2 font-medium">
                    {u.name}
                    <Tag tone={STATUS_TONE[u.status]}>{u.status === "rejected" ? "declined" : u.status}</Tag>
                    {u.isAdmin && (
                      <Tag tone="violet">
                        <ShieldCheck className="size-3" /> admin
                      </Tag>
                    )}
                  </p>
                  <p className="truncate text-sm text-dim">{u.email}</p>
                  <p className="mt-0.5 text-xs text-faint">
                    Joined {u.createdAt ? timeAgo(u.createdAt) : "unknown"}
                    {u.lastSeenAt && `, last seen ${timeAgo(u.lastSeenAt)}`}
                    {u.status === "approved" && (u.onboarded ? `, ${u.visibility} profile, ${u.matches} matches, ${u.posted} shared` : ", hasn't finished onboarding")}
                  </p>
                </div>
                {!u.isAdmin && (
                  <div className="flex flex-wrap items-center gap-1.5">
                    {u.status !== "approved" && (
                      <Button size="sm" loading={busy === u.id + "a"} onClick={() => setStatus([u.id], "approved", u.id + "a")}>
                        <UserCheck className="size-3.5" /> Approve
                      </Button>
                    )}
                    {u.status !== "rejected" && (
                      <Button size="sm" variant="ghost" loading={busy === u.id + "r"} onClick={() => setStatus([u.id], "rejected", u.id + "r")}>
                        <UserX className="size-3.5" /> {u.status === "approved" ? "Revoke" : "Decline"}
                      </Button>
                    )}
                    {u.status === "rejected" && (
                      <Button size="sm" variant="quiet" loading={busy === u.id + "p"} onClick={() => setStatus([u.id], "pending", u.id + "p")}>
                        <Undo2 className="size-3.5" /> Back to waiting
                      </Button>
                    )}
                    {u.status === "approved" && u.onboarded && (
                      <Button size="sm" variant="quiet" loading={busy === `m-${u.id}`} onClick={() => rematch(u)} title="Re-run matching for this person">
                        <RefreshCw className="size-3.5" />
                      </Button>
                    )}
                    <Button size="sm" variant="quiet" onClick={() => setDeleting(u)} aria-label={`Delete ${u.name}`}>
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                )}
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
      )}
      <DeleteUserModal user={deleting} onClose={() => setDeleting(null)} onDone={() => mutate()} />
    </div>
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
        Removes their profile, matches, the connections they added and their intro requests. Opportunities they shared stay, marked as shared by a former member. They can sign in again later unless you also decline them; to block someone, use Decline instead.
      </p>
      <Input className="mt-4" value={text} onChange={(e) => setText(e.target.value)} placeholder="Type DELETE" aria-label="Type DELETE to confirm" />
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

/* ------------------------------------------------------------------ settings helpers */

type SettingsRes = { settings: AppSettings; defaults: AppSettings; defaultPrompts: Record<PromptKey, string> };

function useSettingsDraft() {
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

function SaveBar({ dirty, saving, onSave, onReset }: { dirty: boolean; saving: boolean; onSave: () => void; onReset: () => void }) {
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

function NumberField({ id, label, hint, value, onChange, min, max, step = 1 }: { id: string; label: string; hint?: string; value: number; onChange: (v: number) => void; min: number; max: number; step?: number }) {
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

function parseEmails(text: string): { valid: string[]; invalid: string[] } {
  const parts = text
    .split(/[\s,;]+/)
    .map((x) => x.trim().toLowerCase())
    .filter(Boolean);
  const valid: string[] = [];
  const invalid: string[] = [];
  for (const p of parts) (/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(p) ? valid : invalid).push(p);
  return { valid: Array.from(new Set(valid)), invalid };
}

/* ------------------------------------------------------------------ access */

function AccessTab() {
  const { draft, setDraft, dirty, save, saving, reset } = useSettingsDraft();
  const [preText, setPreText] = useState<string | null>(null);
  useEffect(() => {
    if (draft && preText === null) setPreText(draft.access.preApprovedEmails.join("\n"));
  }, [draft, preText]);
  if (!draft || preText === null) return <Skeleton className="h-80 rounded-[var(--radius-panel)]" />;
  const pre = parseEmails(preText);
  const setAccess = (patch: Partial<AppSettings["access"]>) => setDraft({ ...draft, access: { ...draft.access, ...patch } });

  return (
    <div className="max-w-3xl space-y-6">
      <Panel className="p-5 sm:p-6">
        <Toggle
          checked={draft.access.requireApproval}
          onChange={(v) => setAccess({ requireApproval: v })}
          label="New sign-ups wait for my approval"
          description="When off, anyone with an allowed email gets in straight away. Pre-approved emails below always get in."
        />
      </Panel>
      <Panel className="p-5 sm:p-6">
        <Label htmlFor="pre" hint={`${pre.valid.length} emails`}>
          Pre-approved members
        </Label>
        <p className="mb-3 text-sm text-dim">Paste the community list (one email per line, or separated by commas). These people skip the waiting step, even if they're already waiting.</p>
        <Textarea
          id="pre"
          rows={6}
          value={preText}
          onChange={(e) => {
            setPreText(e.target.value);
            setAccess({ preApprovedEmails: parseEmails(e.target.value).valid });
          }}
          placeholder={"amina.adil@learningplanetinstitute.org\nilyas.ghafoor@learningplanetinstitute.org"}
        />
        <ErrorText>{pre.invalid.length > 0 && `Not saved, doesn't look like an email: ${pre.invalid.slice(0, 3).join(", ")}`}</ErrorText>
      </Panel>
      <SaveBar dirty={dirty} saving={saving} onSave={save} onReset={() => { reset(); setPreText(null); }} />
    </div>
  );
}

/* ------------------------------------------------------------------ AI */

const FEATURE_LABELS: Record<keyof AppSettings["ai"]["features"], { label: string; description: string }> = {
  extraction: { label: "Read posted links", description: "Fills in title, deadline, duration and fields when someone shares a link." },
  matchOpportunity: { label: "Match opportunities to people", description: "Scores each shared opportunity for every member and writes the reason." },
  matchProposal: { label: "Match projects to people", description: "Scores each project proposal for every member, and suggests people to invite." },
  profileSuggestions: { label: "Suggest profile fields", description: "Suggests fields while people write their direction." },
  coach: { label: "How to approach this", description: "Tailored advice on a match: what to highlight, gaps, a first step." },
};

const PROMPT_LABELS: Record<PromptKey, string> = {
  extraction: "Reading links",
  matchOpportunity: "Matching a new opportunity",
  matchProfile: "Matching a new or edited profile",
  matchProposal: "Matching a new project",
  profile: "Profile suggestions",
  coach: "How to approach this",
};

function AiTab({ overview }: { overview?: Overview }) {
  const { data, draft, setDraft, dirty, save, saving, reset } = useSettingsDraft();
  const { data: logData, mutate: mutateLog } = useSWR<{ log: { at: string; label: string; model: string; ok: boolean; inputTokens: number; outputTokens: number; ms: number; error: string | null }[] }>(
    "/api/admin/ai",
  );
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);
  const [prompt, setPrompt] = useState<PromptKey>("matchOpportunity");
  if (!draft || !data) return <Skeleton className="h-96 rounded-[var(--radius-panel)]" />;
  const ai = draft.ai;
  const setAi = (patch: Partial<AppSettings["ai"]>) => setDraft({ ...draft, ai: { ...ai, ...patch } });
  const setLimits = (patch: Partial<AppSettings["limits"]>) => setDraft({ ...draft, limits: { ...draft.limits, ...patch } });

  async function test() {
    setTesting(true);
    setTestResult(null);
    try {
      const r = await api<{ model: string; ms: number; reply: string }>("/api/admin/ai", "POST");
      setTestResult(`Working: ${r.model} replied in ${(r.ms / 1000).toFixed(1)} s: "${r.reply}"`);
    } catch (e) {
      setTestResult(e instanceof Error ? e.message : "Test failed");
    } finally {
      setTesting(false);
      mutateLog();
      globalMutate("/api/admin");
    }
  }

  return (
    <div className="space-y-6">
      <Panel className="p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="font-display text-lg font-semibold">Connection</h2>
            <p className="mt-1 text-sm text-dim">
              Provider <span className="text-star">{overview?.ai.provider ?? "…"}</span>, model{" "}
              <span className="text-star">{ai.model || overview?.ai.model || "not set"}</span>
              {ai.model ? " (override)" : " (from LLM_MODEL)"}. API key {overview?.ai.keyConfigured ? <span className="text-aurora">set</span> : <span className="text-ember">missing</span>}.
            </p>
          </div>
          <Button variant="ghost" onClick={test} loading={testing}>
            <FlaskConical className="size-4" /> Test the AI
          </Button>
        </div>
        {testResult && <p className={cx("mt-3 text-sm", testResult.startsWith("Working") ? "text-aurora" : "text-ember")}>{testResult}</p>}
        <div className="mt-6 grid gap-5 sm:grid-cols-2">
          <Toggle checked={ai.enabled} onChange={(v) => setAi({ enabled: v })} label="AI switched on" description="When off, Comskills Circle uses basic rule-based matching and manual forms." />
          <div>
            <Label htmlFor="model" hint="Leave empty to use LLM_MODEL">
              Model override
            </Label>
            <Input id="model" value={ai.model} onChange={(e) => setAi({ model: e.target.value.trim() })} placeholder={overview?.ai.model || "e.g. a flash or flash-lite model"} />
          </div>
        </div>
      </Panel>

      <Panel className="p-5 sm:p-6">
        <h2 className="font-display text-lg font-semibold">Budget and behaviour</h2>
        <p className="mt-1 text-sm text-dim">When a daily cap is reached, Comskills Circle switches to basic matching until midnight UTC. Your provider's own limits still apply.</p>
        <div className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          <NumberField id="calls" label="AI calls per day" value={ai.dailyCallLimit} min={0} max={100000} onChange={(v) => setAi({ dailyCallLimit: v })} />
          <NumberField id="tokens" label="Tokens per day" hint="input + output" value={ai.dailyTokenLimit} min={0} max={100000000} step={10000} onChange={(v) => setAi({ dailyTokenLimit: v })} />
          <NumberField id="threshold" label="Match threshold" hint="0–100" value={ai.matchThreshold} min={1} max={100} onChange={(v) => setAi({ matchThreshold: v })} />
          <NumberField id="chars" label="Characters read per link" value={ai.extractionChars} min={2000} max={120000} step={1000} onChange={(v) => setAi({ extractionChars: v })} />
          <NumberField id="batch" label="Opportunities per matching call" value={ai.profileBatchSize} min={1} max={50} onChange={(v) => setAi({ profileBatchSize: v })} />
          <NumberField id="temp" label="Temperature" hint="0 = consistent" value={ai.temperature} min={0} max={1} step={0.05} onChange={(v) => setAi({ temperature: v })} />
        </div>
      </Panel>

      <Panel className="p-5 sm:p-6">
        <h2 className="font-display text-lg font-semibold">AI features</h2>
        <div className="mt-5 grid gap-5 sm:grid-cols-2">
          {(Object.keys(FEATURE_LABELS) as (keyof typeof FEATURE_LABELS)[]).map((k) => (
            <Toggle key={k} checked={ai.features[k]} onChange={(v) => setAi({ features: { ...ai.features, [k]: v } })} label={FEATURE_LABELS[k].label} description={FEATURE_LABELS[k].description} />
          ))}
        </div>
      </Panel>

      <Panel className="p-5 sm:p-6">
        <h2 className="font-display text-lg font-semibold">Per-person daily limits</h2>
        <p className="mt-1 text-sm text-dim">You're exempt from these.</p>
        <div className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          <NumberField id="l-extract" label="Links read" value={draft.limits.extractPerDay} min={0} max={1000} onChange={(v) => setLimits({ extractPerDay: v })} />
          <NumberField id="l-post" label="Opportunities shared" value={draft.limits.postPerDay} min={0} max={1000} onChange={(v) => setLimits({ postPerDay: v })} />
          <NumberField id="l-connect" label="Connect requests" value={draft.limits.connectPerDay} min={0} max={1000} onChange={(v) => setLimits({ connectPerDay: v })} />
          <NumberField id="l-coach" label="Approach advice" value={draft.limits.coachPerDay} min={0} max={1000} onChange={(v) => setLimits({ coachPerDay: v })} />
        </div>
      </Panel>

      <Panel className="p-5 sm:p-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="font-display text-lg font-semibold">Prompts</h2>
            <p className="mt-1 text-sm text-dim">Edit the instructions the AI follows. Keep the JSON format the default asks for, or that feature falls back to basic behaviour.</p>
          </div>
          <select
            aria-label="Prompt to edit"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value as PromptKey)}
            className="h-10 rounded-[var(--radius-field)] border border-line-strong bg-night-2 px-3 text-sm text-star focus:border-brass focus:outline-none"
          >
            {(Object.keys(PROMPT_LABELS) as PromptKey[]).map((k) => (
              <option key={k} value={k}>
                {PROMPT_LABELS[k]}
                {ai.prompts[k] ? " (edited)" : ""}
              </option>
            ))}
          </select>
        </div>
        <Textarea
          className="mt-4 min-h-72 font-mono text-[13px] leading-relaxed"
          value={ai.prompts[prompt] || data.defaultPrompts[prompt]}
          onChange={(e) => setAi({ prompts: { ...ai.prompts, [prompt]: e.target.value === data.defaultPrompts[prompt] ? "" : e.target.value } })}
          aria-label={`Prompt: ${PROMPT_LABELS[prompt]}`}
        />
        <div className="mt-3 flex items-center justify-between gap-3 text-sm">
          <span className="text-faint">{ai.prompts[prompt] ? "Using your edited version." : "Using the built-in prompt."}</span>
          {ai.prompts[prompt] && (
            <Button size="sm" variant="quiet" onClick={() => setAi({ prompts: { ...ai.prompts, [prompt]: "" } })}>
              <RotateCcw className="size-3.5" /> Reset to built-in
            </Button>
          )}
        </div>
      </Panel>

      <Panel className="p-5 sm:p-6">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-display text-lg font-semibold">Recent AI calls</h2>
          <Button size="sm" variant="quiet" onClick={() => mutateLog()}>
            <RefreshCw className="size-3.5" /> Refresh
          </Button>
        </div>
        {overview && <UsageChart usage={overview.ai.usage} />}
        {!logData ? (
          <Skeleton className="mt-4 h-40" />
        ) : logData.log.length === 0 ? (
          <p className="mt-4 text-sm text-dim">No calls yet. They appear here as people share links and get matched.</p>
        ) : (
          <div className="mt-5 overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="text-xs text-faint">
                <tr>
                  <th className="py-2 pr-3 font-normal">When</th>
                  <th className="py-2 pr-3 font-normal">What</th>
                  <th className="py-2 pr-3 font-normal">Tokens in / out</th>
                  <th className="py-2 pr-3 font-normal">Time</th>
                  <th className="py-2 font-normal">Result</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {logData.log.map((l, i) => (
                  <tr key={i}>
                    <td className="py-2 pr-3 text-dim">{timeAgo(l.at)}</td>
                    <td className="py-2 pr-3">{l.label}</td>
                    <td className="tabular py-2 pr-3 text-dim">
                      {l.inputTokens.toLocaleString("en-GB")} / {l.outputTokens.toLocaleString("en-GB")}
                    </td>
                    <td className="tabular py-2 pr-3 text-dim">{(l.ms / 1000).toFixed(1)} s</td>
                    <td className="py-2">{l.ok ? <span className="text-aurora">OK</span> : <span className="text-ember" title={l.error ?? ""}>{(l.error ?? "Failed").slice(0, 80)}</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <SaveBar dirty={dirty} saving={saving} onSave={save} onReset={reset} />
    </div>
  );
}

/* ------------------------------------------------------------------ content */

function ContentTab() {
  const { data, mutate } = useSWR<{ opportunities: OpportunityDTO[] }>("/api/admin/content");
  const [which, setWhich] = useState<"open" | "expired">("open");
  const [busy, setBusy] = useState<string | null>(null);
  const opps = (data?.opportunities ?? []).filter((o) => (which === "expired" ? o.status === "expired" : o.status === "open"));

  async function rematch(o: OpportunityDTO) {
    setBusy(o.id);
    try {
      const r = await api<{ matchCount: number }>("/api/admin", "POST", { action: "rematch", opportunityId: o.id });
      toast.success(`Matched to ${r.matchCount} members`);
      mutate();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(null);
    }
  }
  async function removeOpp(o: OpportunityDTO) {
    if (!confirm(`Delete "${o.title}" for everyone?`)) return;
    await api(`/api/opportunities/${o.id}`, "DELETE").catch((e) => toast.error(e.message));
    toast.success("Deleted");
    mutate();
    globalMutate("/api/admin");
  }

  return (
    <div className="space-y-8">
      <div>
        <Segmented
          id="content-which"
          value={which}
          onChange={setWhich}
          className="mb-5"
          options={[
            { value: "open", label: "Open", count: data?.opportunities.filter((o) => o.status === "open").length },
            { value: "expired", label: "Archived", count: data?.opportunities.filter((o) => o.status === "expired").length },
          ]}
        />
        {!data ? (
          <Skeleton className="h-64 rounded-[var(--radius-panel)]" />
        ) : (
          <ul className="divide-y divide-line rounded-[var(--radius-panel)] border border-line bg-raised/60">
            {opps.length === 0 && <li className="p-6 text-center text-dim">Nothing here.</li>}
            {opps.map((o) => (
              <li key={o.id} className="flex flex-wrap items-center gap-3 px-5 py-3.5">
                <div className="min-w-0 flex-1 basis-64">
                  <p className="font-medium">{o.title}</p>
                  <p className="text-sm text-dim">
                    {[o.organization, o.postedBy ? `shared by ${o.postedBy.name}` : "former member", o.deadline ? `deadline ${formatDate(o.deadline)}` : "no deadline", `${o.matchCount ?? 0} matches`]
                      .filter(Boolean)
                      .join(", ")}
                  </p>
                </div>
                <Button size="sm" variant="ghost" loading={busy === o.id} onClick={() => rematch(o)}>
                  <RefreshCw className="size-3.5" /> Re-match
                </Button>
                <Button size="sm" variant="quiet" onClick={() => removeOpp(o)} aria-label={`Delete ${o.title}`}>
                  <Trash2 className="size-3.5" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
