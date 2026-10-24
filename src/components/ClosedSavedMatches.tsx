"use client";

import useSWR from "swr";
import type { MatchDTO } from "@/lib/types";
import { formatDate } from "@/lib/client";
import { LinkButton } from "./ui";
import { ExternalLink } from "lucide-react";

/** Saved matches whose deadline has passed — kept so nobody loses track of what they bookmarked. */
export function ClosedSavedMatches() {
  const { data } = useSWR<{ items: MatchDTO[] }>("/api/matches?filter=closed");
  if (!data?.items.length) return null;
  return (
    <section className="mt-14">
      <h2 className="font-display text-xl font-semibold">Your saved matches that closed</h2>
      <p className="mt-1 text-sm text-dim">Worth a look next year: many programmes open again on a similar schedule.</p>
      <ul className="mt-5 divide-y divide-line rounded-[var(--radius-panel)] border border-line bg-raised/60">
        {data.items.map((m) => (
          <li key={m.id} className="flex flex-wrap items-center gap-3 px-5 py-4">
            <div className="min-w-0 flex-1">
              <p className="font-medium">{m.opportunity.title}</p>
              <p className="text-sm text-dim">
                {[m.opportunity.organization, m.opportunity.deadline && `closed ${formatDate(m.opportunity.deadline)}`].filter(Boolean).join(", ")}
              </p>
            </div>
            {m.opportunity.url && (
              <LinkButton href={m.opportunity.url} external size="sm">
                <ExternalLink className="size-3.5" /> Posting
              </LinkButton>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
