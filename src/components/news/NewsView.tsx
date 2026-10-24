"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import useSWR, { mutate as globalMutate } from "swr";
import { AnimatePresence, motion } from "motion/react";
import { toast } from "sonner";
import { ExternalLink, Megaphone, MoreHorizontal, Pencil, Pin, PinOff, Plus, Trash2 } from "lucide-react";
import { REACTIONS, type AnnouncementCategory, type Reaction } from "@/lib/types";
import type { AnnouncementDTO } from "@/lib/news";
import { api, formatDate, timeAgo } from "@/lib/client";
import { hostLabel } from "@/lib/url";
import { announcementShareText } from "@/lib/share-text";
import { Avatar, Button, EmptyState, ErrorText, Input, Label, Modal, PageHeader, Skeleton, Tag, Textarea, Toggle, cx } from "../ui";
import { ShareButtons, absoluteUrl } from "../ShareButtons";
import { Linkified } from "../Linkified";

const CATEGORIES: { value: AnnouncementCategory; label: string; emoji: string }[] = [
  { value: "programme", label: "Programme", emoji: "📌" },
  { value: "event", label: "Event", emoji: "📅" },
  { value: "deadline", label: "Deadline", emoji: "⏳" },
  { value: "opportunity", label: "Opportunity", emoji: "🎯" },
  { value: "win", label: "Win", emoji: "🎉" },
];
const catOf = (c: AnnouncementCategory) => CATEGORIES.find((x) => x.value === c)!;

export function NewsView({ canPost }: { canPost: boolean }) {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const [category, setCategory] = useState<AnnouncementCategory | "">("");
  const key = `/api/announcements${category ? `?category=${category}` : ""}`;
  const { data, error, isLoading, mutate } = useSWR<{ items: AnnouncementDTO[] }>(key);
  const [composer, setComposer] = useState<{ mode: "new" | "edit"; post?: AnnouncementDTO; winId?: string } | null>(null);
  const markedRef = useRef(false);

  // Opening News clears the badge (after the "new" dots have been seen for a moment)
  useEffect(() => {
    if (!data || markedRef.current) return;
    markedRef.current = true;
    const t = setTimeout(() => {
      api("/api/announcements/read", "POST")
        .then(() => globalMutate("/api/notifications"))
        .catch(() => null);
    }, 1500);
    return () => clearTimeout(t);
  }, [data]);

  // Team → Wins → "Announce on News" lands here with ?compose=win&scholarship=…
  useEffect(() => {
    if (canPost && params.get("compose") === "win" && params.get("scholarship")) {
      setComposer({ mode: "new", winId: params.get("scholarship")! });
      router.replace(pathname, { scroll: false });
    } else if (canPost && params.get("compose") === "1") {
      setComposer({ mode: "new" });
      router.replace(pathname, { scroll: false });
    }
  }, [params, canPost, router, pathname]);

  // Scroll to a post from a notification link (#a-<id>)
  useEffect(() => {
    if (!data || typeof window === "undefined" || !window.location.hash.startsWith("#a-")) return;
    document.getElementById(window.location.hash.slice(1))?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [data]);

  const items = data?.items ?? [];
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="News"
        subtitle="Announcements from the Comskills team: programme updates, events, deadlines and wins."
        action={
          canPost ? (
            <Button onClick={() => setComposer({ mode: "new" })}>
              <Plus className="size-4" /> New post
            </Button>
          ) : undefined
        }
      />
      <div className="-mx-4 mb-5 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:px-0" role="group" aria-label="Filter by category">
        {[{ value: "" as const, label: "All", emoji: "" }, ...CATEGORIES].map((c) => (
          <button
            key={c.value || "all"}
            onClick={() => setCategory(c.value)}
            aria-pressed={category === c.value}
            className={cx("inline-flex h-11 shrink-0 items-center gap-1.5 rounded-full border px-4 text-sm sm:h-9", category === c.value ? "border-brass bg-brass/15 text-star" : "border-line-strong text-dim hover:text-star")}
          >
            {c.emoji && <span aria-hidden>{c.emoji}</span>} {c.label}
          </button>
        ))}
      </div>

      {error && !data ? (
        <EmptyState icon={<Megaphone className="size-10" />} title="Couldn't load the news" action={<Button variant="ghost" onClick={() => mutate()}>Try again</Button>}>
          Check your connection and try again.
        </EmptyState>
      ) : isLoading && !data ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-44 rounded-[var(--radius-panel)]" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <EmptyState icon={<Megaphone className="size-10" />} title={category ? "Nothing in this category yet" : "No news yet"} action={canPost && <Button onClick={() => setComposer({ mode: "new" })}>Write the first post</Button>}>
          {canPost ? "Share a programme update, an event or a member's win." : "The Comskills team's announcements will appear here."}
        </EmptyState>
      ) : (
        <ul className="space-y-3">
          <AnimatePresence initial={false}>
            {items.map((a, i) => (
              <PostCard key={a.id} a={a} index={i} onEdit={() => setComposer({ mode: "edit", post: a })} onChanged={() => mutate()} />
            ))}
          </AnimatePresence>
        </ul>
      )}

      {canPost && <Composer state={composer} onClose={() => setComposer(null)} onSaved={() => mutate()} />}
    </div>
  );
}

