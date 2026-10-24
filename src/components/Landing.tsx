"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { GraduationCap, Lightbulb, Sparkles } from "lucide-react";
import { CircleMark } from "./bits";

// Decorative sky: invented hubs and people (no real data), drawn once on load.
const HUBS = [
  { x: 150, y: 120, r: 26, c: "#22C55E", label: "Bioinformatics" },
  { x: 430, y: 90, r: 20, c: "#8B5CF6", label: "AI & ML" },
  { x: 520, y: 300, r: 24, c: "#F59E0B", label: "Scholarships" },
  { x: 250, y: 330, r: 18, c: "#14B8A6", label: "Public health" },
  { x: 90, y: 270, r: 14, c: "#84CC16", label: "Biotech" },
];
const PEOPLE = [
  { x: 260, y: 150, h: [0, 1] },
  { x: 330, y: 70, h: [1] },
  { x: 380, y: 200, h: [1, 2] },
  { x: 470, y: 210, h: [2, 1] },
  { x: 600, y: 230, h: [2] },
  { x: 570, y: 380, h: [2] },
  { x: 180, y: 220, h: [0, 3, 4] },
  { x: 330, y: 300, h: [3, 2] },
  { x: 60, y: 160, h: [0, 4] },
  { x: 160, y: 380, h: [3, 4] },
  { x: 410, y: 360, h: [2, 3] },
  { x: 90, y: 60, h: [0] },
];

function Sky() {
  return (
    <svg viewBox="0 0 660 440" className="h-auto w-full" aria-hidden>
      <defs>
        {HUBS.map((h, i) => (
          <radialGradient key={i} id={`lh${i}`}>
            <stop offset="0%" stopColor={h.c} stopOpacity="0.9" />
            <stop offset="60%" stopColor={h.c} stopOpacity="0.25" />
            <stop offset="100%" stopColor={h.c} stopOpacity="0" />
          </radialGradient>
        ))}
      </defs>
      {PEOPLE.flatMap((p, i) =>
        p.h.map((hi) => {
          const h = HUBS[hi];
          const mx = (p.x + h.x) / 2 + (p.y - h.y) * 0.15;
          const my = (p.y + h.y) / 2 - (p.x - h.x) * 0.15;
          return (
            <motion.path
              key={`${i}-${hi}`}
              d={`M${p.x},${p.y} Q${mx},${my} ${h.x},${h.y}`}
              fill="none"
              stroke={h.c}
              strokeOpacity="0.45"
              strokeWidth="1.2"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 1.2, delay: 1 + i * 0.06, ease: "easeInOut" }}
            />
          );
        }),
      )}
      {HUBS.map((h, i) => (
        <motion.g key={i} initial={{ opacity: 0, scale: 0.4 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.15 * i, type: "spring", stiffness: 120, damping: 14 }} style={{ originX: `${h.x}px`, originY: `${h.y}px` }}>
          <circle cx={h.x} cy={h.y} r={h.r * 2.2} fill={`url(#lh${i})`} />
          <circle cx={h.x} cy={h.y} r={h.r / 2.6} fill={h.c} />
          <text x={h.x} y={h.y + h.r + 18} textAnchor="middle" fontSize="13" fill="var(--dim)">
            {h.label}
          </text>
        </motion.g>
      ))}
      {PEOPLE.map((p, i) => (
        <motion.circle
          key={i}
          cx={p.x}
          cy={p.y}
          r={i === 2 ? 7 : 5}
          fill={i === 2 ? "var(--brass)" : "var(--star)"}
          fillOpacity={i === 2 ? 1 : 0.85}
          initial={{ opacity: 0, cx: 330, cy: 220 }}
          animate={{ opacity: 1, cx: p.x, cy: p.y }}
          transition={{ delay: 0.6 + i * 0.05, type: "spring", stiffness: 70, damping: 13 }}
        />
      ))}
    </svg>
  );
}

export function Landing() {
  return (
    <div className="mx-auto flex min-h-dvh max-w-6xl flex-col px-4 sm:px-8">
      <header className="flex h-16 items-center justify-between sm:h-20">
        <div className="flex items-center gap-2.5">
          <CircleMark size={30} spin />
          <span className="font-display text-lg font-semibold sm:text-xl">Comskills Circle</span>
        </div>
        <nav className="flex items-center gap-1">
          <Link href="/privacy" className="inline-flex h-11 items-center px-3 text-sm text-dim hover:text-star">
            Privacy
          </Link>
          <Link href="/login" className="inline-flex h-11 items-center rounded-full px-4 text-sm font-medium text-star hover:bg-raised-2">
            Log in
          </Link>
        </nav>
      </header>

      <main className="grid flex-1 items-center gap-8 py-6 lg:grid-cols-[1fr_1.1fr] lg:gap-16">
        <div className="max-w-xl">
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mb-4 inline-flex items-center gap-2 rounded-full border border-line-strong px-3 py-1 text-xs text-dim">
            <span className="size-1.5 rounded-full bg-aurora" /> For the Comskills Fellowship
          </motion.p>
          <motion.h1
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            className="font-display text-[clamp(2.4rem,7vw,4.4rem)] font-semibold leading-[1] tracking-[-0.035em]"
            style={{ fontVariationSettings: '"opsz" 96' }}
          >
            Find your people. Build something together.
          </motion.h1>
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }} className="mt-5 max-w-md text-base leading-relaxed text-dim sm:text-lg">
            Pitch a project and find teammates across computer science and the biosciences. Track scholarships with your batch, share opportunities, and hear the news first.
          </motion.p>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.45 }} className="mt-8 flex flex-wrap items-center gap-3">
            <Link href="/signup" className="inline-flex h-12 items-center rounded-full bg-brass px-6 font-medium text-brass-ink transition-shadow hover:shadow-[0_0_0_4px_var(--glow)]">
              Create your account
            </Link>
            <Link href="/login" className="inline-flex h-12 items-center rounded-full border border-line-strong px-6 font-medium hover:bg-raised-2">
              Log in
            </Link>
          </motion.div>
          <p className="mt-3 text-sm text-faint">Free and student-led. The Comskills team approves every account.</p>

          <ul className="mt-12 grid gap-5 text-sm sm:grid-cols-3">
            {[
              { icon: Lightbulb, t: "Pitch a project", d: "Say what you're building and who you need. People say “I'm interested”." },
              { icon: GraduationCap, t: "Track scholarships", d: "Log where you applied. Celebrate the wins together." },
              { icon: Sparkles, t: "Matched for you", d: "Projects and opportunities that fit your skills, with the reason why." },
            ].map((f) => (
              <li key={f.t}>
                <f.icon className="mb-2 size-5 text-brass" />
                <p className="font-medium">{f.t}</p>
                <p className="mt-1 text-dim">{f.d}</p>
              </li>
            ))}
          </ul>
        </div>
        <div className="relative -mx-2 sm:mx-0">
          <Sky />
        </div>
      </main>
    </div>
  );
}
