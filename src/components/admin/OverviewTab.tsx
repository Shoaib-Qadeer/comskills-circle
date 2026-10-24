"use client";

import { Flag, MailWarning, UserCheck } from "lucide-react";
import { Button, Panel } from "../ui";
import { Meter, Stat, UsageChart, type AdminTab, type Overview } from "./shared";

const mb = (b: number) => Math.round((b / (1024 * 1024)) * 10) / 10;

function Breakdown({ title, rows }: { title: string; rows: { label: string; value: number }[] }) {
  const total = rows.reduce((n, r) => n + r.value, 0);
  return (
    <Panel className="p-5">
      <h3 className="font-medium">{title}</h3>
      <ul className="mt-3 space-y-2 text-sm">
        {rows.map((r) => (
          <li key={r.label} className="flex items-center gap-3">
            <span className="w-28 shrink-0 text-dim">{r.label}</span>
            <span className="h-2 flex-1 overflow-hidden rounded-full bg-night-2">
              <span className="block h-full rounded-full bg-brass/80" style={{ width: `${total ? (r.value / total) * 100 : 0}%` }} />
            </span>
            <span className="tabular w-8 text-right">{r.value}</span>
          </li>
        ))}
      </ul>
    </Panel>
  );
}

export function OverviewTab({ data, go }: { data?: Overview; go: (t: AdminTab) => void }) {
  const today = data?.ai.usage.at(-1);
  const tokensToday = today ? today.inputTokens + today.outputTokens : 0;
  const p = data?.proposalsByStatus ?? {};
  const s = data?.scholarshipsByStage ?? {};
  return (
    <div className="space-y-8">
      {data && data.counts.pending > 0 && (
        <button onClick={() => go("people")} className="flex min-h-11 w-full items-center gap-3 rounded-2xl border border-brass/40 bg-brass/[0.08] p-4 text-left">
          <UserCheck className="size-5 shrink-0 text-brass" />
          <span className="flex-1">
            <span className="font-medium">
              {data.counts.pending} {data.counts.pending === 1 ? "person is" : "people are"} waiting for approval.
            </span>{" "}
            <span className="text-dim">Review them in People.</span>
          </span>
        </button>
      )}
      {data && data.counts.openReports > 0 && (
        <button onClick={() => go("content")} className="flex min-h-11 w-full items-center gap-3 rounded-2xl border border-ember/40 bg-ember/[0.08] p-4 text-left">
          <Flag className="size-5 shrink-0 text-ember" />
          <span className="flex-1">
            <span className="font-medium">
              {data.counts.openReports} report{data.counts.openReports === 1 ? "" : "s"} to look at.
            </span>{" "}
            <span className="text-dim">Open Content → Reports.</span>
          </span>
        </button>
      )}
      {data && !data.email.configured && (
        <button onClick={() => go("email")} className="flex min-h-11 w-full items-center gap-3 rounded-2xl border border-ember/40 bg-ember/[0.08] p-4 text-left">
          <MailWarning className="size-5 shrink-0 text-ember" />
          <span className="flex-1">
            <span className="font-medium">Gmail isn&rsquo;t set up, so no emails (including sign-up codes) are being sent.</span>{" "}
            <span className="text-dim">See the Email tab.</span>
          </span>
        </button>
      )}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="waiting for approval" value={data?.counts.pending} tone={data?.counts.pending ? "brass" : undefined} onClick={() => go("people")} />
        <Stat label="active members" value={data?.counts.onboarded} onClick={() => go("people")} />
        <Stat label="on the team" value={data?.counts.team} />
        <Stat label="seen this week" value={data?.counts.active7} />
        <Stat label="open opportunities" value={data?.counts.open} tone="aurora" onClick={() => go("content")} />
        <Stat label="archived opportunities" value={data?.counts.archived} onClick={() => go("content")} />
        <Stat label="news posts" value={data?.counts.announcements} onClick={() => go("content")} />
        <Stat label="matches" value={data?.counts.matches} />
      </div>

      {data && (
        <div className="grid gap-4 md:grid-cols-2">
          <Breakdown
            title="Projects by status"
            rows={[
              { label: "Open", value: p.open ?? 0 },
              { label: "Team forming", value: p.team_forming ?? 0 },
              { label: "In progress", value: p.in_progress ?? 0 },
              { label: "Completed", value: p.completed ?? 0 },
            ]}
          />
          <Breakdown
            title="Scholarship entries by stage"
            rows={[
              { label: "Applying", value: s.applying ?? 0 },
              { label: "Applied", value: s.applied ?? 0 },
              { label: "Rejected", value: s.rejected ?? 0 },
              { label: "Accepted", value: s.accepted ?? 0 },
            ]}
          />
        </div>
      )}

      <Panel className="p-5 sm:p-6">
        <h2 className="font-display text-lg font-semibold">Free-tier budgets today</h2>
        <p className="mt-1 text-sm text-dim">Comskills Circle is built to run for €0. These are the limits that matter.</p>
        {data && (
          <div className="mt-5 grid gap-5 sm:grid-cols-2">
            <Meter label={`Emails sent (normal mail stops at ${data.email.normalCap}; the rest is kept for sign-up codes)`} used={data.email.sent} limit={data.email.dailyLimit} />
            <Meter label="AI calls (Gemini free tier allows 500 a day)" used={today?.calls ?? 0} limit={data.ai.dailyCallLimit} />
            <Meter label="AI tokens" used={tokensToday} limit={data.ai.dailyTokenLimit} />
            {data.storage.usedBytes !== null && <Meter label="Database storage, MB (Atlas M0 has 512 MB)" used={mb(data.storage.usedBytes)} limit={mb(data.storage.limitBytes)} />}
          </div>
        )}
        {data && (
          <ul className="mt-5 space-y-1 text-sm text-dim">
            <li>• Gmail: about {data.budgets.gmailPerDay} emails a day from a normal account. The app&rsquo;s own cap is {data.email.dailyLimit}.</li>
            <li>
              • Gemini free tier: {data.budgets.gemini.rpm} requests a minute, {data.budgets.gemini.tpm.toLocaleString("en-GB")} tokens a minute, {data.budgets.gemini.rpd} requests a day.
            </li>
            <li>• {data.budgets.vercel}.</li>
            <li>• Photos stored: {data.counts.photos} (each 40 KB or less).</li>
          </ul>
        )}
      </Panel>

      <Panel className="p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-display text-lg font-semibold">AI usage</h2>
            <p className="text-sm text-dim">
              {data ? `${data.ai.provider}, ${data.ai.model || "no model set"}` : "…"}
              {data && !data.ai.enabled && <span className="text-ember"> (switched off)</span>}
              {data && !data.ai.keyConfigured && <span className="text-ember"> (no API key, so basic matching only)</span>}
            </p>
          </div>
          <Button variant="ghost" size="sm" onClick={() => go("ai")}>
            AI settings
          </Button>
        </div>
        {data && <UsageChart usage={data.ai.usage} />}
      </Panel>
    </div>
  );
}