function PostCard({ a, index, onEdit, onChanged }: { a: AnnouncementDTO; index: number; onEdit: () => void; onChanged: () => void }) {
  const [reactions, setReactions] = useState(a.reactions);
  const [mine, setMine] = useState<Reaction[]>(a.mine);
  const [menu, setMenu] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    setReactions(a.reactions);
    setMine(a.mine);
  }, [a.reactions, a.mine]);
  const cat = catOf(a.category);
  const url = absoluteUrl(`/news#a-${a.id}`);

  async function react(e: Reaction) {
    const on = !mine.includes(e);
    // Optimistic: show it immediately, roll back if the request fails
    setMine((m) => (on ? [...m, e] : m.filter((x) => x !== e)));
    setReactions((r) => ({ ...r, [e]: Math.max(0, r[e] + (on ? 1 : -1)) }));
    try {
      const res = await api<{ on: boolean; count: number }>(`/api/announcements/${a.id}/react`, "POST", { emoji: e });
      setReactions((r) => ({ ...r, [e]: res.count }));
      setMine((m) => (res.on ? Array.from(new Set([...m, e])) : m.filter((x) => x !== e)));
    } catch {
      setMine((m) => (on ? m.filter((x) => x !== e) : [...m, e]));
      setReactions((r) => ({ ...r, [e]: Math.max(0, r[e] + (on ? -1 : 1)) }));
      toast.error("Couldn't save your reaction.");
    }
  }
  async function togglePin() {
    setMenu(false);
    try {
      await api(`/api/announcements/${a.id}`, "PATCH", { pinned: !a.pinned });
      toast.success(a.pinned ? "Unpinned" : "Pinned to the top");
      onChanged();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't update.");
    }
  }
  async function del() {
    setBusy(true);
    try {
      await api(`/api/announcements/${a.id}`, "DELETE");
      toast.success("Post deleted");
      setConfirmDel(false);
      onChanged();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't delete.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <motion.li
      id={`a-${a.id}`}
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0, transition: { delay: Math.min(index, 8) * 0.04 } }}
      exit={{ opacity: 0, scale: 0.97 }}
      className={cx("scroll-mt-20 rounded-[var(--radius-panel)] border bg-raised/80 p-4 sm:p-6", a.pinned ? "border-brass/50" : a.category === "win" ? "border-aurora/40" : "border-line")}
    >
      <div className="flex items-start gap-2">
        <div className="flex flex-1 flex-wrap items-center gap-1.5">
          {a.pinned && (
            <Tag tone="brass">
              <Pin className="size-3" /> Pinned
            </Tag>
          )}
          <Tag tone={a.category === "win" ? "aurora" : "neutral"}>
            <span aria-hidden>{cat.emoji}</span> {cat.label}
          </Tag>
          {a.isNew && <span className="size-2 rounded-full bg-ember" aria-label="New" />}
        </div>
        {a.canEdit && (
          <div className="relative">
            <button onClick={() => setMenu((v) => !v)} aria-label="Post options" aria-expanded={menu} aria-haspopup="menu" className="-mr-2 -mt-2 grid size-11 place-items-center rounded-full text-dim hover:bg-raised-2">
              <MoreHorizontal className="size-5" />
            </button>
            <AnimatePresence>
              {menu && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setMenu(false)} aria-hidden />
                  <motion.div role="menu" initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="absolute right-0 top-full z-20 w-44 rounded-2xl border border-line-strong bg-raised p-1 shadow-2xl">
                    <button role="menuitem" className="flex min-h-11 w-full items-center gap-2 rounded-xl px-3 text-sm hover:bg-raised-2" onClick={() => { setMenu(false); onEdit(); }}>
                      <Pencil className="size-4 text-dim" /> Edit
                    </button>
                    <button role="menuitem" className="flex min-h-11 w-full items-center gap-2 rounded-xl px-3 text-sm hover:bg-raised-2" onClick={togglePin}>
                      {a.pinned ? <PinOff className="size-4 text-dim" /> : <Pin className="size-4 text-dim" />} {a.pinned ? "Unpin" : "Pin to top"}
                    </button>
                    <button role="menuitem" className="flex min-h-11 w-full items-center gap-2 rounded-xl px-3 text-sm text-ember hover:bg-raised-2" onClick={() => { setMenu(false); setConfirmDel(true); }}>
                      <Trash2 className="size-4" /> Delete
                    </button>
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>
        )}
      </div>
      <h2 className="mt-2.5 font-display text-xl font-semibold leading-snug">{a.title}</h2>
      <div className="mt-1.5 flex items-center gap-2 text-sm text-dim">
        {a.author ? (
          <>
            <Avatar name={a.author.name} src={a.author.photoUrl} size={22} />
            <span className="min-w-0 truncate">
              {a.author.name}
              {a.author.teamTitle && <span className="text-faint"> · {a.author.teamTitle}</span>}
            </span>
          </>
        ) : (
          <span>Comskills team</span>
        )}
        <span className="shrink-0 text-faint">
          · {timeAgo(a.createdAt)}
          {a.editedAt && " · edited"}
        </span>
      </div>
      <Linkified text={a.body} className="mt-3 whitespace-pre-line leading-relaxed" />
      {a.link && (
        <a href={a.link} target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex min-h-10 items-center gap-1.5 text-sm font-medium text-brass hover:underline">
          <ExternalLink className="size-4" /> {hostLabel(a.link)}
        </a>
      )}
      {a.pinned && a.pinnedUntil && <p className="mt-2 text-xs text-faint">Pinned until {formatDate(a.pinnedUntil)}</p>}
      {a.canEdit && a.emailedAt && <p className="mt-2 text-xs text-faint">Emailed to {a.emailedCount} member{a.emailedCount === 1 ? "" : "s"}</p>}

      <div className="mt-4 flex flex-wrap items-center gap-1.5 border-t border-line pt-3">
        {REACTIONS.map((e) => {
          const on = mine.includes(e);
          return (
            <motion.button
              key={e}
              whileTap={{ scale: 0.85 }}
              onClick={() => react(e)}
              aria-pressed={on}
              aria-label={`React ${e}${reactions[e] ? `, ${reactions[e]} so far` : ""}`}
              className={cx("inline-flex h-10 min-w-11 items-center justify-center gap-1 rounded-full border px-2.5 text-sm transition-colors sm:h-8", on ? "border-brass bg-brass/15" : "border-line-strong hover:bg-raised-2")}
            >
              <span aria-hidden>{e}</span>
              {reactions[e] > 0 && (
                <motion.span key={reactions[e]} initial={{ y: -6, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="tabular text-xs text-dim">
                  {reactions[e]}
                </motion.span>
              )}
            </motion.button>
          );
        })}
        <ShareButtons compact className="ml-auto" text={announcementShareText(a, url)} url={url} />
      </div>
      <Modal open={confirmDel} onClose={() => setConfirmDel(false)} title="Delete this post?">
        <p className="text-sm text-dim">It disappears for everyone, with its reactions. This can't be undone.</p>
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="quiet" onClick={() => setConfirmDel(false)}>
            Cancel
          </Button>
          <Button variant="danger" loading={busy} onClick={del}>
            Delete
          </Button>
        </div>
      </Modal>
    </motion.li>
  );
}

