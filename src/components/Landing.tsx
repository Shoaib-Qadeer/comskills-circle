"use client";

import Link from "next/link";
import { signIn } from "next-auth/react";
import { motion } from "motion/react";
import { Lock, Send, Sparkles } from "lucide-react";
import { CompassMark } from "./bits";
import { Button } from "./ui";

// Decorative sky: invented hubs and people (no real data), drawn once on load.
const HUBS = [
  { x: 150, y: 120, r: 26, c: "#14B8A6", label: "Digital health" },
  { x: 430, y: 90, r: 20, c: "#8B5CF6", label: "AI" },
  { x: 520, y: 300, r: 24, c: "#38BDF8", label: "Climate" },
  { x: 250, y: 330, r: 18, c: "#EC4899", label: "Neuroscience" },
  { x: 90, y: 270, r: 14, c: "#FB923C", label: "Policy" },
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
    <div className="mx-auto flex min-h-dvh max-w-6xl flex-col px-5 sm:px-8">
      <header className="flex h-20 items-center justify-between">
        <div className="flex items-center gap-2.5">
          <CompassMark size={30} spin />
          <span className="font-display text-xl font-semibold">Compass</span>
        </div>
        <Link href="/privacy" className="text-sm text-dim hover:text-star">
          Privacy
        </Link>
      </header>

      <main className="grid flex-1 items-center gap-10 py-8 lg:grid-cols-[1fr_1.1fr] lg:gap-16">
        <div className="max-w-xl">
          <motion.h1
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            className="font-display text-[clamp(2.6rem,6vw,4.6rem)] font-semibold leading-[0.98] tracking-[-0.035em]"
            style={{ fontVariationSettings: '"opsz" 96' }}
          >
            Your class, heading somewhere. Together.
          </motion.h1>
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }} className="mt-6 max-w-md text-lg leading-relaxed text-dim">
            A private board for the M1 AIRE class. Share an internship link, and it reaches every classmate it fits — including the ones you didn’t think of.
          </motion.p>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.45 }} className="mt-9 flex flex-col items-start gap-3">
            <Button size="lg" onClick={() => signIn("google", { callbackUrl: "/matches" })}>
              <GoogleG /> Sign in with your LPI Google account
            </Button>
            <p className="text-sm text-faint">Only @learningplanetinstitute.org accounts can join.</p>
          </motion.div>

          <ul className="mt-14 grid gap-5 text-sm sm:grid-cols-3">
            {[
              { icon: Send, t: "Share in 30 seconds", d: "Paste a link. Compass reads the details for you." },
              { icon: Sparkles, t: "Matched for you", d: "Each match says why it fits and what to watch for." },
              { icon: Lock, t: "Private by default", d: "Keep your goals hidden and still get matched." },
            ].map((f) => (
              <li key={f.t}>
                <f.icon className="mb-2 size-5 text-brass" />
                <p className="font-medium">{f.t}</p>
                <p className="mt-1 text-dim">{f.d}</p>
              </li>
            ))}
          </ul>
        </div>
        <div className="relative -mx-4 sm:mx-0">
          <Sky />
        </div>
      </main>
    </div>
  );
}

function GoogleG() {
  return (
    <svg viewBox="0 0 24 24" className="size-5" aria-hidden>
      <path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.4h6.5a5.6 5.6 0 0 1-2.4 3.6v3h3.9c2.2-2.1 3.5-5.1 3.5-8.7Z" />
      <path fill="#34A853" d="M12 24c3.2 0 6-1.1 7.9-2.9l-3.9-3a7.2 7.2 0 0 1-10.7-3.8h-4v3.1A12 12 0 0 0 12 24Z" />
      <path fill="#FBBC05" d="M5.3 14.3a7.2 7.2 0 0 1 0-4.6V6.6h-4a12 12 0 0 0 0 10.8l4-3.1Z" />
      <path fill="#EA4335" d="M12 4.8c1.8 0 3.3.6 4.6 1.8l3.4-3.4A12 12 0 0 0 1.3 6.6l4 3.1A7.2 7.2 0 0 1 12 4.8Z" />
    </svg>
  );
}
