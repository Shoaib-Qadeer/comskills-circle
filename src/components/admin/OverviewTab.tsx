"use client";

import { UserCheck } from "lucide-react";
import { Button, Panel } from "../ui";
import { Meter, Stat, UsageChart, type AdminTab, type Overview } from "./shared";

export function OverviewTab({ data, go }: { data?: Overview; go: (t: AdminTab) => void }) {
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