type Draft = { title: string; body: string; category: AnnouncementCategory; link: string; pinned: boolean; pinnedUntil: string; emailEveryone: boolean; scholarshipId: string | null };
const EMPTY: Draft = { title: "", body: "", category: "programme", link: "", pinned: false, pinnedUntil: "", emailEveryone: false, scholarshipId: null };

function Composer({ state, onClose, onSaved }: { state: { mode: "new" | "edit"; post?: AnnouncementDTO; winId?: string } | null; onClose: () => void; onSaved: () => void }) {
  const [d, setD] = useState<Draft>(EMPTY);
  const [emailTouched, setEmailTouched] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const winKey = state?.winId ? `/api/team/win/${state.winId}` : null;
  const { data: win, error: winErr } = useSWR<{ id: string; memberName: string; programme: string; university: string | null; scholarship: string; announced: boolean }>(winKey);

  useEffect(() => {
    setErr(null);
    setEmailTouched(false);
    if (!state) return;
    if (state.mode === "edit" && state.post) {
      const p = state.post;
      setD({ title: p.title, body: p.body, category: p.category, link: p.link ?? "", pinned: p.pinned, pinnedUntil: p.pinnedUntil ?? "", emailEveryone: false, scholarshipId: null });
    } else setD(EMPTY);
  }, [state]);
  useEffect(() => {
    if (!win) return;
    const where = win.university ? ` at ${win.university}` : "";
    setD({
      ...EMPTY,
      category: "win",
      scholarshipId: win.id,
      title: `🎉 Congratulations to ${win.memberName}!`,
      body: `Congratulations to ${win.memberName}, accepted to ${win.programme}${where} (${win.scholarship})! We're so proud of you. 🎓`,
    });
  }, [win]);

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD((p) => ({ ...p, [k]: v }));
  const setPinned = (v: boolean) => setD((p) => ({ ...p, pinned: v, ...(emailTouched ? {} : { emailEveryone: v }) }));

  async function save() {
    if (d.title.trim().length < 3) return setErr("Add a title.");
    if (d.body.trim().length < 3) return setErr("Write a few words.");
    if (d.link.trim() && !/^https?:\/\/\S+\.\S+/.test(d.link.trim())) return setErr("The link should start with https://");
    setErr(null);
    setBusy(true);
    try {
      const common = { title: d.title, body: d.body, category: d.category, link: d.link.trim() || null, pinned: d.pinned, pinnedUntil: d.pinned && d.pinnedUntil ? d.pinnedUntil : null };
      if (state?.mode === "edit" && state.post) {
        await api(`/api/announcements/${state.post.id}`, "PATCH", common);
        toast.success("Post updated");
      } else {
        const r = await api<{ emailing: boolean }>("/api/announcements", "POST", { ...common, emailEveryone: d.emailEveryone, scholarshipId: d.scholarshipId });
        toast.success(r.emailing ? "Posted. Emails are going out now." : "Posted");
        if (d.category === "win") {
          try {
            const confetti = (await import("canvas-confetti")).default;
            confetti({ particleCount: 100, spread: 80, origin: { y: 0.6 }, disableForReducedMotion: true });
          } catch {}
        }
      }
      globalMutate("/api/notifications");
      onSaved();
      onClose();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Couldn't post. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={Boolean(state)} onClose={onClose} title={state?.mode === "edit" ? "Edit post" : d.scholarshipId ? "Announce a win" : "New post"} wide>
      {state?.winId && winErr && <p className="mb-4 rounded-xl bg-ember/10 px-3 py-2 text-sm text-ember">That win can't be announced (no consent, or it was removed).</p>}
      {win?.announced && <p className="mb-4 rounded-xl bg-brass/10 px-3 py-2 text-sm text-brass">This win was already announced.</p>}
      <div className="space-y-4">
        <div>
          <Label htmlFor="n-title" hint={`${d.title.length}/120`}>
            Title
          </Label>
          <Input id="n-title" maxLength={120} value={d.title} onChange={(e) => set("title", e.target.value)} className="font-display text-lg" />
        </div>
        <div>
          <Label htmlFor="n-body" hint={`${d.body.length}/3000`}>
            Message
          </Label>
          <Textarea id="n-body" rows={7} maxLength={3000} value={d.body} onChange={(e) => set("body", e.target.value)} placeholder="Plain text. Links become clickable." />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="n-cat">Category</Label>
            <select
              id="n-cat"
              value={d.category}
              disabled={Boolean(d.scholarshipId)}
              onChange={(e) => set("category", e.target.value as AnnouncementCategory)}
              className="h-11 w-full rounded-[var(--radius-field)] border border-line-strong bg-night-2 px-3.5 text-star focus:border-brass focus:outline-none"
            >
              {CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.emoji} {c.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label htmlFor="n-link" hint="Optional">
              Link
            </Label>
            <Input id="n-link" type="url" inputMode="url" value={d.link} onChange={(e) => set("link", e.target.value)} placeholder="https://…" />
          </div>
        </div>
        <div className="space-y-4 rounded-2xl border border-line p-4">
          <Toggle checked={d.pinned} onChange={setPinned} label="Pin to the top" description="Pinned posts stay above everything else." />
          {d.pinned && (
            <div className="max-w-56">
              <Label htmlFor="n-until" hint="Optional">
                Pin until
              </Label>
              <Input id="n-until" type="date" value={d.pinnedUntil} onChange={(e) => set("pinnedUntil", e.target.value)} />
            </div>
          )}
          {state?.mode !== "edit" && (
            <Toggle
              checked={d.emailEveryone}
              onChange={(v) => {
                setEmailTouched(true);
                set("emailEveryone", v);
              }}
              label="Email this to everyone"
              description="Counts against the daily Gmail limit. Members who turned these emails off won't get it."
            />
          )}
        </div>
      </div>
      <ErrorText>{err}</ErrorText>
      <div className="mt-6 flex justify-end gap-2">
        <Button variant="quiet" onClick={onClose}>
          Cancel
        </Button>
        <Button loading={busy} onClick={save} disabled={Boolean(win?.announced)}>
          {state?.mode === "edit" ? "Save" : "Post"}
        </Button>
      </div>
    </Modal>
  );
}
