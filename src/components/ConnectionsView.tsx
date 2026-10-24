"use client";

import { useEffect, useMemo, useState } from "react";
import useSWR, { mutate as globalMutate } from "swr";
import { AnimatePresence, motion } from "motion/react";
import { toast } from "sonner";
import { Inbox, Network, UserPlus } from "lucide-react";
import type { ConnectionDTO, IntroRequestDTO, IntroStatus } from "@/lib/types";
import { FIELDS } from "@/lib/taxonomy";
import { api, firstName, timeAgo } from "@/lib/client";
import { Avatar, Button, EmptyState, FieldChip, PageHeader, Segmented, Skeleton, Tag } from "./ui";
import { ConnectionCard, ConnectionFormModal, RequestIntroModal } from "./ConnectionParts";

export function ConnectionsView() {
  const [tab, setTab] = useState<"network" | "requests">("network");
  const [field, setField] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<ConnectionDTO | null>(null);
  const [intro, setIntro] = useState<ConnectionDTO | null>(null);
  const { data, mutate, isLoading } = useSWR<{ items: ConnectionDTO[] }>(`/api/connections${field ? `?field=${field}` : ""}`, { keepPreviousData: true });
  const { data: suggested } = useSWR<{ items: ConnectionDTO[] }>("/api/connections/suggested");
  const { data: incoming, mutate: mutIn } = useSWR<{ items: IntroRequestDTO[] }>("/api/intro-requests?box=incoming");
  const { data: outgoing, mutate: mutOut } = useSWR<{ items: IntroRequestDTO[] }>("/api/intro-requests?box=outgoing");
  const pendingIn = incoming?.items.filter((r) => r.status === "pending").length ?? 0;
  // Only offer field filters that someone in the network actually has
  const [seenFields, setSeenFields] = useState<Set<string>>(new Set());
  useEffect(() => {
    if (!data) return;
    setSeenFields((prev) => {
      const next = new Set(prev);
      data.items.forEach((c) => c.fields.forEach((f) => next.add(f)));
      return next.size === prev.size ? prev : next;
    });
  }, [data]);
  const usedFields = useMemo(() => FIELDS.filter((f) => seenFields.has(f.slug) || f.slug === field), [seenFields, field]);

  const refresh = () => {
    mutate();
    globalMutate("/api/connections/suggested");
  };

  return (
    <div>
      <PageHeader
        title="Connections"
        subtitle="People your classmates know, shared so anyone can ask for a warm introduction."
        action={
          <Button onClick={() => setAdding(true)}>
            <UserPlus className="size-4" /> Add someone you know
          </Button>
        }
      />
      <Segmented
        id="conn-tab"
        value={tab}
        onChange={setTab}
        className="mb-6"
        options={[
          { value: "network", label: "Class network", count: data?.items.length },
          { value: "requests", label: "Intro requests", count: pendingIn },
        ]}
      />

      <AnimatePresence mode="wait">
        {tab === "network" ? (
          <motion.div key="net" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            {!field && suggested && suggested.items.length > 0 && (
              <section className="mb-10">
                <h2 className="mb-4 font-display text-lg font-semibold">Relevant to you</h2>
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {suggested.items.slice(0, 3).map((c, i) => (
                    <ConnectionCard key={c.id} c={c} index={i} onRequest={setIntro} />
                  ))}
                </div>
              </section>
            )}
            <div className="-mx-4 mb-5 flex gap-1.5 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:px-0">
              {usedFields.map((f) => (
                <FieldChip key={f.slug} slug={f.slug} size="sm" selected={field === f.slug} onClick={() => setField(field === f.slug ? null : f.slug)} />
              ))}
            </div>
            {isLoading && !data ? (
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {[0, 1, 2].map((i) => (
                  <Skeleton key={i} className="h-48 rounded-[var(--radius-panel)]" />
                ))}
              </div>
            ) : !data?.items.length ? (
              <EmptyState
                icon={<Network className="size-10" />}
                title={field ? "No one in this field yet" : "The class network is empty"}
                action={
                  <Button onClick={() => setAdding(true)}>
                    <UserPlus className="size-4" /> Add someone you know
                  </Button>
                }
              >
                A former supervisor, a researcher you met at a talk, an alum at a startup — one public profile link can open a door for a classmate.
              </EmptyState>
            ) : (
              <motion.div layout className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                <AnimatePresence mode="popLayout">
                  {data.items.map((c, i) => (
                    <ConnectionCard key={c.id} c={c} index={i} onRequest={setIntro} onEdit={setEditing} onDeleted={refresh} />
                  ))}
                </AnimatePresence>
              </motion.div>
            )}
          </motion.div>
        ) : (
          <motion.div key="req" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="grid gap-10 lg:grid-cols-2">
            <RequestList
              title="Asked of you"
              empty="When a classmate asks you for an introduction, it appears here."
              items={incoming?.items}
              incoming
              onChanged={() => {
                mutIn();
                globalMutate("/api/notifications");
              }}
            />
            <RequestList title="You asked" empty="Requests you send appear here so you can follow up." items={outgoing?.items} onChanged={() => mutOut()} />
          </motion.div>
        )}
      </AnimatePresence>

      <ConnectionFormModal open={adding || Boolean(editing)} editing={editing} onClose={() => { setAdding(false); setEditing(null); }} onSaved={refresh} />
      <RequestIntroModal c={intro} onClose={() => setIntro(null)} onSent={() => mutOut()} />
    </div>
  );
}

