"use client";

import { useState } from "react";
import useSWR from "swr";
import { toast } from "sonner";
import { CheckCircle2, CircleAlert, Eye, Send } from "lucide-react";
import type { AppSettings } from "@/lib/settings";
import type { CronReport } from "@/lib/cron";
import { api, fetcher, timeAgo } from "@/lib/client";
import { Button, Panel, Skeleton, Tag, Toggle, cx } from "../ui";
import { Meter, NumberField, SaveBar, useSettingsDraft } from "./shared";

type EmailStatus = {
  configured: boolean;
  from: string | null;
  cronSecretSet: boolean;
  usage: { sent: number; dailyLimit: number; normalCap: number };
  log: { at: string; kind: string; ok: boolean; error: string | null; hasUser: boolean }[];
  lastCron: CronReport | null;
};

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const INSTANT: { key: keyof AppSettings["email"]["instant"]; label: string; description: string }[] = [
  { key: "interest", label: "Someone is interested in your project", description: "To the proposer." },
  { key: "teamUpdates", label: "Team updates", description: "Accepted to a team, project status changes." },
  { key: "invites", label: "Project invites", description: "When a proposer invites someone." },
  { key: "connect", label: "Connect requests", description: "Received and accepted." },
  { key: "pinned", label: "Pinned announcements", description: "Only when the author ticks “Email this to everyone”." },
];

