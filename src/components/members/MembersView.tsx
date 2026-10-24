"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import useSWR from "swr";
import { motion } from "motion/react";
import { Search, Users, X } from "lucide-react";
import type { MemberCardDTO } from "@/lib/types";
import { FIELDS, getField, LOOKING_FOR, lookingForLabel } from "@/lib/taxonomy";
import { Avatar, EmptyState, Input, PageHeader, Skeleton, Tag, cx } from "../ui";
import { MembersTabs } from "./MembersTabs";

const selectCls =
  "h-11 rounded-full border border-line-strong bg-night-2 px-3.5 text-sm text-star focus:border-brass focus:outline-none focus:ring-2 focus:ring-[var(--glow)] sm:h-10";

/** Directory of every approved member. Filters run on the phone after one request, and live in the URL. */
export function MembersView() {
  const { data, error, isLoading, mutate } = useSWR<{ items: MemberCardDTO[] }>("/api/members");
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const [q, setQ] = useState(params.get("q") ?? "");
  const batch = params.get("batch") ?? "";
  const role = params.get("role") ?? "";
  const looking = params.get("looking") ?? "";
  const field = params.get("field") ?? "";
  const volunteer = params.get("volunteer") === "1";

  function setParam(k: string, v: string | null) {
    const sp = new URLSearchParams(params.toString());
    if (v) sp.set(k, v);
    else sp.delete(k);
    router.replace(`${pathname}${sp.size ? `?${sp}` : ""}`, { scroll: false });
  }

  const items = data?.items ?? [];
  const batches = useMemo(() => {
    const m = new Map<string, string>();
    items.forEach((i) => i.batch && m.set(i.batch, i.batchLabel || i.batch));
    return Array.from(m, ([id, label]) => ({ id, label })).sort((a, b) => a.label.localeCompare(b.label));
  }, [items]);
  const usedFields = useMemo(() => FIELDS.filter((f) => items.some((i) => i.fields.includes(f.slug))), [items]);

  const needle = q.trim().toLowerCase();
  const list = items.filter(
    (m) =>
      (!needle || [m.name, m.university, m.fieldOfStudy, m.city, ...m.skills].some((x) => x.toLowerCase().includes(needle))) &&
      (!batch || m.batch === batch) &&
      (!role || (role === "team" ? m.role === "team" || m.isAdmin : m.role === "participant" && !m.isAdmin)) &&
      (!looking || m.lookingFor.includes(looking as MemberCardDTO["lookingFor"][number])) &&
      (!field || m.fields.includes(field)) &&
      (!volunteer || m.volunteerOpen),
  );
  const filtering = Boolean(needle || batch || role || looking || field || volunteer);

  return (
    <div>
      <PageHeader title="Members" subtitle="Everyone in the Comskills Circle. Connect to see someone's WhatsApp and email." />
      <MembersTabs active="directory" />

      <div className="mb-5 space-y-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-faint" />
          <Input
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setParam("q", e.target.value.trim() || null);
            }}
            placeholder="Search name, skill or university"
            className="pl-10"
            aria-label="Search members"
            type="search"
          />
        </div>
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:px-0">
          <select aria-label="Batch" value={batch} onChange={(e) => setParam("batch", e.target.value || null)} className={selectCls}>
            <option value="">All batches</option>
            {batches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.label}
              </option>
            ))}
          </select>
          <select aria-label="Role" value={role} onChange={(e) => setParam("role", e.target.value || null)} className={selectCls}>
            <option value="">Everyone</option>
            <option value="participant">Participants</option>
            <option value="team">Comskills team</option>
          </select>
          <select aria-label="Looking for" value={looking} onChange={(e) => setParam("looking", e.target.value || null)} className={selectCls}>
            <option value="">Looking for anything</option>
            {LOOKING_FOR.map((l) => (
              <option key={l.value} value={l.value}>
                {l.label}
              </option>
            ))}
          </select>
          <select aria-label="Field" value={field} onChange={(e) => setParam("field", e.target.value || null)} className={selectCls}>
            <option value="">All fields</option>
            {usedFields.map((f) => (
              <option key={f.slug} value={f.slug}>
                {f.emoji} {f.label}
              </option>
            ))}
          </select>
          <button
            onClick={() => setParam("volunteer", volunteer ? null : "1")}
            aria-pressed={volunteer}
            className={cx("h-11 shrink-0 rounded-full border px-4 text-sm sm:h-10", volunteer ? "border-aurora bg-aurora/15 text-star" : "border-line-strong text-dim hover:text-star")}
          >
            Open to volunteer
          </button>
          {filtering && (
            <button
              onClick={() => {
                setQ("");
                router.replace(pathname, { scroll: false });
              }}
              className="inline-flex h-11 shrink-0 items-center gap-1 rounded-full px-3 text-sm text-dim hover:text-star sm:h-10"
            >
              <X className="size-4" /> Clear
            </button>
          )}
        </div>
      </div>

      {error && !data ? (
        <EmptyState icon={<Users className="size-10" />} title="Couldn't load members" action={<button onClick={() => mutate()} className="h-11 rounded-full border border-line-strong px-5 text-sm">Try again</button>}>
          Check your connection and try again.
        </EmptyState>
      ) : isLoading && !data ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-36 rounded-[var(--radius-panel)]" />
          ))}
        </div>
      ) : list.length === 0 ? (
        <EmptyState icon={<Users className="size-10" />} title={filtering ? "No one matches these filters" : "No members yet"}>
          {filtering ? "Try removing a filter." : "As people are approved and finish their profile, they appear here."}
        </EmptyState>
      ) : (
        <>
          <p className="mb-3 text-sm text-faint" aria-live="polite">
            {list.length} {list.length === 1 ? "member" : "members"}
          </p>
          <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {list.map((m, i) => (
              <motion.li key={m.id} className="min-w-0" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i, 12) * 0.025 }}>
                <MemberCard m={m} />
              </motion.li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

export function RoleBadge({ m }: { m: Pick<MemberCardDTO, "role" | "teamTitle" | "isAdmin" | "batchLabel"> }) {
  if (m.role === "team" || m.isAdmin) return <Tag tone="violet">{m.isAdmin && !m.teamTitle ? "Comskills team" : `Team${m.teamTitle ? ` · ${m.teamTitle}` : ""}`}</Tag>;
  if (m.batchLabel) return <Tag>{m.batchLabel}</Tag>;
  return null;
}

export function MemberCard({ m }: { m: MemberCardDTO }) {
  return (
    <Link href={`/members/${m.id}`} className="group flex h-full flex-col rounded-[var(--radius-panel)] border border-line bg-raised/80 p-4 transition-colors hover:border-line-strong hover:bg-raised">
      <div className="flex items-start gap-3">
        <Avatar name={m.name} src={m.photoUrl} size={48} ring={m.isMe ? "brass" : undefined} />
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium group-hover:text-brass">
            {m.name}
            {m.isMe && <span className="text-faint"> (you)</span>}
          </p>
          <p className="truncate text-sm text-dim">{[m.university, m.city].filter(Boolean).join(" · ")}</p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            <RoleBadge m={m} />
            {m.volunteerOpen && <Tag tone="aurora">Volunteer</Tag>}
          </div>
        </div>
      </div>
      {m.fieldOfStudy && <p className="mt-3 truncate text-sm">{m.fieldOfStudy}</p>}
      {m.skills.length > 0 && <p className="mt-1 line-clamp-1 text-sm text-dim">{m.skills.slice(0, 4).join(" · ")}</p>}
      <div className="mt-auto flex flex-wrap gap-1.5 pt-3">
        {m.lookingFor.slice(0, 3).map((l) => (
          <Tag key={l} tone="brass">
            {lookingForLabel(l)}
          </Tag>
        ))}
        {m.fields.slice(0, 1).map((f) => (
          <Tag key={f}>
            {getField(f).emoji} {getField(f).label}
          </Tag>
        ))}
      </div>
    </Link>
  );
}
