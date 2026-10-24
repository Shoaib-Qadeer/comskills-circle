"use client";

import { useEffect, useState } from "react";
import useSWR from "swr";
import { signOut } from "next-auth/react";
import { toast } from "sonner";
import { Download, Moon, RefreshCw, Sun } from "lucide-react";
import type { ConnectionDTO, MatchDTO, MeDTO } from "@/lib/types";
import { SUGGESTED_LOCATIONS, SUGGESTED_ROLES, SUGGESTED_SKILLS } from "@/lib/taxonomy";
import { api, fetcher } from "@/lib/client";
import { Button, ChipInput, ErrorText, Input, Label, Modal, PageHeader, Panel, Skeleton, Textarea, Toggle } from "./ui";
import { draftFromMe, FieldPicker, LinksFields, linksValid, ProfilePreview, VisibilityPicker, type ProfileDraft } from "./ProfileParts";
import { useTheme } from "./AppShell";

function Section({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <Panel as="section" className="p-5 sm:p-7">
      <h2 className="font-display text-xl font-semibold">{title}</h2>
      {description && <p className="mt-1 text-sm text-dim">{description}</p>}
      <div className="mt-6">{children}</div>
    </Panel>
  );
}

export function SettingsView() {
  const { data: me, mutate } = useSWR<MeDTO>("/api/me");
  const [d, setD] = useState<ProfileDraft | null>(null);
  const [saving, setSaving] = useState(false);
  const [rematching, setRematching] = useState(false);
  const [del, setDel] = useState(false);
  const { theme, toggle } = useTheme();

  useEffect(() => {
    if (me && !d) setD(draftFromMe(me));
  }, [me, d]);

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
  const valid = d.fields.length > 0 && d.headline.trim().length >= 3 && linksValid(d.links);

  async function save() {
    setSaving(true);
    try {
      const updated = await api<MeDTO>("/api/me", "PATCH", {
        ...d,
        links: Object.fromEntries(Object.entries(d!.links).filter(([, v]) => v)),
      });
      mutate(updated, { revalidate: false });
      setD(draftFromMe(updated));
      toast.success("Saved. Your matches will refresh in a moment.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save");
    } finally {
      setSaving(false);
    }
  }

  async function rematch() {
    setRematching(true);
    try {
      const r = await api<{ count: number }>("/api/me/rematch", "POST");
      toast.success(`Matches refreshed — ${r.count} active`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not refresh");
    } finally {
      setRematching(false);
    }
  }

  async function download() {
    try {
      const [profile, matches, connections] = await Promise.all([
        fetcher<MeDTO>("/api/me"),
        fetcher<{ items: MatchDTO[] }>("/api/matches?filter=all"),
        fetcher<{ items: ConnectionDTO[] }>("/api/connections"),
      ]);
      const blob = new Blob(
        [JSON.stringify({ exportedAt: new Date().toISOString(), profile, matches: matches.items, connectionsYouAdded: connections.items.filter((c) => c.addedByMe) }, null, 2)],
        { type: "application/json" },
      );
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "compass-my-data.json";
      a.click();
      URL.revokeObjectURL(a.href);
    } catch {
      toast.error("Could not export your data");
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader title="Settings" subtitle="Your profile drives your matches. Changes re-run matching automatically." />

      <Section title="Who can see your profile">
        <div className="grid gap-5 md:grid-cols-[1.2fr_1fr]">
          <VisibilityPicker value={d.visibility} onChange={(v) => set("visibility", v)} />
          <ProfilePreview d={d} name={me.name} photoUrl={me.photoUrl} />
        </div>
      </Section>

      <Section title="Your direction">
        <div className="space-y-6">
          <div>
            <Label htmlFor="s-headline" hint={`${d.headline.length}/80`}>
              Headline
            </Label>
            <Input id="s-headline" maxLength={80} value={d.headline} onChange={(e) => set("headline", e.target.value)} />
          </div>
          <div>
            <Label htmlFor="s-summary" hint={`${d.summary.length}/800`}>
              Where you’re heading
            </Label>
            <Textarea id="s-summary" rows={5} maxLength={800} value={d.summary} onChange={(e) => set("summary", e.target.value)} />
          </div>
          <div>
            <Label>Fields</Label>
            <FieldPicker value={d.fields} onChange={(v) => set("fields", v)} headline={d.headline} summary={d.summary} />
          </div>
        </div>
      </Section>

      <Section title="Practicalities">
        <div className="space-y-6">
          <div>
            <Label>Kinds of roles</Label>
            <ChipInput values={d.targetRoles} onChange={(v) => set("targetRoles", v)} suggestions={SUGGESTED_ROLES} max={6} />
          </div>
          <div>
            <Label>Where</Label>
            <ChipInput values={d.preferredLocations} onChange={(v) => set("preferredLocations", v)} suggestions={SUGGESTED_LOCATIONS} max={8} />
          </div>
          <Toggle
            checked={d.openToFrench}
            onChange={(v) => set("openToFrench", v)}
            label="I'm open to internships in French"
            description="If off, roles that require French won't be matched to you."
          />
        </div>
      </Section>

      <Section title="Links & help">
        <div className="space-y-6">
          <LinksFields links={d.links} onChange={(l) => set("links", l)} />
          <div>
            <Label>I can help classmates with</Label>
            <ChipInput values={d.skillsOffered} onChange={(v) => set("skillsOffered", v)} suggestions={SUGGESTED_SKILLS} max={10} />
          </div>
          {d.visibility === "open" && (
            <div>
              <Label htmlFor="s-collab" hint={`${d.collaborateOn.length}/200`}>
                Looking to collaborate on
              </Label>
              <Input id="s-collab" maxLength={200} value={d.collaborateOn} onChange={(e) => set("collaborateOn", e.target.value)} />
            </div>
          )}
        </div>
      </Section>

      <Section title="App">
        <div className="flex flex-wrap gap-3">
          <Button variant="ghost" onClick={toggle}>
            {theme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />} {theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
          </Button>
          <Button variant="ghost" onClick={rematch} loading={rematching}>
            <RefreshCw className="size-4" /> Refresh my matches
          </Button>
          <Button variant="ghost" onClick={download}>
            <Download className="size-4" /> Download my data
          </Button>
        </div>
      </Section>

      <Panel as="section" className="border-ember/30 p-5 sm:p-7">
        <h2 className="font-display text-xl font-semibold text-ember">Delete my account</h2>
        <p className="mt-2 text-sm text-dim">
          Removes your profile, matches, the connections you added and all intro requests, immediately. Opportunities you shared stay on the board for the class, shown as shared by a former member.
        </p>
        <Button variant="danger" className="mt-5" onClick={() => setDel(true)}>
          Delete my account
        </Button>
      </Panel>

      {dirty && (
        <div className="sticky bottom-20 z-20 flex justify-end lg:bottom-6">
          <div className="flex items-center gap-3 rounded-full border border-line-strong bg-raised px-4 py-2 shadow-2xl">
            <span className="text-sm text-dim">Unsaved changes</span>
            <Button variant="quiet" size="sm" onClick={() => setD(draftFromMe(me))}>
              Discard
            </Button>
            <Button size="sm" loading={saving} disabled={!valid} onClick={save}>
              Save
            </Button>
          </div>
        </div>
      )}

      <DeleteModal open={del} onClose={() => setDel(false)} />
    </div>
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
      setErr(e instanceof Error ? e.message : "Could not delete");
      setBusy(false);
    }
  }
  return (
    <Modal open={open} onClose={onClose} title="Delete your account?">
      <p className="text-sm text-dim">This can’t be undone. Type DELETE to confirm.</p>
      <Input className="mt-4" value={text} onChange={(e) => setText(e.target.value)} aria-label="Type DELETE to confirm" autoFocus />
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