export function EmailTab() {
  const { data, mutate } = useSWR<EmailStatus>("/api/admin/email");
  const { draft, setDraft, dirty, save, saving, reset } = useSettingsDraft();
  const [testing, setTesting] = useState(false);
  const [dry, setDry] = useState<CronReport | null>(null);
  const [dryBusy, setDryBusy] = useState(false);

  async function sendTest() {
    setTesting(true);
    try {
      const r = await api<{ to: string }>("/api/admin/email", "POST", { action: "test" });
      toast.success(`Test email sent to ${r.to}. Check the inbox (and spam).`);
      mutate();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't send.");
    } finally {
      setTesting(false);
    }
  }
  async function dryRun() {
    setDryBusy(true);
    try {
      setDry(await fetcher<CronReport>("/api/cron/digest?dryRun=1"));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Dry run failed.");
    } finally {
      setDryBusy(false);
    }
  }

  if (!draft) return <Skeleton className="h-96 rounded-[var(--radius-panel)]" />;
  const email = draft.email;
  const setEmail = (patch: Partial<AppSettings["email"]>) => setDraft({ ...draft, email: { ...email, ...patch } });

  return (
    <div className="space-y-6">
      <Panel className="p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-display text-lg font-semibold">Gmail</h2>
            {data ? (
              data.configured ? (
                <p className="mt-1 flex items-center gap-2 text-sm text-aurora">
                  <CheckCircle2 className="size-4" /> Sending as {data.from}
                </p>
              ) : (
                <p className="mt-1 flex items-start gap-2 text-sm text-ember">
                  <CircleAlert className="mt-0.5 size-4 shrink-0" /> Not set up. Add GMAIL_USER and GMAIL_APP_PASSWORD in Vercel, then redeploy. Until then no emails go out, not even sign-up codes.
                </p>
              )
            ) : (
              <Skeleton className="mt-2 h-5 w-48" />
            )}
          </div>
          <Button variant="ghost" loading={testing} onClick={sendTest} disabled={!data?.configured}>
            <Send className="size-4" /> Send me a test
          </Button>
        </div>
        {data && (
          <div className="mt-5">
            <Meter label="Sent today" used={data.usage.sent} limit={data.usage.dailyLimit} />
            <p className="mt-2 text-xs text-faint">
              Digests and notifications stop at {data.usage.normalCap}; the last {data.usage.dailyLimit - data.usage.normalCap} are kept for sign-up and password codes.
            </p>
          </div>
        )}
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <NumberField id="e-limit" label="Daily email limit" hint="Gmail allows about 500" value={email.dailyLimit} min={0} max={2000} onChange={(v) => setEmail({ dailyLimit: v })} />
          <NumberField id="e-reserve" label="Kept for codes" hint="part of the limit" value={email.reserveForCodes} min={0} max={500} onChange={(v) => setEmail({ reserveForCodes: v })} />
        </div>
      </Panel>

      <Panel className="space-y-5 p-5 sm:p-6">
        <h2 className="font-display text-lg font-semibold">Digest and reminders</h2>
        <Toggle checked={email.digestEnabled} onChange={(v) => setEmail({ digestEnabled: v })} label="Send the digest" description="One summary email with new projects, opportunities, news and deadlines. Members choose weekly, daily or off." />
        <div>
          <label htmlFor="e-weekday" className="mb-1.5 block text-sm font-medium">
            Weekly digest day
          </label>
          <select
            id="e-weekday"
            value={email.digestWeekday}
            onChange={(e) => setEmail({ digestWeekday: Number(e.target.value) })}
            className="h-11 w-full max-w-60 rounded-[var(--radius-field)] border border-line-strong bg-night-2 px-3 text-star focus:border-brass focus:outline-none"
          >
            {WEEKDAYS.map((d, i) => (
              <option key={d} value={i}>
                {d}
              </option>
            ))}
          </select>
          <p className="mt-1.5 text-xs text-faint">Sent at about 09:00 Pakistan time by the daily job.</p>
        </div>
        <Toggle checked={email.monthlyNudge} onChange={(v) => setEmail({ monthlyNudge: v })} label="Monthly nudge" description="On the 1st of each month, ask members to update their scholarship tracker." />
        <Toggle checked={email.newSignupAlert} onChange={(v) => setEmail({ newSignupAlert: v })} label="Email admins about new sign-ups" description="When someone verifies their email and is waiting for approval." />
      </Panel>

      <Panel className="space-y-5 p-5 sm:p-6">
        <div>
          <h2 className="font-display text-lg font-semibold">Instant emails</h2>
          <p className="mt-1 text-sm text-dim">Switch a kind off here and nobody gets it by email (it still shows in the app). Members can also turn each one off for themselves.</p>
        </div>
        {INSTANT.map((k) => (
          <Toggle key={k.key} checked={email.instant[k.key]} onChange={(v) => setEmail({ instant: { ...email.instant, [k.key]: v } })} label={k.label} description={k.description} />
        ))}
      </Panel>

      <Panel className="p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-display text-lg font-semibold">Daily job</h2>
            <p className="mt-1 text-sm text-dim">
              {data?.lastCron ? `Last ran ${timeAgo(data.lastCron.day + "T04:00:00Z")}: ${data.lastCron.digests.sent} digests, ${data.lastCron.reminders.sent} reminders${data.lastCron.stoppedBy ? `, stopped early (${data.lastCron.stoppedBy})` : ""}.` : "Hasn't run yet. Vercel runs it once a day after you deploy."}
            </p>
            {data && !data.cronSecretSet && <p className="mt-1 text-sm text-ember">CRON_SECRET isn&rsquo;t set, so Vercel can&rsquo;t start the daily job.</p>}
          </div>
          <Button variant="ghost" loading={dryBusy} onClick={dryRun}>
            <Eye className="size-4" /> Preview today&rsquo;s run
          </Button>
        </div>
        {dry && (
          <div className="mt-5 rounded-2xl bg-night-2 p-4 text-sm">
            <p>
              Would send <b>{dry.digests.due - dry.digests.empty}</b> digest{dry.digests.due - dry.digests.empty === 1 ? "" : "s"} ({dry.digests.empty} skipped, nothing new) and <b>{dry.reminders.sent}</b> deadline reminder{dry.reminders.sent === 1 ? "" : "s"}
              {dry.nudge.ran ? ", plus the monthly nudge" : ""}. Nothing was sent.
            </p>
            {dry.digests.preview.length > 0 && (
              <ul className="mt-3 space-y-1 text-dim">
                {dry.digests.preview.map((p, i) => (
                  <li key={i}>
                    <span className="text-star">{p.member}</span>: {p.sections.join(", ")}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </Panel>

      <Panel className="p-5 sm:p-6">
        <h2 className="font-display text-lg font-semibold">Recent emails</h2>
        <p className="mt-1 text-sm text-dim">The last 60, kept for 30 days. Addresses are never stored.</p>
        {!data ? (
          <Skeleton className="mt-4 h-40" />
        ) : data.log.length === 0 ? (
          <p className="mt-4 text-sm text-faint">Nothing sent yet.</p>
        ) : (
          <ul className="mt-4 divide-y divide-line text-sm">
            {data.log.map((l, i) => (
              <li key={i} className="flex flex-wrap items-center gap-2 py-2">
                <Tag tone={l.ok ? "aurora" : "ember"}>{l.ok ? "sent" : "failed"}</Tag>
                <span className="font-medium">{l.kind}</span>
                <span className="text-faint">{timeAgo(l.at)}</span>
                {l.error && <span className={cx("w-full text-xs text-ember")}>{l.error}</span>}
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <SaveBar dirty={dirty} saving={saving} onSave={save} onReset={reset} />
    </div>
  );
}
