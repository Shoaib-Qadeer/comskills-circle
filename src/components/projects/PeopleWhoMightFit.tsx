"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import useSWR from "swr";
import { AnimatePresence, motion } from "motion/react";
import { toast } from "sonner";
import { Check, Send, Sparkles } from "lucide-react";
import type { SuggestedPersonDTO } from "@/lib/types";
import { api, firstName } from "@/lib/client";
import { ScoreRing } from "../bits";
import { Avatar, Button, Skeleton, Tag } from "../ui";

/**
 * The proposer's "People who might fit". Matching runs right after posting, so for a new project
 * this polls for a little while until suggestions arrive.
 */
export function PeopleWhoMightFit({ proposalId, fresh = false }: { proposalId: string; fresh?: boolean }) {
  const [polls, setPolls] = useState(0);
  const started = useRef(Date.now());
  const { data, mutate, error } = useSWR<{ items: SuggestedPersonDTO[]; matchCount: number }>(`/api/proposals/${proposalId}/suggested`, {
    refreshInterval: (latest) => (fresh && (!latest || latest.items.length === 0) && Date.now() - started.current < 45_000 ? 4000 : 0),
    onSuccess: () => setPolls((n) => n + 1),
  });
  const [inviting, setInviting] = useState<string | null>(null);
  const waiting = fresh && (!data || data.items.length === 0) && Date.now() - started.current < 45_000;

  useEffect(() => {
    // keep "waiting" honest after the polling window ends
    const t = setTimeout(() => setPolls((n) => n + 1), 46_000);
    return () => clearTimeout(t);
  }, []);

  async function invite(s: SuggestedPersonDTO) {
    setInviting(s.member.id);
    try {
      await api(`/api/proposals/${proposalId}/invite`, "POST", { userId: s.member.id });
      toast.success(`Invited ${firstName(s.member.name)}. They'll get a notification.`);
      mutate();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't invite. Try again.");
    } finally {
      setInviting(null);
    }
  }

  return (
    <section aria-labelledby="fit-h">
      <h2 id="fit-h" className="flex items-center gap-2 font-display text-lg font-semibold">
        <Sparkles className="size-5 text-brass" /> People who might fit
      </h2>
      <p className="mt-1 text-sm text-dim">Matched from their skills and goals. Invite the ones you like, they'll see it straight away.</p>
      <div className="mt-4" aria-live="polite" data-polls={polls}>
        {error && !data ? (
          <p className="text-sm text-ember">Couldn't load suggestions. Refresh the page to try again.</p>
        ) : !data || waiting ? (
          <div className="space-y-2">
            <p className="flex items-center gap-2 text-sm text-brass">
              <span className="size-3 animate-ping rounded-full bg-brass" /> Finding people who fit…
            </p>
            <Skeleton className="h-16" />
            <Skeleton className="h-16" />
          </div>
        ) : data.items.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-line-strong p-4 text-sm text-dim">
            No strong matches yet. As new members join, they're matched automatically. You can also share the project on WhatsApp.
          </p>
        ) : (
          <ul className="space-y-2">
            <AnimatePresence initial={false}>
              {data.items.map((s, i) => (
                <motion.li
                  key={s.member.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0, transition: { delay: i * 0.05 } }}
                  className="flex items-center gap-3 rounded-2xl border border-line bg-night-2/60 p-3"
                >
                  <Link href={`/members/${s.member.id}`} className="shrink-0">
                    <Avatar name={s.member.name} src={s.member.photoUrl} size={40} />
                  </Link>
                  <div className="min-w-0 flex-1">
                    <Link href={`/members/${s.member.id}`} className="font-medium hover:text-brass">
                      {s.member.name}
                    </Link>
                    <p className="text-sm leading-snug text-dim">
                      {s.reason}
                      {s.basic && <span className="ml-1 text-xs text-faint">(basic match)</span>}
                    </p>
                  </div>
                  <div className="hidden sm:block">
                    <ScoreRing score={s.score} size={40} />
                  </div>
                  {s.invited ? (
                    <Tag tone="aurora">
                      <Check className="size-3" /> Invited
                    </Tag>
                  ) : (
                    <Button size="sm" variant="ghost" loading={inviting === s.member.id} onClick={() => invite(s)}>
                      <Send className="size-3.5" /> Invite
                    </Button>
                  )}
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>
        )}
      </div>
    </section>
  );
}
