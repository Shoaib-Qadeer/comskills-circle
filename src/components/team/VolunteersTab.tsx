"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import useSWR from "swr";
import { Download, HandHeart } from "lucide-react";
import type { VolunteerRow } from "@/lib/volunteers";
import { VOLUNTEER_AREAS, VOLUNTEER_FOR } from "@/lib/taxonomy";
import { Avatar, EmptyState, Skeleton, Tag, cx } from "../ui";

const selectCls = "h-11 min-w-0 rounded-full border border-line-strong bg-night-2 px-3.5 text-sm text-star focus:border-brass focus:outline-none sm:h-10";
const FOR_LABEL: Record<string, string> = { comskills: "Comskills", other: "Other causes", both: "Comskills and other causes" };

/** Team → Volunteers: who can help, filterable, with a CSV for spreadsheets. Filters live in the URL. */
export function VolunteersTab() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const vf = params.get("for") ?? "";
  const area = params.get("area") ?? "";
  const minHours = params.get("minHours") ?? "";
  const batch = params.get("vbatch") ?? "";
  const all = params.get("all") === "1";
  const qs = new URLSearchParams();
  if (vf) qs.set("for", vf);
  if (area) qs.set("area", area);
  if (minHours) qs.set("minHours", minHours);
  if (batch) qs.set("batch", batch);
  if (all) qs.set("all", "1");
  const { data, error } = useSWR<{ items: VolunteerRow[]; batches: { id: string; label: string }[]; totalOpen: number }>(`/api/team/volunteers${qs.size ? `?${qs}` : ""}`, { keepPreviousData: true });

  function setParam(k: string, v: string | null) {
    const sp = new URLSearchParams(params.toString());
    if (v) sp.set(k, v);
    else sp.delete(k);
    router.replace(`${pathname}?${sp}`, { scroll: false });
  }

  return (
    <div className="space-y-5">
      <p className="text-sm text-dim">
        {data ? `${data.totalOpen} member${data.totalOpen === 1 ? " is" : "s are"} open to volunteering.` : "…"} Contact details stay private: open a profile and send a Connect request.
      </p>
      <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center">
        <select aria-label="Volunteer for" value={vf} onChange={(e) => setParam("for", e.target.value || null)} className={selectCls}>
          <option value="">For anything</option>
          {VOLUNTEER_FOR.map((f) => (
            <option key={f.value} value={f.value}>
              For {f.label}
            </option>
          ))}
        </select>
        <select aria-label="Area" value={area} onChange={(e) => setParam("area", e.target.value || null)} className={selectCls}>
          <option value="">Any area</option>
          {VOLUNTEER_AREAS.map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </select>
        <select aria-label="Hours per month" value={minHours} onChange={(e) => setParam("minHours", e.target.value || null)} className={selectCls}>
          <option value="">Any hours</option>
          {[2, 4, 8, 16].map((h) => (
            <option key={h} value={h}>
              {h}+ hours a month
            </option>
          ))}
        </select>
        <select aria-label="Batch" value={batch} onChange={(e) => setParam("vbatch", e.target.value || null)} className={selectCls}>
          <option value="">All batches</option>
          {(data?.batches ?? []).map((b) => (
            <option key={b.id} value={b.id}>
              {b.label}
            </option>
          ))}
        </select>
        <button onClick={() => setParam("all", all ? null : "1")} aria-pressed={all} className={cx("h-11 rounded-full border px-4 text-sm sm:h-10", all ? "border-brass bg-brass/15 text-star" : "border-line-strong text-dim hover:text-star")}>
          Include not open
        </button>
        <a href={`/api/team/volunteers.csv${qs.size ? `?${qs}` : ""}`} className="inline-flex h-11 items-center justify-center gap-2 rounded-full border border-line-strong px-4 text-sm hover:bg-raised-2 sm:h-10" download>
          <Download className="size-4" /> CSV
        </a>
      </div>

      {error && !data ? (
        <EmptyState icon={<HandHeart className="size-10" />} title="Couldn't load volunteers">
          Check your connection and try again.
        </EmptyState>
      ) : !data ? (
        <Skeleton className="h-64 rounded-[var(--radius-panel)]" />
      ) : data.items.length === 0 ? (
        <EmptyState icon={<HandHeart className="size-10" />} title="No one matches these filters">
          {data.totalOpen === 0 ? "Members can say they're open to volunteering in their profile (Settings → Volunteering)." : "Try a wider filter."}
        </EmptyState>
      ) : (
        <ul className="divide-y divide-line rounded-[var(--radius-panel)] border border-line bg-raised/60">
          {data.items.map((v) => (
            <li key={v.id}>
              <Link href={`/members/${v.id}`} className="flex items-start gap-3 px-4 py-3 hover:bg-raised-2 sm:px-5">
                <Avatar name={v.name} src={v.photoUrl} size={40} />
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-x-2 font-medium">
                    {v.name}
                    {v.batch && <span className="text-xs font-normal text-faint">{v.batch}</span>}
                    {!v.open && <Tag>not open now</Tag>}
                  </p>
                  <p className="truncate text-sm text-dim">{v.fieldOfStudy}</p>
                  <p className="mt-1 text-sm">
                    {v.for ? FOR_LABEL[v.for] : "Any cause"}
                    {v.hoursPerMonth ? <span className="text-dim"> · {v.hoursPerMonth} h/month</span> : null}
                  </p>
                  {v.areas.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {v.areas.map((a) => (
                        <Tag key={a} tone="aurora">
                          {a}
                        </Tag>
                      ))}
                    </div>
                  )}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
