"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import useSWR, { mutate as globalMutate } from "swr";
import { AnimatePresence, motion } from "motion/react";
import { toast } from "sonner";
import { Bell, Check, CheckCheck, Inbox, UserPlus, X } from "lucide-react";
import type { ConnectRequestDTO, NotificationDTO } from "@/lib/types";
import { api, firstName, timeAgo } from "@/lib/client";
import { Avatar, Button, EmptyState, PageHeader, Segmented, Skeleton, cx } from "./ui";

type Tab = "updates" | "requests";

export function InboxView() {
  const params = useSearchParams();
  const router = useRouter();
  const [tab, setTab] = useState<Tab>(params.get("tab") === "requests" ? "requests" : "updates");
  const { data: notes, mutate: mutateNotes, error: notesErr } = useSWR<{ items: NotificationDTO[] }>("/api/notifications?list=1");
  const { data: reqs, mutate: mutateReqs, error: reqErr } = useSWR<{ items: ConnectRequestDTO[] }>("/api/connect");
  const incoming = (reqs?.items ?? []).filter((r) => r.direction === "incoming" && r.status === "pending");
  const unread = (notes?.items ?? []).filter((n) => !n.read).length;

  function switchTab(t: Tab) {
    setTab(t);
    router.replace(t === "requests" ? "/inbox?tab=requests" : "/inbox", { scroll: false });
  }

  async function markAll() {
    mutateNotes((d) => (d ? { items: d.items.map((n) => ({ ...n, read: true })) } : d), { revalidate: false });
    await api("/api/notifications/read", "POST", { all: true }).catch(() => null);
    globalMutate("/api/notifications");
  }

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="Inbox"
        subtitle="Updates about your projects, connect requests and more."
        action={
          tab === "updates" && unread > 0 ? (
            <Button variant="ghost" onClick={markAll}>
              <CheckCheck className="size-4" /> Mark all read
            </Button>
          ) : undefined
        }
      />
      <Segmented
        id="inbox-tab"
        value={tab}
        onChange={switchTab}
        className="mb-6"
        options={[
          { value: "updates", label: "Updates", count: unread },
          { value: "requests", label: "Connect requests", count: incoming.length },
        ]}
      />
      {tab === "updates" ? (
        <Updates items={notes?.items} error={Boolean(notesErr)} onRead={() => mutateNotes()} />
      ) : (
        <Requests items={reqs?.items} error={Boolean(reqErr)} onChange={() => mutateReqs()} />
      )}
    </div>
  );
}

