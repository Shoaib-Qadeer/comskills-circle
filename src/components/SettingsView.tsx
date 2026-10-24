"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import useSWR from "swr";
import { signIn, signOut } from "next-auth/react";
import { toast } from "sonner";
import { Download, Moon, RefreshCw, Sun } from "lucide-react";
import type { MeDTO, NotifyPrefs } from "@/lib/types";
import { api, fetcher } from "@/lib/client";
import { passwordProblem } from "@/lib/password-rules";
import { Button, ErrorText, Input, Modal, PageHeader, Panel, Skeleton, Tag, Toggle, cx } from "./ui";
import {
  BasicsFields,
  basicsProblems,
  draftFromMe,
  draftToPatch,
  LookingForFields,
  lookingForProblems,
  PhotoPicker,
  TechnicalFields,
  technicalProblems,
  VolunteeringFields,
  type ProfileDraft,
} from "./ProfileParts";
import { PasswordField } from "./auth/AuthParts";
import { useTheme } from "./AppShell";

function Section({ id, title, description, children }: { id?: string; title: string; description?: string; children: React.ReactNode }) {
  return (
    <Panel as="section" className="scroll-mt-20 p-4 sm:p-7">
      <h2 id={id} className="font-display text-xl font-semibold">
        {title}
      </h2>
      {description && <p className="mt-1 text-sm text-dim">{description}</p>}
      <div className="mt-6">{children}</div>
    </Panel>
  );
}

