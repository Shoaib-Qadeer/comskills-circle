"use client";

import { useState } from "react";
import useSWR, { mutate as globalMutate } from "swr";
import { FlaskConical, RefreshCw, RotateCcw } from "lucide-react";
import type { AppSettings, PromptKey } from "@/lib/settings";
import { api, timeAgo } from "@/lib/client";
import { Button, Input, Label, Panel, Skeleton, Textarea, Toggle, cx } from "../ui";
import { NumberField, SaveBar, UsageChart, useSettingsDraft, type Overview } from "./shared";

const FEATURE_LABELS: Record<keyof AppSettings["ai"]["features"], { label: string; description: string }> = {
  extraction: { label: "Read posted links", description: "Fills in title, deadline, duration and fields when someone shares a link." },
  matchOpportunity: { label: "Match opportunities to people", description: "Scores each shared opportunity for every member and writes the reason." },
  matchProposal: { label: "Match projects to people", description: "Scores each project proposal for every member, and suggests people to invite." },
  profileSuggestions: { label: "Suggest profile fields", description: "Suggests fields while people write their direction." },
  coach: { label: "How to approach this", description: "Tailored advice on a match: what to highlight, gaps, a first step." },
};

const PROMPT_LABELS: Record<PromptKey, string> = {
  extraction: "Reading links",
  matchOpportunity: "Matching a new opportunity",
  matchProfile: "Matching a new or edited profile",
  matchProposal: "Matching a new project",
  profile: "Profile suggestions",
  coach: "How to approach this",
};