function Updates({ items, error, onRead }: { items?: NotificationDTO[]; error: boolean; onRead: () => void }) {
  // Opening the inbox marks what's shown as read after a moment (the badge clears)
  useEffect(() => {
    const unread = (items ?? []).filter((n) => !n.read).map((n) => n.id);
    if (!unread.length) return;
    const t = setTimeout(async () => {
      await api("/api/notifications/read", "POST", { ids: unread.slice(0, 200) }).catch(() => null);
      globalMutate("/api/notifications");
      onRead();
    }, 2500);
    return () => clearTimeout(t);
  }, [items, onRead]);

  if (error && !items) return <p className="rounded-2xl border border-ember/40 p-5 text-ember">Couldn't load your updates. Check your connection and refresh.</p>;
  if (!items) return <Skeleton className="h-64 rounded-[var(--radius-panel)]" />;
  if (!items.length)
    return (
      <EmptyState icon={<Bell className="size-10" />} title="Nothing yet">
        When someone is interested in your project, invites you, or asks to connect, it shows up here.
      </EmptyState>
    );
  return (
    <ul className="divide-y divide-line overflow-hidden rounded-[var(--radius-panel)] border border-line bg-raised/70">
      {items.map((n) => (
        <li key={n.id}>
          <Link href={n.href || "/"} className={cx("flex items-start gap-3 px-4 py-3.5 hover:bg-raised-2", !n.read && "bg-brass/[0.05]")}>
            <span className={cx("mt-2 size-2 shrink-0 rounded-full", n.read ? "bg-transparent" : "bg-brass")} aria-hidden />
            <span className="min-w-0 flex-1">
              <span className="block leading-snug">{n.text}</span>
              <span className="mt-0.5 block text-xs text-faint">
                {timeAgo(n.createdAt)}
                {!n.read && <span className="sr-only"> (unread)</span>}
              </span>
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

function Requests({ items, error, onChange }: { items?: ConnectRequestDTO[]; error: boolean; onChange: () => void }) {
  const [busy, setBusy] = useState<string | null>(null);
  if (error && !items) return <p className="rounded-2xl border border-ember/40 p-5 text-ember">Couldn't load requests. Check your connection and refresh.</p>;
  if (!items) return <Skeleton className="h-64 rounded-[var(--radius-panel)]" />;
  const incoming = items.filter((r) => r.direction === "incoming" && r.status === "pending");
  const outgoing = items.filter((r) => r.direction === "outgoing" && r.status === "pending");
  const past = items.filter((r) => r.status !== "pending").slice(0, 30);

  async function act(r: ConnectRequestDTO, action: "accepted" | "declined" | "withdraw") {
    setBusy(r.id + action);
    try {
      if (action === "withdraw") await api(`/api/connect/${r.id}`, "DELETE");
      else await api(`/api/connect/${r.id}`, "PATCH", { status: action });
      toast.success(action === "accepted" ? `You're connected with ${firstName(r.other?.name ?? "them")}` : action === "declined" ? "Declined" : "Withdrawn");
      onChange();
      globalMutate("/api/notifications");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Something went wrong. Try again.");
    } finally {
      setBusy(null);
    }
  }

  if (!incoming.length && !outgoing.length && !past.length)
    return (
      <EmptyState icon={<UserPlus className="size-10" />} title="No connect requests" action={<Link href="/members" className="inline-flex h-11 items-center rounded-full bg-brass px-5 font-medium text-brass-ink">Browse members</Link>}>
        Connect with someone to see each other's WhatsApp and email.
      </EmptyState>
    );

  return (
    <div className="space-y-8">
      {incoming.length > 0 && (
        <section>
          <h2 className="mb-3 font-display text-lg font-semibold">Waiting for you</h2>
          <ul className="space-y-3">
            <AnimatePresence initial={false}>
              {incoming.map((r) => (
                <motion.li key={r.id} layout exit={{ opacity: 0, x: 40 }} className="rounded-2xl border border-brass/40 bg-brass/[0.06] p-4">
                  <div className="flex items-start gap-3">
                    <Avatar name={r.other?.name ?? "?"} src={r.other?.photoUrl} size={44} />
                    <div className="min-w-0 flex-1">
                      <Link href={r.other ? `/members/${r.other.id}` : "#"} className="font-medium hover:text-brass">
                        {r.other?.name ?? "A former member"}
                      </Link>
                      <p className="text-xs text-faint">{timeAgo(r.createdAt)}</p>
                      {r.message && <p className="mt-2 text-sm italic text-dim">“{r.message}”</p>}
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button loading={busy === r.id + "accepted"} onClick={() => act(r, "accepted")}>
                      <Check className="size-4" /> Accept
                    </Button>
                    <Button variant="ghost" loading={busy === r.id + "declined"} onClick={() => act(r, "declined")}>
                      <X className="size-4" /> Decline
                    </Button>
                  </div>
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>
        </section>
      )}
      {outgoing.length > 0 && (
        <section>
          <h2 className="mb-3 font-display text-lg font-semibold">You asked</h2>
          <ul className="divide-y divide-line rounded-2xl border border-line bg-raised/70">
            {outgoing.map((r) => (
              <li key={r.id} className="flex items-center gap-3 px-4 py-3">
                <Avatar name={r.other?.name ?? "?"} src={r.other?.photoUrl} size={36} />
                <span className="min-w-0 flex-1 truncate">{r.other?.name ?? "A former member"}</span>
                <Button variant="quiet" size="sm" loading={busy === r.id + "withdraw"} onClick={() => act(r, "withdraw")}>
                  Withdraw
                </Button>
              </li>
            ))}
          </ul>
        </section>
      )}
      {past.length > 0 && (
        <section>
          <h2 className="mb-3 font-display text-lg font-semibold">Earlier</h2>
          <ul className="divide-y divide-line rounded-2xl border border-line bg-raised/70">
            {past.map((r) => (
              <li key={r.id} className="flex items-center gap-3 px-4 py-3 text-sm">
                <Avatar name={r.other?.name ?? "?"} src={r.other?.photoUrl} size={32} />
                <span className="min-w-0 flex-1">
                  {r.other ? (
                    <Link href={`/members/${r.other.id}`} className="font-medium hover:text-brass">
                      {r.other.name}
                    </Link>
                  ) : (
                    "A former member"
                  )}
                  <span className="text-faint">
                    {" "}
                    · {r.status === "accepted" ? "connected" : r.direction === "incoming" ? "you declined" : "not accepted"}
                  </span>
                </span>
                <span className="text-xs text-faint">{timeAgo(r.decidedAt ?? r.createdAt)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
      <p className="flex items-center gap-2 text-xs text-faint">
        <Inbox className="size-3.5" /> Connected people see each other's WhatsApp and email on their profiles.
      </p>
    </div>
  );
}