export function SettingsView() {
  const { data: me, mutate, error } = useSWR<MeDTO>("/api/me");
  const [d, setD] = useState<ProfileDraft | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [del, setDel] = useState(false);

  useEffect(() => {
    if (me && !d) {
      setD(draftFromMe(me));
      setPhotoUrl(me.photoUrl);
    }
  }, [me, d]);

  if (error && !me) return <p className="rounded-2xl border border-ember/40 p-5 text-ember">Couldn't load your settings. Check your connection and refresh.</p>;
  if (!me || !d) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-80 rounded-[var(--radius-panel)]" />
      </div>
    );
  }
  const set = <K extends keyof ProfileDraft>(k: K, v: ProfileDraft[K]) => setD((p) => (p ? { ...p, [k]: v } : p));
  const dirty = JSON.stringify(d) !== JSON.stringify(draftFromMe(me));
  const problem = basicsProblems(d) || technicalProblems(d) || lookingForProblems(d);

  async function save() {
    if (problem) return toast.error(problem);
    setSaving(true);
    try {
      const updated = await api<MeDTO>("/api/me", "PATCH", draftToPatch(d!));
      mutate(updated, { revalidate: false });
      setD(draftFromMe(updated));
      toast.success("Saved. Your matches will refresh in a moment.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save. Try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <PageHeader
        title="Settings"
        subtitle="Your profile drives your matches. Changes re-run matching automatically."
        action={
          <Link href={`/members/${me.id}`} className="inline-flex h-11 items-center rounded-full border border-line-strong px-4 text-sm hover:bg-raised-2 sm:h-10">
            View my profile
          </Link>
        }
      />

      <Section title="Profile">
        <PhotoPicker
          name={d.name}
          photoUrl={photoUrl}
          onChange={(u) => {
            setPhotoUrl(u);
            mutate();
          }}
        />
        <div className="mt-5 flex flex-wrap gap-2 text-sm text-dim">
          {me.isAdmin && <Tag tone="violet">Admin</Tag>}
          {me.role === "team" ? <Tag tone="violet">Team{me.teamTitle ? ` · ${me.teamTitle}` : ""}</Tag> : <Tag>Participant</Tag>}
          {me.batchLabel && <Tag>{me.batchLabel}</Tag>}
          <span className="text-xs text-faint">Role and batch are set by the Comskills team.</span>
        </div>
      </Section>
      <Section title="The basics">
        <BasicsFields d={d} set={set} accountEmail={me.email} />
      </Section>
      <Section title="Technical background">
        <TechnicalFields d={d} set={set} />
      </Section>
      <Section title="What you're looking for">
        <LookingForFields d={d} set={set} />
      </Section>
      <Section title="Volunteering">
        <VolunteeringFields d={d} set={set} />
      </Section>

      <NotificationsSection me={me} onSaved={(notify) => mutate({ ...me, notify }, { revalidate: false })} />
      <PasswordSection email={me.email} />
      <AppSection />

      <Panel as="section" className="border-ember/30 p-4 sm:p-7">
        <h2 className="font-display text-xl font-semibold text-ember">Delete my account</h2>
        <p className="mt-2 text-sm text-dim">
          Removes your profile, photo, matches, connect requests, scholarship tracker, the projects you proposed and your place in other projects, immediately. Opportunities you shared stay for the community, shown as shared by a former member.
        </p>
        <Button variant="danger" className="mt-5" onClick={() => setDel(true)} disabled={me.isAdmin}>
          Delete my account
        </Button>
        {me.isAdmin && <p className="mt-2 text-xs text-faint">Admin accounts can't be deleted here.</p>}
      </Panel>

      {dirty && (
        <div className="sticky bottom-20 z-20 flex justify-end lg:bottom-6">
          <div className="flex items-center gap-2 rounded-full border border-line-strong bg-raised py-1.5 pl-4 pr-1.5 shadow-2xl">
            <span className="text-sm text-dim">Unsaved changes</span>
            <Button variant="quiet" size="sm" onClick={() => setD(draftFromMe(me))}>
              Discard
            </Button>
            <Button size="sm" loading={saving} onClick={save}>
              Save
            </Button>
          </div>
        </div>
      )}

      <DeleteModal open={del} onClose={() => setDel(false)} />
    </div>
  );
}

const INSTANT_LABELS: { k: keyof NotifyPrefs["instant"]; label: string; description: string }[] = [
  { k: "interest", label: "Someone is interested in my project", description: "When a member clicks “I'm interested” on a project you proposed." },
  { k: "teamUpdates", label: "Project team updates", description: "When you're accepted into a project, or its status changes." },
  { k: "invites", label: "Project invitations", description: "When a proposer invites you to join." },
  { k: "connect", label: "Connect requests", description: "When someone asks to connect, or accepts your request." },
  { k: "pinned", label: "Important announcements", description: "Pinned news the team chooses to email to everyone." },
];

function NotificationsSection({ me, onSaved }: { me: MeDTO; onSaved: (n: NotifyPrefs) => void }) {
  const [n, setN] = useState<NotifyPrefs>(me.notify);
  const [busy, setBusy] = useState(false);
  async function save(next: NotifyPrefs) {
    const prev = n;
    setN(next);
    setBusy(true);
    try {
      await api("/api/me/notify", "PUT", next);
      onSaved(next);
    } catch (e) {
      setN(prev);
      toast.error(e instanceof Error ? e.message : "Could not save. Try again.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <Section id="notifications" title="Email notifications" description="You always see everything in the app. These only control emails.">
      <p className="mb-2 text-sm font-medium">Summary email</p>
      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Summary email">
        {(["weekly", "daily", "off"] as const).map((v) => (
          <button
            key={v}
            type="button"
            role="radio"
            aria-checked={n.digest === v}
            disabled={busy}
            onClick={() => save({ ...n, digest: v })}
            className={cx("h-11 rounded-full border px-4 text-sm capitalize sm:h-10", n.digest === v ? "border-brass bg-brass/15 text-star" : "border-line-strong text-dim hover:text-star")}
          >
            {v === "off" ? "Off" : v === "weekly" ? "Weekly (Monday)" : "Daily"}
          </button>
        ))}
      </div>
      <p className="mb-3 mt-7 text-sm font-medium">Instant emails</p>
      <div className="space-y-4">
        {INSTANT_LABELS.map((i) => (
          <Toggle key={i.k} checked={n.instant[i.k]} onChange={(v) => save({ ...n, instant: { ...n.instant, [i.k]: v } })} label={i.label} description={i.description} />
        ))}
      </div>
    </Section>
  );
}

function PasswordSection({ email }: { email: string }) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  async function submit(e: FormEvent) {
    e.preventDefault();
    setErr(null);
    const p = passwordProblem(next);
    if (!current) return setErr("Enter your current password.");
    if (p) return setErr(p);
    setBusy(true);
    try {
      const r = await api<{ token: string }>("/api/me/password", "POST", { current, next });
      // Every other device is now signed out; sign this one back in.
      await signIn("credentials", { email, oneTimeToken: r.token, redirect: false });
      setCurrent("");
      setNext("");
      toast.success("Password changed. Your other devices were signed out.");
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : "Could not change the password.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <Section title="Password" description="Changing it signs you out on every other device.">
      <form onSubmit={submit} className="max-w-md space-y-4" noValidate>
        <PasswordField id="s-cur" label="Current password" value={current} onChange={setCurrent} autoComplete="current-password" />
        <PasswordField id="s-new" label="New password" value={next} onChange={setNext} autoComplete="new-password" showStrength />
        <ErrorText>{err}</ErrorText>
        <Button type="submit" loading={busy}>
          Change password
        </Button>
      </form>
    </Section>
  );
}

function AppSection() {
  const { theme, toggle } = useTheme();
  const [rematching, setRematching] = useState(false);
  async function rematch() {
    setRematching(true);
    try {
      const r = await api<{ count: number }>("/api/me/rematch", "POST");
      toast.success(`Matches refreshed: ${r.count} for you right now.`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not refresh.");
    } finally {
      setRematching(false);
    }
  }
  async function download() {
    try {
      const profile = await fetcher<MeDTO>("/api/me");
      const matches = await fetcher<{ items: unknown[] }>("/api/matches?filter=all").catch(() => ({ items: [] }));
      const blob = new Blob([JSON.stringify({ exportedAt: new Date().toISOString(), profile, matches: matches.items }, null, 2)], { type: "application/json" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "comskills-circle-my-data.json";
      a.click();
      URL.revokeObjectURL(a.href);
    } catch {
      toast.error("Could not export your data.");
    }
  }
  return (
    <Section title="App">
      <div className="flex flex-wrap gap-3">
        <Button variant="ghost" onClick={toggle}>
          {theme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />} {theme === "dark" ? "Light theme" : "Dark theme"}
        </Button>
        <Button variant="ghost" onClick={rematch} loading={rematching}>
          <RefreshCw className="size-4" /> Refresh my matches
        </Button>
        <Button variant="ghost" onClick={download}>
          <Download className="size-4" /> Download my data
        </Button>
        <Button variant="quiet" onClick={() => signOut({ callbackUrl: "/" })}>
          Sign out
        </Button>
      </div>
    </Section>
  );
}

function DeleteModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  async function go() {
    setBusy(true);
    setErr(null);
    try {
      await api("/api/me", "DELETE", { confirm: "DELETE" });
      await signOut({ callbackUrl: "/" });
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not delete. Try again.");
      setBusy(false);
    }
  }
  return (
    <Modal open={open} onClose={onClose} title="Delete your account?">
      <p className="text-sm text-dim">This can't be undone. Type DELETE to confirm.</p>
      <Input className="mt-4" value={text} onChange={(e) => setText(e.target.value)} aria-label="Type DELETE to confirm" autoFocus autoCapitalize="characters" />
      <ErrorText>{err}</ErrorText>
      <div className="mt-6 flex justify-end gap-2">
        <Button variant="quiet" onClick={onClose}>
          Cancel
        </Button>
        <Button variant="danger" disabled={text !== "DELETE"} loading={busy} onClick={go}>
          Delete everything
        </Button>
      </div>
    </Modal>
  );
}
