"use client";

import { useEffect, useState } from "react";
import { animate, motion, useMotionValue, useTransform } from "motion/react";
import type { Warning } from "@/lib/types";
import { cx, Tag } from "./ui";
import { daysLeft } from "@/lib/client";

/** The compass rose mark: a needle that points brass-north. */
export function CompassMark({ size = 28, spin = false }: { size?: number; spin?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden className="shrink-0">
      <circle cx="16" cy="16" r="14.5" fill="none" stroke="currentColor" strokeOpacity="0.35" strokeWidth="1.2" />
      <circle cx="16" cy="16" r="10" fill="none" stroke="currentColor" strokeOpacity="0.15" strokeWidth="1" strokeDasharray="1.5 2.5" />
      <motion.g
        initial={spin ? { rotate: -140 } : false}
        animate={{ rotate: 0 }}
        transition={{ type: "spring", stiffness: 60, damping: 7, delay: 0.2 }}
        style={{ originX: "16px", originY: "16px" }}
      >
        <path d="M16 3.5 L19.2 16 L16 14.4 L12.8 16 Z" fill="var(--brass)" />
        <path d="M16 28.5 L12.8 16 L16 17.6 L19.2 16 Z" fill="currentColor" fillOpacity="0.45" />
      </motion.g>
      <circle cx="16" cy="16" r="1.6" fill="var(--night)" stroke="var(--brass)" strokeWidth="1" />
    </svg>
  );
}

/** Animated circular score (0–100). */
export function ScoreRing({ score, size = 52, muted }: { score: number; size?: number; muted?: boolean }) {
  const r = (size - 6) / 2;
  const c = 2 * Math.PI * r;
  const v = useMotionValue(0);
  const dash = useTransform(v, (x) => `${(x / 100) * c} ${c}`);
  const [shown, setShown] = useState(0);
  useEffect(() => {
    const ctrl = animate(v, score, { duration: 1.1, ease: [0.16, 1, 0.3, 1], onUpdate: (x) => setShown(Math.round(x)) });
    return () => ctrl.stop();
  }, [score, v]);
  const color = muted ? "var(--faint)" : score >= 85 ? "var(--aurora)" : score >= 70 ? "var(--brass)" : "var(--violet)";
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }} aria-label={`Match score ${score} out of 100`} role="img">
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--line-strong)" strokeWidth="3" />
        <motion.circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" style={{ strokeDasharray: dash }} />
      </svg>
      <span className="tabular absolute inset-0 grid place-items-center text-sm font-semibold" style={{ color }}>
        {shown}
      </span>
    </div>
  );
}

/** Re-derives deadline warnings from the viewer's local date so chips and countdowns always agree. */
function localDeadlineWarnings(warnings: Warning[], deadline: string | null | undefined): Warning[] {
  if (deadline === undefined) return warnings;
  const rest = warnings.filter((w) => w.kind !== "deadline_soon" && w.kind !== "deadline_urgent");
  const n = daysLeft(deadline);
  if (n === null || n < 0 || n > 14) return rest;
  const w: Warning =
    n <= 3
      ? { kind: "deadline_urgent", label: n === 0 ? "⏳ Deadline today" : `⏳ Deadline in ${n} day${n === 1 ? "" : "s"}` }
      : { kind: "deadline_soon", label: `⏳ Deadline in ${n} days` };
  return [w, ...rest];
}

export function WarningChips({ warnings, hideUnknown, deadline }: { warnings: Warning[]; hideUnknown?: boolean; deadline?: string | null }) {
  const local = localDeadlineWarnings(warnings, deadline);
  const list = hideUnknown ? local.filter((w) => !w.kind.endsWith("_unknown")) : local;
  if (!list.length) return null;
  return (
    <div className="flex flex-wrap gap-1.5">
      {list.map((w) => (
        <Tag
          key={w.kind}
          tone={w.kind === "deadline_urgent" || w.kind === "french_required" ? "ember" : w.kind.endsWith("_unknown") ? "neutral" : "brass"}
          className={w.kind === "deadline_urgent" ? "urgent-pulse" : undefined}
        >
          {w.label}
        </Tag>
      ))}
    </div>
  );
}

export function DeadlinePill({ deadline }: { deadline: string | null }) {
  const n = daysLeft(deadline);
  if (n === null) return <span className="text-xs text-faint">No deadline given</span>;
  if (n < 0) return <span className="text-xs text-faint">Closed</span>;
  return (
    <span className={cx("tabular text-xs font-medium", n <= 3 ? "text-ember" : n <= 14 ? "text-brass" : "text-dim")}>
      {n === 0 ? "Closes today" : `${n} day${n === 1 ? "" : "s"} left`}
    </span>
  );
}

/** Counts up from 0 — used for the few numbers that deserve a moment. */
export function CountUp({ value, className }: { value: number; className?: string }) {
  const [n, setN] = useState(0);
  useEffect(() => {
    const ctrl = animate(0, value, { duration: 0.9, ease: [0.16, 1, 0.3, 1], onUpdate: (x) => setN(Math.round(x)) });
    return () => ctrl.stop();
  }, [value]);
  return <span className={cx("tabular", className)}>{n}</span>;
}

export function OrgMark({ name, url }: { name: string | null; url: string }) {
  let host = "";
  try {
    host = new URL(url).hostname;
  } catch {}
  // A letter mark rather than a remote favicon, so viewing the list never pings a third party.
  const letter = (name || host || "?").replace(/^www\./, "")[0]?.toUpperCase();
  return (
    <span className="grid size-10 shrink-0 place-items-center rounded-xl border border-line bg-night-2 font-display text-lg font-semibold text-dim" aria-hidden>
      {letter}
    </span>
  );
}
