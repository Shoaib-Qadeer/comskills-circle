"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import useSWR from "swr";
import { AnimatePresence, motion } from "motion/react";
import { CalendarClock, Download, Megaphone, PartyPopper, Moon as QuietIcon, Search } from "lucide-react";
import type { ScholarshipStage } from "@/lib/types";
import type { ScholarshipDTO } from "@/lib/scholarships";
import { formatDate, timeAgo } from "@/lib/client";
import { winShareText } from "@/lib/share-text";
import { CountUp } from "../bits";
import { Avatar, EmptyState, Input, PageHeader, Panel, Segmented, Skeleton, Tag, cx } from "../ui";
import { EntryCard, STAGE_LABEL, STAGES, STAGE_TONE } from "../scholarships/ScholarshipParts";
import { ShareButtons, absoluteUrl } from "../ShareButtons";
import { VolunteersTab } from "./VolunteersTab";

type Tab = "scholarships" | "volunteers" | "wins" | "quiet";
type Summary = {
  counts: Record<ScholarshipStage, number>;
  byBatch: { batch: string | null; label: string; counts: Record<ScholarshipStage, number> }[];
  upcoming: { days: number; entry: ScholarshipDTO }[];
  wins: ScholarshipDTO[];
  quiet: { member: { id: string; name: string; photoUrl: string | null }; batch: string | null; lastUpdate: string | null; entries: number }[];
  entries: ScholarshipDTO[];
  countries: string[];
  batches: { id: string; label: string }[];
  memberCount: number;
};

const selectCls = "h-11 rounded-full border border-line-strong bg-night-2 px-3.5 text-sm text-star focus:border-brass focus:outline-none sm:h-10";

export function TeamView() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const tab = (params.get("tab") as Tab) || "scholarships";
  const batch = params.get("batch") ?? "";
  const stage = params.get("stage") ?? "";
  const country = params.get("country") ?? "";
  const qs = new URLSearchParams();
  if (batch) qs.set("batch", batch);
  if (stage) qs.set("stage", stage);
  if (country) qs.set("country", country);
  const { data, error } = useSWR<Summary>(`/api/team/summary${qs.size ? `?${qs}` : ""}`, { keepPreviousData: true });

  function setParam(k: string, v: string | null) {
    const sp = new URLSearchParams(params.toString());
    if (v) sp.set(k, v);
    else sp.delete(k);
    router.replace(`${pathname}${sp.size ? `?${sp}` : ""}`, { scroll: false });
  }

  return (
    <div>
      <PageHeader title="Team" subtitle="For the Comskills team: how members are doing with scholarships, who can volunteer, wins to celebrate and who to check in with." />
      <div className="-mx-4 mb-6 overflow-x-auto px-4 [scrollbar-width:none] sm:mx-0 sm:px-0">
        <Segmented
          id="team-tab"
          value={tab}
          onChange={(t) => setParam("tab", t === "scholarships" ? null : t)}
          options={[
            { value: "scholarships", label: "Scholarships" },
            { value: "volunteers", label: "Volunteers" },
            { value: "wins", label: "Wins to announce", count: data?.wins.length },
            { value: "quiet", label: "Quiet members", count: data?.quiet.length },
          ]}
        />
      </div>
      {tab === "volunteers" ? (
        <VolunteersTab />
      ) : error && !data ? (
        <p className="rounded-2xl border border-ember/40 p-5 text-ember">Couldn't load the summary. Refresh to try again.</p>
      ) : !data ? (
        <Skeleton className="h-96 rounded-[var(--radius-panel)]" />
      ) : (
        <AnimatePresence mode="wait">
          <motion.div key={tab} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.16 }}>
            {tab === "scholarships" && <ScholarshipsTab data={data} batch={batch} stage={stage} country={country} setParam={setParam} qs={qs.toString()} />}
            {tab === "wins" && <WinsTab wins={data.wins} />}
            {tab === "quiet" && <QuietTab quiet={data.quiet} />}
          </motion.div>
        </AnimatePresence>
      )}
    </div>
  );
}