const STATUS_TONE: Record<IntroStatus, "brass" | "aurora" | "neutral" | "violet"> = { pending: "brass", accepted: "aurora", declined: "neutral", done: "violet" };
const STATUS_LABEL: Record<IntroStatus, string> = { pending: "Waiting", accepted: "Accepted", declined: "Declined", done: "Introduced" };

function RequestList({ title, empty, items, incoming, onChanged }: { title: string; empty: string; items?: IntroRequestDTO[]; incoming?: boolean; onChanged: () => void }) {
  async function setStatus(r: IntroRequestDTO, status: "accepted" | "declined" | "done") {
    try {
      await api(`/api/intro-requests/${r.id}`, "PATCH", { status });
      toast.success(status === "done" ? "Marked as introduced" : status === "accepted" ? "Accepted — now make the intro" : "Declined");
      onChanged();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not update");
    }
  }
  async function withdraw(r: IntroRequestDTO) {
    await api(`/api/intro-requests/${r.id}`, "DELETE").catch(() => null);
    onChanged();
  }
  return (
    <section>
      <h2 className="mb-4 font-display text-lg font-semibold">{title}</h2>
      {!items ? (
        <Skeleton className="h-32 rounded-[var(--radius-panel)]" />
      ) : items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-line-strong p-6 text-center text-sm text-dim">
          <Inbox className="mx-auto mb-2 size-6 text-faint" />
          {empty}
        </div>
      ) : (
        <ul className="space-y-3">
          {items.map((r) => (
            <motion.li layout key={r.id} className="rounded-2xl border border-line bg-raised/80 p-4">
              <div className="flex items-start gap-3">
                {incoming && r.requester ? <Avatar name={r.requester.name} src={r.requester.photoUrl} size={36} /> : <Avatar name={r.connection?.name || "?"} size={36} />}
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm">
                      {incoming ? (
                        <>
                          <span className="font-medium">{r.requester ? firstName(r.requester.name) : "A classmate"}</span> wants to meet <span className="font-medium">{r.connection?.name ?? "a removed contact"}</span>
                        </>
                      ) : (
                        <>
                          Intro to <span className="font-medium">{r.connection?.name ?? "a removed contact"}</span> via {r.owner ? firstName(r.owner.name) : "a classmate"}
                        </>
                      )}
                    </p>
                    <motion.span key={r.status} initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
                      <Tag tone={STATUS_TONE[r.status]}>{STATUS_LABEL[r.status]}</Tag>
                    </motion.span>
                  </div>
                  <p className="mt-2 whitespace-pre-line text-sm text-dim">{r.message}</p>
                  <p className="mt-2 text-xs text-faint">{timeAgo(r.createdAt)}</p>
                  {incoming && r.status !== "done" && r.status !== "declined" && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {r.status === "pending" && (
                        <Button size="sm" variant="ghost" onClick={() => setStatus(r, "accepted")}>
                          Accept
                        </Button>
                      )}
                      <Button size="sm" onClick={() => setStatus(r, "done")}>
                        Mark introduced
                      </Button>
                      {r.status === "pending" && (
                        <Button size="sm" variant="quiet" onClick={() => setStatus(r, "declined")}>
                          Decline
                        </Button>
                      )}
                    </div>
                  )}
                  {!incoming && r.status === "pending" && (
                    <Button size="sm" variant="quiet" className="mt-2 -ml-3" onClick={() => withdraw(r)}>
                      Withdraw
                    </Button>
                  )}
                </div>
              </div>
            </motion.li>
          ))}
        </ul>
      )}
    </section>
  );
}