export function AiTab({ overview }: { overview?: Overview }) {
  const { data, draft, setDraft, dirty, save, saving, reset } = useSettingsDraft();
  const { data: logData, mutate: mutateLog } = useSWR<{ log: { at: string; label: string; model: string; ok: boolean; inputTokens: number; outputTokens: number; ms: number; error: string | null }[] }>(
    "/api/admin/ai",
  );
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);
  const [prompt, setPrompt] = useState<PromptKey>("matchOpportunity");
  if (!draft || !data) return <Skeleton className="h-96 rounded-[var(--radius-panel)]" />;
  const ai = draft.ai;
  const setAi = (patch: Partial<AppSettings["ai"]>) => setDraft({ ...draft, ai: { ...ai, ...patch } });
  const setLimits = (patch: Partial<AppSettings["limits"]>) => setDraft({ ...draft, limits: { ...draft.limits, ...patch } });

  async function test() {
    setTesting(true);
    setTestResult(null);
    try {
      const r = await api<{ model: string; ms: number; reply: string }>("/api/admin/ai", "POST");
      setTestResult(`Working: ${r.model} replied in ${(r.ms / 1000).toFixed(1)} s: "${r.reply}"`);
    } catch (e) {
      setTestResult(e instanceof Error ? e.message : "Test failed");
    } finally {
      setTesting(false);
      mutateLog();
      globalMutate("/api/admin");
    }
  }

  return (
    <div className="space-y-6">
      <Panel className="p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="font-display text-lg font-semibold">Connection</h2>
            <p className="mt-1 text-sm text-dim">
              Provider <span className="text-star">{overview?.ai.provider ?? "…"}</span>, model{" "}
              <span className="text-star">{ai.model || overview?.ai.model || "not set"}</span>
              {ai.model ? " (override)" : " (from LLM_MODEL)"}. API key {overview?.ai.keyConfigured ? <span className="text-aurora">set</span> : <span className="text-ember">missing</span>}.
            </p>
          </div>
          <Button variant="ghost" onClick={test} loading={testing}>
            <FlaskConical className="size-4" /> Test the AI
          </Button>
        </div>
        {testResult && <p className={cx("mt-3 text-sm", testResult.startsWith("Working") ? "text-aurora" : "text-ember")}>{testResult}</p>}
        <div className="mt-6 grid gap-5 sm:grid-cols-2">
          <Toggle checked={ai.enabled} onChange={(v) => setAi({ enabled: v })} label="AI switched on" description="When off, Comskills Circle uses basic rule-based matching and manual forms." />
          <div>
            <Label htmlFor="model" hint="Leave empty to use LLM_MODEL">
              Model override
            </Label>
            <Input id="model" value={ai.model} onChange={(e) => setAi({ model: e.target.value.trim() })} placeholder={overview?.ai.model || "e.g. a flash or flash-lite model"} />
          </div>
        </div>
      </Panel>

      <Panel className="p-5 sm:p-6">
        <h2 className="font-display text-lg font-semibold">Budget and behaviour</h2>
        <p className="mt-1 text-sm text-dim">When a daily cap is reached, Comskills Circle switches to basic matching until midnight (Karachi time). Your provider's own limits still apply.</p>
        <div className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          <NumberField id="calls" label="AI calls per day" value={ai.dailyCallLimit} min={0} max={100000} onChange={(v) => setAi({ dailyCallLimit: v })} />
          <NumberField id="tokens" label="Tokens per day" hint="input + output" value={ai.dailyTokenLimit} min={0} max={100000000} step={10000} onChange={(v) => setAi({ dailyTokenLimit: v })} />
          <NumberField id="threshold" label="Match threshold" hint="0–100" value={ai.matchThreshold} min={1} max={100} onChange={(v) => setAi({ matchThreshold: v })} />
          <NumberField id="chars" label="Characters read per link" value={ai.extractionChars} min={2000} max={120000} step={1000} onChange={(v) => setAi({ extractionChars: v })} />
          <NumberField id="batch" label="Items per call (one profile)" hint="projects or opportunities" value={ai.profileBatchSize} min={1} max={50} onChange={(v) => setAi({ profileBatchSize: v })} />
          <NumberField id="chunk" label="Profiles per call (one post)" hint="about 40 is safe" value={ai.matchChunkSize} min={5} max={80} onChange={(v) => setAi({ matchChunkSize: v })} />
          <NumberField id="temp" label="Temperature" hint="0 = consistent" value={ai.temperature} min={0} max={1} step={0.05} onChange={(v) => setAi({ temperature: v })} />
        </div>
      </Panel>

      <Panel className="p-5 sm:p-6">
        <h2 className="font-display text-lg font-semibold">AI features</h2>
        <div className="mt-5 grid gap-5 sm:grid-cols-2">
          {(Object.keys(FEATURE_LABELS) as (keyof typeof FEATURE_LABELS)[]).map((k) => (
            <Toggle key={k} checked={ai.features[k]} onChange={(v) => setAi({ features: { ...ai.features, [k]: v } })} label={FEATURE_LABELS[k].label} description={FEATURE_LABELS[k].description} />
          ))}
        </div>
      </Panel>

      <Panel className="p-5 sm:p-6">
        <h2 className="font-display text-lg font-semibold">Per-person daily limits</h2>
        <p className="mt-1 text-sm text-dim">You're exempt from these.</p>
        <div className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          <NumberField id="l-extract" label="Links read" value={draft.limits.extractPerDay} min={0} max={1000} onChange={(v) => setLimits({ extractPerDay: v })} />
          <NumberField id="l-post" label="Opportunities shared" value={draft.limits.postPerDay} min={0} max={1000} onChange={(v) => setLimits({ postPerDay: v })} />
          <NumberField id="l-connect" label="Connect requests" value={draft.limits.connectPerDay} min={0} max={1000} onChange={(v) => setLimits({ connectPerDay: v })} />
          <NumberField id="l-coach" label="Approach advice" value={draft.limits.coachPerDay} min={0} max={1000} onChange={(v) => setLimits({ coachPerDay: v })} />
          <NumberField id="l-proposals" label="Projects proposed" value={draft.limits.proposalsPerDay} min={0} max={1000} onChange={(v) => setLimits({ proposalsPerDay: v })} />
          <NumberField id="l-interest" label="'I'm interested' clicks" value={draft.limits.interestPerDay} min={0} max={1000} onChange={(v) => setLimits({ interestPerDay: v })} />
          <NumberField id="l-announce" label="News posts (team)" value={draft.limits.announcePerDay} min={0} max={1000} onChange={(v) => setLimits({ announcePerDay: v })} />
          <NumberField id="l-tracker" label="Tracker entries added" value={draft.limits.trackerPerDay} min={0} max={1000} onChange={(v) => setLimits({ trackerPerDay: v })} />
          <NumberField id="l-reports" label="Reports sent" value={draft.limits.reportsPerDay} min={0} max={1000} onChange={(v) => setLimits({ reportsPerDay: v })} />
        </div>
      </Panel>

      <Panel className="p-5 sm:p-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="font-display text-lg font-semibold">Prompts</h2>
            <p className="mt-1 text-sm text-dim">Edit the instructions the AI follows. Keep the JSON format the default asks for, or that feature falls back to basic behaviour.</p>
          </div>
          <select
            aria-label="Prompt to edit"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value as PromptKey)}
            className="h-10 rounded-[var(--radius-field)] border border-line-strong bg-night-2 px-3 text-sm text-star focus:border-brass focus:outline-none"
          >
            {(Object.keys(PROMPT_LABELS) as PromptKey[]).map((k) => (
              <option key={k} value={k}>
                {PROMPT_LABELS[k]}
                {ai.prompts[k] ? " (edited)" : ""}
              </option>
            ))}
          </select>
        </div>
        <Textarea
          className="mt-4 min-h-72 font-mono text-[13px] leading-relaxed"
          value={ai.prompts[prompt] || data.defaultPrompts[prompt]}
          onChange={(e) => setAi({ prompts: { ...ai.prompts, [prompt]: e.target.value === data.defaultPrompts[prompt] ? "" : e.target.value } })}
          aria-label={`Prompt: ${PROMPT_LABELS[prompt]}`}
        />
        <div className="mt-3 flex items-center justify-between gap-3 text-sm">
          <span className="text-faint">{ai.prompts[prompt] ? "Using your edited version." : "Using the built-in prompt."}</span>
          {ai.prompts[prompt] && (
            <Button size="sm" variant="quiet" onClick={() => setAi({ prompts: { ...ai.prompts, [prompt]: "" } })}>
              <RotateCcw className="size-3.5" /> Reset to built-in
            </Button>
          )}
        </div>
      </Panel>

      <Panel className="p-5 sm:p-6">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-display text-lg font-semibold">Recent AI calls</h2>
          <Button size="sm" variant="quiet" onClick={() => mutateLog()}>
            <RefreshCw className="size-3.5" /> Refresh
          </Button>
        </div>
        {overview && <UsageChart usage={overview.ai.usage} />}
        {!logData ? (
          <Skeleton className="mt-4 h-40" />
        ) : logData.log.length === 0 ? (
          <p className="mt-4 text-sm text-dim">No calls yet. They appear here as people share links and get matched.</p>
        ) : (
          <div className="mt-5 overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="text-xs text-faint">
                <tr>
                  <th className="py-2 pr-3 font-normal">When</th>
                  <th className="py-2 pr-3 font-normal">What</th>
                  <th className="py-2 pr-3 font-normal">Tokens in / out</th>
                  <th className="py-2 pr-3 font-normal">Time</th>
                  <th className="py-2 font-normal">Result</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {logData.log.map((l, i) => (
                  <tr key={i}>
                    <td className="py-2 pr-3 text-dim">{timeAgo(l.at)}</td>
                    <td className="py-2 pr-3">{l.label}</td>
                    <td className="tabular py-2 pr-3 text-dim">
                      {l.inputTokens.toLocaleString("en-GB")} / {l.outputTokens.toLocaleString("en-GB")}
                    </td>
                    <td className="tabular py-2 pr-3 text-dim">{(l.ms / 1000).toFixed(1)} s</td>
                    <td className="py-2">{l.ok ? <span className="text-aurora">OK</span> : <span className="text-ember" title={l.error ?? ""}>{(l.error ?? "Failed").slice(0, 80)}</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <SaveBar dirty={dirty} saving={saving} onSave={save} onReset={reset} />
    </div>
  );
}