function ScholarshipsTab({ data, batch, stage, country, setParam, qs }: { data: Summary; batch: string; stage: string; country: string; setParam: (k: string, v: string | null) => void; qs: string }) {
  const [q, setQ] = useState(country);
  const shown = useMemo(() => data.entries.slice(0, 200), [data.entries]);
  return (
    <div className="space-y-6">
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:px-0">
        <select aria-label="Batch" value={batch} onChange={(e) => setParam("batch", e.target.value || null)} className={selectCls}>
          <option value="">All batches</option>
          {data.batches.map((b) => (
            <option key={b.id} value={b.id}>
              {b.label}
            </option>
          ))}
          <option value="none">No batch</option>
        </select>
        <select aria-label="Stage" value={stage} onChange={(e) => setParam("stage", e.target.value || null)} className={selectCls}>
          <option value="">All stages</option>
          {STAGES.map((s) => (
            <option key={s} value={s}>
              {STAGE_LABEL[s]}
            </option>
          ))}
        </select>
        <form
          className="relative min-w-44"
          onSubmit={(e) => {
            e.preventDefault();
            setParam("country", q.trim() || null);
          }}
        >
          <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-faint" />
          <Input list="team-countries" value={q} onChange={(e) => setQ(e.target.value)} onBlur={() => setParam("country", q.trim() || null)} placeholder="Country" aria-label="Country" className="rounded-full pl-10" />
          <datalist id="team-countries">
            {data.countries.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </form>
        <a href={`/api/team/scholarships.csv${qs ? `?${qs}` : ""}`} className="inline-flex h-11 shrink-0 items-center gap-2 rounded-full border border-line-strong px-4 text-sm hover:bg-raised-2 sm:h-10">
          <Download className="size-4" /> CSV
        </a>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {STAGES.map((s) => (
          <button key={s} onClick={() => setParam("stage", stage === s ? null : s)} aria-pressed={stage === s} className={cx("rounded-2xl border bg-raised/60 p-4 text-left", stage === s ? "border-brass" : "border-line hover:border-line-strong")}>
            <p className={cx("font-display text-3xl font-semibold", s === "accepted" ? "text-aurora" : s === "applying" ? "text-brass" : "")}>
              <CountUp value={data.counts[s]} />
            </p>
            <p className="mt-1 text-sm text-dim">{STAGE_LABEL[s]}</p>
          </button>
        ))}
      </div>
      <p className="text-sm text-faint">Across {data.memberCount} members{batch ? " in this batch" : ""}.</p>

      {data.byBatch.length > 1 && (
        <Panel className="overflow-x-auto p-4 sm:p-5">
          <h2 className="mb-3 font-display text-lg font-semibold">By batch</h2>
          <table className="w-full min-w-[440px] text-left text-sm">
            <thead className="text-xs text-faint">
              <tr>
                <th className="py-2 pr-3 font-normal">Batch</th>
                {STAGES.map((s) => (
                  <th key={s} className="py-2 pr-3 text-right font-normal">
                    {STAGE_LABEL[s]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {data.byBatch.map((b) => (
                <tr key={b.label}>
                  <td className="py-2 pr-3">{b.label}</td>
                  {STAGES.map((s) => (
                    <td key={s} className="tabular py-2 pr-3 text-right">
                      {b.counts[s]}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>
      )}

      <Panel className="p-4 sm:p-5">
        <h2 className="flex items-center gap-2 font-display text-lg font-semibold">
          <CalendarClock className="size-5 text-brass" /> Upcoming deadlines
        </h2>
        <p className="mt-1 text-sm text-dim">Applying entries due in the next 30 days.</p>
        {data.upcoming.length === 0 ? (
          <p className="mt-4 text-sm text-faint">No deadlines in the next 30 days.</p>
        ) : (
          <ul className="mt-4 divide-y divide-line">
            {data.upcoming.map(({ days, entry }) => (
              <li key={entry.id} className="flex items-center gap-3 py-2.5">
                {entry.owner && <Avatar name={entry.owner.name} src={entry.owner.photoUrl} size={32} />}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    {entry.owner ? (
                      <Link href={`/members/${entry.owner.id}`} className="hover:text-brass">
                        {entry.owner.name}
                      </Link>
                    ) : (
                      "Member"
                    )}
                    <span className="font-normal text-dim"> · {entry.name}</span>
                  </p>
                  <p className="text-xs text-faint">
                    {entry.country} · {formatDate(entry.deadline)}
                  </p>
                </div>
                <span className={cx("tabular shrink-0 text-sm font-medium", days <= 3 ? "text-ember" : days <= 14 ? "text-brass" : "text-dim")}>{days === 0 ? "Today" : `${days} day${days === 1 ? "" : "s"}`}</span>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <section>
        <h2 className="mb-3 font-display text-lg font-semibold">
          Entries <span className="tabular text-sm font-normal text-faint">{data.entries.length}</span>
        </h2>
        {shown.length === 0 ? (
          <EmptyState icon={<Search className="size-10" />} title="No entries match">
            Try another batch, stage or country.
          </EmptyState>
        ) : (
          <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
            {shown.map((e) => (
              <EntryCard key={e.id} e={e} showOwner />
            ))}
          </div>
        )}
        {data.entries.length > shown.length && <p className="mt-3 text-sm text-faint">Showing 200 of {data.entries.length}. Download the CSV for all of them.</p>}
      </section>
    </div>
  );
}

function WinsTab({ wins }: { wins: ScholarshipDTO[] }) {
  if (!wins.length)
    return (
      <EmptyState icon={<PartyPopper className="size-10" />} title="No wins waiting">
        When a member marks a scholarship as accepted and says the team can share it, it shows up here.
      </EmptyState>
    );
  return (
    <ul className="grid gap-3 md:grid-cols-2">
      {wins.map((w) => (
        <li key={w.id} className="min-w-0 rounded-[var(--radius-panel)] border border-aurora/40 bg-aurora/[0.06] p-4">
          <div className="flex items-center gap-3">
            {w.owner && <Avatar name={w.owner.name} src={w.owner.photoUrl} size={44} />}
            <div className="min-w-0">
              <p className="font-medium">{w.owner?.name ?? "A member"}</p>
              <p className="text-sm text-dim">
                {w.programme}
                {w.university ? ` at ${w.university}` : ""} · {w.name}
              </p>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link href={`/news?compose=win&scholarship=${w.id}`} className="inline-flex h-11 items-center gap-2 rounded-full bg-brass px-4 text-sm font-medium text-brass-ink sm:h-10">
              <Megaphone className="size-4" /> Announce on News
            </Link>
            <ShareButtons compact text={winShareText(w.owner?.name ?? "a Comskills member", w.programme ?? w.name, w.university, absoluteUrl("/news"))} url={absoluteUrl(w.owner ? `/members/${w.owner.id}` : "/news")} />
          </div>
        </li>
      ))}
    </ul>
  );
}

function QuietTab({ quiet }: { quiet: Summary["quiet"] }) {
  if (!quiet.length)
    return (
      <EmptyState icon={<QuietIcon className="size-10" />} title="Everyone's active">
        Everyone has updated their tracker in the last 60 days.
      </EmptyState>
    );
  return (
    <div>
      <p className="mb-4 text-sm text-dim">Members with no tracker entry, or no update in 60+ days. A friendly message can help.</p>
      <ul className="divide-y divide-line rounded-[var(--radius-panel)] border border-line bg-raised/70">
        {quiet.map((q) => (
          <li key={q.member.id}>
            <Link href={`/members/${q.member.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-raised-2">
              <Avatar name={q.member.name} src={q.member.photoUrl} size={36} />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">{q.member.name}</span>
                <span className="block text-xs text-faint">{q.batch ?? "No batch"}</span>
              </span>
              {q.entries === 0 ? <Tag>No entries</Tag> : <span className="text-xs text-faint">Last update {timeAgo(q.lastUpdate!)}</span>}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

export { STAGE_TONE };
