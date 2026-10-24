"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import useSWR from "swr";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  forceCenter,
  forceCollide,
  forceLink,
  forceManyBody,
  forceSimulation,
  forceX,
  forceY,
  type Simulation,
  type SimulationLinkDatum,
  type SimulationNodeDatum,
} from "d3-force";
import { Code2, Crosshair, Globe, UserRound, List, Minus, Plus, Send, Sparkles, Waypoints, X, FileText, MapPin } from "lucide-react";
import type { ConstellationDTO } from "@/lib/types";
import { getField } from "@/lib/taxonomy";
import { firstName, initials } from "@/lib/client";
import { CountUp } from "./bits";
import { Avatar, EmptyState, FieldChip, Segmented, Skeleton, Tag, cx } from "./ui";

type Lens = "directions" | "destinations" | "network";
type Person = ConstellationDTO["people"][number];

type GNode = SimulationNodeDatum & {
  id: string;
  kind: "hub" | "person" | "sat";
  r: number;
  color: string;
  label: string;
  emoji?: string;
  count?: number;
  person?: Person;
  owner?: string;
};
type GLink = SimulationLinkDatum<GNode> & { id: string; color: string; source: string | GNode; target: string | GNode };

const LOCATION_COLORS = ["#F2C14E", "#5EEAD4", "#A78BFA", "#38BDF8", "#FB7185", "#4ADE80", "#FDBA74", "#C084FC"];
const PERSON_R = 20;

function buildGraph(data: ConstellationDTO, lens: Lens) {
  const nodes: GNode[] = [];
  const links: GLink[] = [];
  const people = data.people;

  if (lens === "destinations") {
    data.locations.forEach((l, i) => {
      nodes.push({ id: `hub:loc:${l.name}`, kind: "hub", r: Math.min(42, 14 + l.count * 4), color: LOCATION_COLORS[i % LOCATION_COLORS.length], label: l.name, emoji: "📍", count: l.count });
    });
  } else {
    data.hubs.forEach((h) => nodes.push({ id: `hub:${h.slug}`, kind: "hub", r: Math.min(42, 14 + h.count * 4), color: h.color, label: h.label, emoji: h.emoji, count: h.count }));
  }
  const hubIds = new Set(nodes.map((n) => n.id));

  for (const p of people) {
    nodes.push({ id: p.id, kind: "person", r: PERSON_R, color: "var(--star)", label: p.name, person: p });
    const targets = lens === "destinations" ? p.preferredLocations.map((l) => `hub:loc:${l}`) : p.fields.map((f) => `hub:${f}`);
    for (const t of targets) {
      if (!hubIds.has(t)) continue;
      const hub = nodes.find((n) => n.id === t)!;
      links.push({ id: `${p.id}->${t}`, source: p.id, target: t, color: hub.color });
    }
  }

  if (lens === "network") {
    for (const c of data.connections) {
      if (!people.some((p) => p.id === c.addedBy)) continue;
      const color = c.field ? getField(c.field).color : "#94A3B8";
      nodes.push({ id: `sat:${c.id}`, kind: "sat", r: 7, color, label: c.name, owner: c.addedBy });
      links.push({ id: `${c.addedBy}->sat:${c.id}`, source: c.addedBy, target: `sat:${c.id}`, color });
    }
  }
  return { nodes, links };
}

const idOf = (x: string | GNode) => (typeof x === "string" ? x : x.id);

export function ClassConstellation() {
  const { data, isLoading } = useSWR<ConstellationDTO>("/api/constellation");
  const [lens, setLens] = useState<Lens>("directions");
  const [listView, setListView] = useState(false);
  const [selected, setSelected] = useState<Person | null>(null);
  const me = data?.people.find((p) => p.isMe) ?? null;

  const stats = useMemo(() => {
    if (!data) return null;
    const top = data.hubs[0];
    const closest = me
      ? data.people
          .filter((p) => !p.isMe)
          .map((p) => ({ p, n: p.fields.filter((f) => me.fields.includes(f)).length }))
          .filter((x) => x.n > 0)
          .sort((a, b) => b.n - a.n)
          .slice(0, 3)
      : [];
    return { fields: data.hubs.length, top, closest };
  }, [data, me]);

  return (
    <div>
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div className="max-w-xl">
          <h1 className="font-display text-3xl font-semibold sm:text-4xl">Where the class is heading</h1>
          <p className="mt-2 text-dim">Everyone who shares their profile, pulled toward the fields they care about. Close together means similar directions.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Segmented
            id="lens"
            value={lens}
            onChange={(v) => setLens(v)}
            options={[
              { value: "directions", label: "Directions" },
              { value: "destinations", label: "Destinations" },
              { value: "network", label: "Network" },
            ]}
          />
          <button
            onClick={() => setListView((v) => !v)}
            aria-pressed={listView}
            className={cx("inline-flex h-10 items-center gap-2 rounded-full border px-3.5 text-sm", listView ? "border-brass text-brass" : "border-line-strong text-dim hover:text-star")}
          >
            <List className="size-4" /> List view
          </button>
        </div>
      </header>

      {isLoading || !data ? (
        <Skeleton className="h-[560px] rounded-[var(--radius-panel)]" />
      ) : data.people.length === 0 && data.privateCount === 0 ? (
        <EmptyState icon={<Waypoints className="size-10" />} title="The sky is empty for now">
          As classmates finish onboarding with a Class or Open profile, they appear here.
        </EmptyState>
      ) : (
        <div className="grid gap-6 xl:grid-cols-[1fr_280px]">
          <div className="relative min-w-0">
            {!listView && <p className="mb-2 hidden text-xs text-faint sm:block">Drag to explore, Ctrl + scroll to zoom, click someone to see their direction.</p>}
            {listView ? <ListView data={data} lens={lens} onSelect={setSelected} /> : <Graph data={data} lens={lens} onSelect={setSelected} selectedId={selected?.id ?? null} />}
          </div>
          <aside className="space-y-6">
            {stats && (
              <div className="grid grid-cols-2 gap-4 xl:grid-cols-1">
                <div>
                  <p className="font-display text-3xl font-semibold text-brass">
                    <CountUp value={lens === "network" ? data.totals.connections : stats.fields} />
                  </p>
                  <p className="text-sm text-dim">{lens === "network" ? `people known, across ${data.totals.connectionFields} fields` : "fields explored"}</p>
                </div>
                {stats.top && (
                  <div>
                    <p className="font-display text-3xl font-semibold">
                      <CountUp value={stats.top.count} />
                    </p>
                    <p className="text-sm text-dim">
                      people in {stats.top.emoji} {stats.top.label}, the biggest overlap
                    </p>
                  </div>
                )}
              </div>
            )}
            {stats && stats.closest.length > 0 && (
              <div>
                <h2 className="mb-3 text-sm font-medium">Your closest directions</h2>
                <ul className="space-y-2">
                  {stats.closest.map(({ p, n }) => (
                    <li key={p.id}>
                      <button onClick={() => setSelected(p)} className="flex w-full items-center gap-3 rounded-xl p-2 text-left hover:bg-raised-2">
                        <Avatar name={p.name} src={p.photoUrl} size={32} ring={p.open ? "aurora" : undefined} />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium">{p.name}</span>
                          <span className="block text-xs text-faint">
                            {n} shared field{n === 1 ? "" : "s"}
                          </span>
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {me === null && (
              <p className="rounded-2xl border border-dashed border-line-strong p-4 text-sm text-dim">
                Your profile is private, so you’re not on the map.{" "}
                <Link href="/settings" className="text-brass hover:underline">
                  Change visibility
                </Link>
              </p>
            )}
            <div className="space-y-2 text-xs text-faint">
              <p className="flex items-center gap-2">
                <span className="inline-block size-3 rounded-full border-2 border-brass" /> You
              </p>
              <p className="flex items-center gap-2">
                <span className="inline-block size-3 rounded-full border border-dashed border-aurora" /> Open to collaborate
              </p>
            </div>
          </aside>
        </div>
      )}

      <PersonDrawer person={selected} me={me} onClose={() => setSelected(null)} />
    </div>
  );
}

/* ---------------------------------------------------------------- graph */

function Graph({ data, lens, onSelect, selectedId }: { data: ConstellationDTO; lens: Lens; onSelect: (p: Person) => void; selectedId: string | null }) {
  const reduced = useReducedMotion();
  const wrapRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [size, setSize] = useState({ w: 800, h: 560 });
  const [, setFrame] = useState(0);
  const simRef = useRef<Simulation<GNode, GLink> | null>(null);
  const nodesRef = useRef<GNode[]>([]);
  const linksRef = useRef<GLink[]>([]);
  const posMemory = useRef(new Map<string, { x: number; y: number }>());
  const [view, setView] = useState({ k: 1, x: 0, y: 0 });
  const [hover, setHover] = useState<string | null>(null);
  const [entered, setEntered] = useState(false);
  const drag = useRef<{ id: string | null; moved: boolean; startX: number; startY: number; pan?: { x: number; y: number; vx: number; vy: number } }>({ id: null, moved: false, startX: 0, startY: 0 });
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef<{ dist: number; k: number } | null>(null);
  const userMoved = useRef(false);
  const [fitting, setFitting] = useState(false);

  /** Frames the whole constellation (with room for labels) unless the person has panned or zoomed. */
  const fitView = useCallback(
    (animate = true) => {
      const ns = nodesRef.current;
      if (!ns.length) return;
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      for (const n of ns) {
        const px = n.kind === "hub" ? Math.max(n.r * 1.4, n.label.length * 3.8 + 10) : n.r + 18;
        const py = n.kind === "hub" ? n.r + 30 : n.r + 22;
        x0 = Math.min(x0, (n.x ?? 0) - px);
        x1 = Math.max(x1, (n.x ?? 0) + px);
        y0 = Math.min(y0, (n.y ?? 0) - py);
        y1 = Math.max(y1, (n.y ?? 0) + py);
      }
      // Leave room for the zoom buttons (left) and the private-classmates chip (bottom)
      const padL = 56, padR = 12, padT = 12, padB = 60;
      const aw = size.w - padL - padR;
      const ah = size.h - padT - padB;
      const k = Math.min(1.3, Math.max(0.35, Math.min(aw / (x1 - x0), ah / (y1 - y0))));
      setFitting(animate);
      setView({ k, x: padL + aw / 2 - k * ((x0 + x1) / 2), y: padT + ah / 2 - k * ((y0 + y1) / 2) });
    },
    [size],
  );
  const fitRef = useRef(fitView);
  fitRef.current = fitView;

  // Responsive size
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => {
      const w = Math.max(320, e.contentRect.width);
      setSize({ w, h: Math.round(w < 640 ? Math.min(680, w * 1.45) : Math.min(760, Math.max(500, w * 0.72))) });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Build + run the simulation whenever data or lens changes; remember positions to morph smoothly
  useEffect(() => {
    const { nodes, links } = buildGraph(data, lens);
    const cx = size.w / 2;
    const cy = size.h / 2;
    for (const n of nodes) {
      const prev = posMemory.current.get(n.id);
      if (prev) {
        n.x = prev.x;
        n.y = prev.y;
      } else if (n.kind === "sat" && n.owner) {
        const o = posMemory.current.get(n.owner);
        n.x = (o?.x ?? cx) + (Math.random() - 0.5) * 20;
        n.y = (o?.y ?? cy) + (Math.random() - 0.5) * 20;
      } else {
        // New nodes start near the centre so they "fly out" into place
        n.x = cx + (Math.random() - 0.5) * 40;
        n.y = cy + (Math.random() - 0.5) * 40;
      }
    }
    nodesRef.current = nodes;
    linksRef.current = links;

    const sim = forceSimulation<GNode>(nodes)
      .force(
        "link",
        forceLink<GNode, GLink>(links)
          .id((d) => d.id)
          .distance((l) => (idOf(l.target).startsWith("sat:") ? 30 : 46 + (l.target as GNode).r))
          .strength((l) => (idOf(l.target).startsWith("sat:") ? 0.9 : 0.45)),
      )
      .force("charge", forceManyBody<GNode>().strength((d) => (d.kind === "hub" ? -240 : d.kind === "sat" ? -15 : -110)))
      .force("collide", forceCollide<GNode>().radius((d) => (d.kind === "hub" ? d.r + 22 : d.kind === "sat" ? d.r + 2 : d.r + 8)).strength(0.9))
      .force("center", forceCenter(cx, cy))
      .force("x", forceX<GNode>(cx).strength(size.h > size.w ? 0.12 : 0.07))
      .force("y", forceY<GNode>(cy).strength(size.h > size.w ? 0.05 : 0.11))
      .alpha(posMemory.current.size ? 0.7 : 1)
      .alphaDecay(0.035);
    simRef.current = sim;
    userMoved.current = false;

    if (reduced) {
      sim.stop();
      for (let i = 0; i < 320; i++) sim.tick();
      setFrame((f) => f + 1);
      fitRef.current(false);
    } else {
      let raf = 0;
      let lastFit = 0;
      sim.on("tick", () => {
        cancelAnimationFrame(raf);
        raf = requestAnimationFrame(() => setFrame((f) => f + 1));
        // The camera gently follows the constellation while it unfolds
        const now = performance.now();
        if (!userMoved.current && now - lastFit > 450) {
          lastFit = now;
          fitRef.current();
        }
      });
      sim.on("end", () => {
        if (!userMoved.current) fitRef.current();
      });
      // When the physics settles it stops; the idle "breathing" is a cheap CSS drift (see .drift)
    }
    const t = setTimeout(() => setEntered(true), 50);
    return () => {
      clearTimeout(t);
      for (const n of nodes) if (n.x != null && n.y != null) posMemory.current.set(n.id, { x: n.x, y: n.y });
      sim.stop();
    };
  }, [data, lens, size.w, size.h, reduced]);

  const nodes = nodesRef.current;
  const links = linksRef.current;
  const byId = useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes]);

  // Highlight logic: hovering a person lights everyone who shares a hub with them
  const lit = useMemo(() => {
    const focus = hover;
    if (!focus) return null;
    const set = new Set<string>([focus]);
    const hubsOf = (pid: string) => links.filter((l) => idOf(l.source) === pid).map((l) => idOf(l.target));
    const node = byId.get(focus);
    if (!node) return null;
    if (node.kind === "person") {
      const hubs = hubsOf(focus);
      hubs.forEach((h) => set.add(h));
      for (const l of links) if (hubs.includes(idOf(l.target))) set.add(idOf(l.source));
    } else if (node.kind === "hub") {
      for (const l of links) if (idOf(l.target) === focus) set.add(idOf(l.source));
    }
    return set;
  }, [hover, links, byId]);
  const isLit = (id: string) => !lit || lit.has(id);
  const linkLit = (l: GLink) => {
    if (!lit || !hover) return true;
    const s = idOf(l.source);
    const t = idOf(l.target);
    const node = byId.get(hover);
    if (node?.kind === "hub") return t === hover;
    return lit.has(s) && lit.has(t);
  };

  /* ---------- pointer handling: pan, zoom, drag nodes, click ---------- */

  const toGraph = useCallback(
    (clientX: number, clientY: number) => {
      const rect = svgRef.current!.getBoundingClientRect();
      const sx = ((clientX - rect.left) / rect.width) * size.w;
      const sy = ((clientY - rect.top) / rect.height) * size.h;
      return { x: (sx - view.x) / view.k, y: (sy - view.y) / view.k };
    },
    [size, view],
  );

  const zoomAt = (factor: number, clientX?: number, clientY?: number) => {
    userMoved.current = true;
    setFitting(false);
    setView((v) => {
      const k = Math.min(3, Math.max(0.45, v.k * factor));
      const rect = svgRef.current?.getBoundingClientRect();
      const px = rect && clientX != null ? ((clientX - rect.left) / rect.width) * size.w : size.w / 2;
      const py = rect && clientY != null ? ((clientY - rect.top) / rect.height) * size.h : size.h / 2;
      return { k, x: px - ((px - v.x) / v.k) * k, y: py - ((py - v.y) / v.k) * k };
    });
  };

  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey && Math.abs(e.deltaY) < 40 && !e.deltaMode) {
        // trackpad two-finger scroll: let the page scroll unless zoom modifier held
      }
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        zoomAt(e.deltaY < 0 ? 1.1 : 0.9, e.clientX, e.clientY);
      }
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  });

  const onNodeDown = (e: React.PointerEvent, n: GNode) => {
    e.stopPropagation();
    (e.target as Element).setPointerCapture?.(e.pointerId);
    drag.current = { id: n.id, moved: false, startX: e.clientX, startY: e.clientY };
    const p = toGraph(e.clientX, e.clientY);
    n.fx = p.x;
    n.fy = p.y;
    if (!reduced) simRef.current?.alphaTarget(0.25).restart();
  };
  const onBgDown = (e: React.PointerEvent) => {
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
    if (pointers.current.size === 2) {
      const [a, b] = Array.from(pointers.current.values());
      pinch.current = { dist: Math.hypot(a.x - b.x, a.y - b.y), k: view.k };
      return;
    }
    drag.current = { id: null, moved: false, startX: e.clientX, startY: e.clientY, pan: { x: e.clientX, y: e.clientY, vx: view.x, vy: view.y } };
  };
  const onMove = (e: React.PointerEvent) => {
    if (pointers.current.has(e.pointerId)) pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pinch.current && pointers.current.size === 2) {
      const [a, b] = Array.from(pointers.current.values());
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      const k = Math.min(3, Math.max(0.35, pinch.current.k * (d / pinch.current.dist)));
      userMoved.current = true;
      setFitting(false);
      setView((v) => ({ ...v, k }));
      return;
    }
    const dr = drag.current;
    if (Math.hypot(e.clientX - dr.startX, e.clientY - dr.startY) > 4) dr.moved = true;
    if (dr.id) {
      const n = byId.get(dr.id);
      if (n) {
        const p = toGraph(e.clientX, e.clientY);
        n.fx = p.x;
        n.fy = p.y;
        if (reduced) {
          n.x = p.x;
          n.y = p.y;
          setFrame((f) => f + 1);
        }
      }
    } else if (dr.pan && dr.moved) {
      userMoved.current = true;
      setFitting(false);
      const rect = svgRef.current!.getBoundingClientRect();
      const scale = size.w / rect.width;
      setView((v) => ({ ...v, x: dr.pan!.vx + (e.clientX - dr.pan!.x) * scale, y: dr.pan!.vy + (e.clientY - dr.pan!.y) * scale }));
    }
  };
  const onUp = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) pinch.current = null;
    const dr = drag.current;
    if (dr.id) {
      const n = byId.get(dr.id);
      if (n) {
        n.fx = null;
        n.fy = null;
        if (!dr.moved && n.kind === "person" && n.person) onSelect(n.person);
        if (!dr.moved && n.kind === "hub") setHover((h) => (h === n.id ? null : n.id));
      }
      if (!reduced) simRef.current?.alphaTarget(0);
    }
    drag.current = { id: null, moved: false, startX: 0, startY: 0 };
  };

  const recenter = () => {
    userMoved.current = false;
    fitView();
  };

  /* ---------- render ---------- */

  const curve = (s: GNode, t: GNode) => {
    const sx = s.x ?? 0,
      sy = s.y ?? 0,
      tx = t.x ?? 0,
      ty = t.y ?? 0;
    const mx = (sx + tx) / 2 + (sy - ty) * 0.12;
    const my = (sy + ty) / 2 - (sx - tx) * 0.12;
    return `M${sx},${sy} Q${mx},${my} ${tx},${ty}`;
  };

  const hubs = nodes.filter((n) => n.kind === "hub");
  // Keep text readable when the camera zooms out to fit everyone
  const ts = 1 / Math.min(1, Math.max(view.k, 0.75));
  const narrow = size.w < 640;
  const people = nodes.filter((n) => n.kind === "person");
  const sats = nodes.filter((n) => n.kind === "sat");

  return (
    <div ref={wrapRef} className="relative overflow-hidden rounded-[var(--radius-panel)] border border-line bg-night-2/60">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${size.w} ${size.h}`}
        width="100%"
        height={size.h}
        className="block touch-none select-none"
        role="img"
        aria-label={`Constellation of ${data.people.length} classmates grouped by ${lens === "destinations" ? "where they want to go" : "field"}. Use List view for an accessible version.`}
        onPointerDown={onBgDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        onPointerLeave={() => setHover((h) => (drag.current.id ? h : null))}
        style={{ cursor: drag.current.pan ? "grabbing" : "grab" }}
      >
        <defs>
          {hubs.map((h) => (
            <radialGradient key={h.id} id={`g-${cssId(h.id)}`}>
              <stop offset="0%" stopColor={h.color} stopOpacity="0.85" />
              <stop offset="45%" stopColor={h.color} stopOpacity="0.22" />
              <stop offset="100%" stopColor={h.color} stopOpacity="0" />
            </radialGradient>
          ))}
          {people.map((p) => (
            <clipPath key={p.id} id={`c-${cssId(p.id)}`}>
              <circle r={p.r - 2} cx="0" cy="0" />
            </clipPath>
          ))}
        </defs>

        <g
          style={{
            transform: `translate(${view.x}px, ${view.y}px) scale(${view.k})`,
            transformOrigin: "0 0",
            transition: fitting ? "transform 650ms cubic-bezier(0.2, 0.8, 0.2, 1)" : "none",
          }}
        >
          {/* edges */}
          <g fill="none">
            {links.map((l, i) => {
              const s = typeof l.source === "string" ? byId.get(l.source) : l.source;
              const t = typeof l.target === "string" ? byId.get(l.target) : l.target;
              if (!s || !t) return null;
              const on = linkLit(l);
              return (
                <motion.path
                  key={l.id}
                  d={curve(s, t)}
                  stroke={l.color}
                  strokeWidth={on && hover ? 2 : 1.2}
                  strokeDasharray={idOf(l.target).startsWith("sat:") ? "3 3" : undefined}
                  initial={reduced ? false : { pathLength: 0, opacity: 0 }}
                  animate={{ pathLength: 1, opacity: on ? (hover ? 0.9 : 0.42) : 0.08 }}
                  transition={{ pathLength: { duration: 0.9, delay: entered ? 0 : 0.5 + Math.min(i, 40) * 0.015 }, opacity: { duration: 0.2 } }}
                />
              );
            })}
          </g>

          {/* hubs */}
          {hubs.map((h, i) => (
            <g
              key={h.id}
              transform={`translate(${h.x ?? 0},${h.y ?? 0})`}
              onPointerDown={(e) => onNodeDown(e, h)}
              onPointerEnter={() => setHover(h.id)}
              onPointerLeave={() => setHover((x) => (x === h.id ? null : x))}
              style={{ cursor: "pointer" }}
            >
            <motion.g
              initial={reduced ? false : { opacity: 0, scale: 0.3 }}
              animate={{ opacity: isLit(h.id) ? (lens === "network" && !hover ? 0.4 : 1) : 0.25, scale: 1 }}
              transition={{ delay: entered ? 0 : i * 0.04, type: "spring", stiffness: 140, damping: 15 }}
            >
              <circle r={h.r * 2} fill={`url(#g-${cssId(h.id)})`} />
              <circle r={h.r / 2.4} fill={h.color} />
              {(!narrow || (h.count ?? 1) > 1 || hover === h.id || (lit && lit.has(h.id))) && (
              <text y={h.r + 10 + 6 * ts} textAnchor="middle" fontSize={((h.count ?? 1) > 1 ? 13 : 11.5) * ts} fontWeight={(h.count ?? 1) > 1 ? 600 : 400} fill={(h.count ?? 1) > 1 ? "var(--star)" : "var(--dim)"} style={{ paintOrder: "stroke", stroke: "var(--night)", strokeWidth: 4, strokeLinejoin: "round" }}>
                {h.emoji} {h.label}
              </text>
              )}
              {hover === h.id && (
                <g transform={`translate(${h.r / 2.4 + 4},${-h.r / 2.4 - 4})`}>
                  <circle r="10" fill="var(--brass)" />
                  <text textAnchor="middle" dy="4" fontSize="11" fontWeight={700} fill="var(--brass-ink)">
                    {h.count}
                  </text>
                </g>
              )}
            </motion.g>
            </g>
          ))}

          {/* connection satellites (Network lens) */}
          {sats.map((s) => (
            <motion.circle
              key={s.id}
              cx={s.x ?? 0}
              cy={s.y ?? 0}
              r={s.r}
              fill={s.color}
              stroke="var(--star)"
              strokeWidth={1.5}
              initial={reduced ? false : { opacity: 0 }}
              animate={{ opacity: !hover || hover === s.owner ? 0.95 : 0.2 }}
            >
              <title>{s.label}</title>
            </motion.circle>
          ))}

          {/* people */}
          {people.map((n) => {
            const p = n.person!;
            const focused = hover === n.id || selectedId === n.id;
            return (
              <g key={n.id} transform={`translate(${n.x ?? 0},${n.y ?? 0})`}>
              <motion.g
                className="drift"
                style={{ animationDelay: `${(people.indexOf(n) % 7) * -1.3}s`, cursor: "pointer" }}
                initial={reduced ? false : { opacity: 0 }}
                animate={{ opacity: isLit(n.id) ? 1 : 0.25 }}
                transition={{ duration: 0.25 }}
                onPointerDown={(e) => onNodeDown(e, n)}
                onPointerEnter={() => setHover(n.id)}
                onPointerLeave={() => setHover((x) => (x === n.id ? null : x))}
                role="button"
                aria-label={`${p.name}${p.headline ? `: ${p.headline}` : ""}`}
                tabIndex={0}
                onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && onSelect(p)}
                onFocus={() => setHover(n.id)}
                onBlur={() => setHover(null)}
              >
                {p.isMe && <circle r={n.r + 7} fill="none" stroke="var(--brass)" strokeOpacity="0.5" strokeWidth="1.5" />}
                {p.open && <circle className="slow-spin" r={n.r + 3.5} fill="none" stroke="var(--aurora)" strokeWidth="1.5" strokeDasharray="4 4" />}
                <circle r={n.r} fill="var(--raised-2)" stroke={p.isMe ? "var(--brass)" : focused ? "var(--star)" : "var(--line-strong)"} strokeWidth={p.isMe ? 2.5 : 1.5} />
                {p.photoUrl ? (
                  <image href={p.photoUrl} x={-(n.r - 2)} y={-(n.r - 2)} width={(n.r - 2) * 2} height={(n.r - 2) * 2} clipPath={`url(#c-${cssId(n.id)})`} preserveAspectRatio="xMidYMid slice" />
                ) : (
                  <text textAnchor="middle" dy="4.5" fontSize="13" fontWeight={600} fill="var(--dim)">
                    {initials(p.name)}
                  </text>
                )}
                {(p.isMe || focused) && (
                  <text y={n.r + 6 + 9 * ts} textAnchor="middle" fontSize={12 * ts} fontWeight={600} fill={p.isMe ? "var(--brass)" : "var(--star)"} style={{ paintOrder: "stroke", stroke: "var(--night)", strokeWidth: 4, strokeLinejoin: "round" }}>
                    {p.isMe ? "You" : firstName(p.name)}
                  </text>
                )}
              </motion.g>
              </g>
            );
          })}
        </g>

      </svg>

      {/* hover tooltip for people */}
      <AnimatePresence>
        {hover && byId.get(hover)?.kind === "person" && !drag.current.id && (
          <Tooltip node={byId.get(hover)!} view={view} size={size} wrap={wrapRef.current} />
        )}
      </AnimatePresence>

      <div className="absolute bottom-3 left-3 flex flex-col gap-1.5">
        {[
          { icon: Plus, label: "Zoom in", on: () => zoomAt(1.2) },
          { icon: Minus, label: "Zoom out", on: () => zoomAt(1 / 1.2) },
          { icon: Crosshair, label: "Recenter", on: recenter },
        ].map((b) => (
          <button key={b.label} onClick={b.on} aria-label={b.label} title={b.label} className="grid size-9 place-items-center rounded-full border border-line-strong bg-raised/90 text-dim backdrop-blur hover:text-star">
            <b.icon className="size-4" />
          </button>
        ))}
      </div>
      {/* private classmates: anonymous, never linked to anything */}
      {data.privateCount > 0 && (
        <div className="pointer-events-none absolute bottom-3 right-3 flex items-center gap-3 rounded-full border border-line bg-night/80 py-1.5 pl-2 pr-3.5 backdrop-blur" aria-label={`${data.privateCount} classmates exploring privately`}>
          <svg width="30" height="30" viewBox="-15 -15 30 30" aria-hidden>
            <g className={reduced ? undefined : "slow-spin"}>
              {Array.from({ length: Math.min(data.privateCount, 10) }).map((_, i, arr) => {
                const a = (i / arr.length) * Math.PI * 2;
                return <circle key={i} cx={Math.cos(a) * 10} cy={Math.sin(a) * 10} r={2.2} fill="var(--star)" fillOpacity={0.6} />;
              })}
            </g>
          </svg>
          <span className="text-xs text-dim">+{data.privateCount} classmates exploring privately</span>
        </div>
      )}
    </div>
  );
}

function cssId(id: string) {
  return id.replace(/[^a-zA-Z0-9_-]/g, "_");
}

function Tooltip({ node, view, size, wrap }: { node: GNode; view: { k: number; x: number; y: number }; size: { w: number; h: number }; wrap: HTMLDivElement | null }) {
  const p = node.person!;
  const scale = wrap ? wrap.clientWidth / size.w : 1;
  const left = ((node.x ?? 0) * view.k + view.x) * scale;
  const top = ((node.y ?? 0) * view.k + view.y) * scale;
  return (
    <div className="pointer-events-none absolute z-10" style={{ left, top: top - node.r * view.k * scale - 10, transform: "translate(-50%, -100%)" }}>
      <motion.div
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0 }}
        className="w-max max-w-56 rounded-xl border border-line-strong bg-raised px-3 py-2 text-sm shadow-xl"
      >
        <p className="font-medium">{p.isMe ? "You" : p.name}</p>
        {p.headline && <p className="text-xs text-dim">{p.headline}</p>}
      </motion.div>
    </div>
  );
}

/* ---------------------------------------------------------------- list view (accessible) */

function ListView({ data, lens, onSelect }: { data: ConstellationDTO; lens: Lens; onSelect: (p: Person) => void }) {
  const groups =
    lens === "destinations"
      ? data.locations.map((l) => ({ key: l.name, title: `📍 ${l.name}`, people: data.people.filter((p) => p.preferredLocations.includes(l.name)) }))
      : data.hubs.map((h) => ({ key: h.slug, title: `${h.emoji} ${h.label}`, people: data.people.filter((p) => p.fields.includes(h.slug)) }));
  return (
    <div className="space-y-6 rounded-[var(--radius-panel)] border border-line p-5">
      {groups.map((g) => (
        <section key={g.key}>
          <h2 className="mb-2 flex items-baseline gap-2 font-medium">
            {g.title} <span className="tabular text-sm text-faint">{g.people.length}</span>
          </h2>
          <ul className="flex flex-wrap gap-2">
            {g.people.map((p) => (
              <li key={p.id}>
                <button onClick={() => onSelect(p)} className="flex h-10 items-center gap-2 rounded-full border border-line-strong pl-1 pr-3 text-sm hover:bg-raised-2">
                  <Avatar name={p.name} src={p.photoUrl} size={30} ring={p.isMe ? "brass" : p.open ? "aurora" : undefined} />
                  {p.isMe ? "You" : p.name}
                  {lens === "network" && p.connectionCount > 0 && <span className="text-xs text-faint">knows {p.connectionCount}</span>}
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}
      {data.privateCount > 0 && <p className="text-sm text-faint">Plus {data.privateCount} classmates exploring privately.</p>}
    </div>
  );
}

/* ---------------------------------------------------------------- drawer */

function PersonDrawer({ person, me, onClose }: { person: Person | null; me: Person | null; onClose: () => void }) {
  useEffect(() => {
    if (!person) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [person, onClose]);
  const overlap = person && me && !person.isMe ? person.fields.filter((f) => me.fields.includes(f)) : [];
  const links = person?.links ?? {};
  return (
    <AnimatePresence>
      {person && (
        <>
          <motion.div className="fixed inset-0 z-40 bg-[#060a1c]/50 lg:bg-transparent" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />
          <motion.aside
            role="dialog"
            aria-label={person.name}
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", stiffness: 320, damping: 34 }}
            className="fixed inset-x-0 bottom-0 z-50 max-h-[85dvh] overflow-y-auto rounded-t-[28px] border border-line-strong bg-raised p-6 shadow-2xl sm:inset-x-auto sm:inset-y-0 sm:right-0 sm:max-h-none sm:w-[400px] sm:rounded-none sm:rounded-l-[28px]"
          >
            <button onClick={onClose} aria-label="Close" className="absolute right-4 top-4 grid size-8 place-items-center rounded-full text-dim hover:bg-raised-2 hover:text-star">
              <X className="size-4" />
            </button>
            <Avatar name={person.name} src={person.photoUrl} size={72} ring={person.isMe ? "brass" : person.open ? "aurora" : undefined} />
            <h2 className="mt-4 font-display text-2xl font-semibold">{person.isMe ? "You" : person.name}</h2>
            {person.headline && <p className="mt-1 text-dim">{person.headline}</p>}
            {person.open && (
              <Tag tone="aurora" className="mt-3">
                Open to collaborate
              </Tag>
            )}

            {overlap.length > 0 && (
              <div className="mt-6 rounded-2xl border border-brass/30 bg-brass/[0.07] p-4">
                <p className="mb-2 flex items-center gap-2 text-sm font-medium text-brass">
                  <Sparkles className="size-4" /> You overlap on
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {overlap.map((f) => (
                    <FieldChip key={f} slug={f} size="sm" />
                  ))}
                </div>
              </div>
            )}

            <div className="mt-6">
              <p className="mb-2 text-sm text-faint">Fields</p>
              <div className="flex flex-wrap gap-1.5">
                {person.fields.map((f) => (
                  <FieldChip key={f} slug={f} size="sm" />
                ))}
              </div>
            </div>
            {person.preferredLocations.length > 0 && (
              <p className="mt-5 flex items-center gap-2 text-sm text-dim">
                <MapPin className="size-4 text-faint" /> {person.preferredLocations.join(", ")}
              </p>
            )}
            {person.connectionCount > 0 && <p className="mt-2 text-sm text-dim">Has shared {person.connectionCount} connection{person.connectionCount === 1 ? "" : "s"} with the class.</p>}

            {Object.keys(links).length > 0 && (
              <div className="mt-6 flex flex-wrap gap-2">
                {links.linkedin && <ExtLink href={links.linkedin} icon={UserRound} label="LinkedIn" />}
                {links.cv && <ExtLink href={links.cv} icon={FileText} label="CV" />}
                {links.portfolio && <ExtLink href={links.portfolio} icon={Globe} label="Website" />}
                {links.github && <ExtLink href={links.github} icon={Code2} label="GitHub" />}
              </div>
            )}

            {!person.isMe && (
              <div className="mt-8 flex flex-col gap-2">
                <Link href={`/opportunities/new?tag=${person.id}`} className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-brass font-medium text-brass-ink">
                  <Send className="size-4" /> Send {firstName(person.name)} an opportunity
                </Link>
                {person.connectionCount > 0 && (
                  <Link href="/connections" className="inline-flex h-11 items-center justify-center rounded-full border border-line-strong text-sm hover:bg-raised-2">
                    See the connections they shared
                  </Link>
                )}
              </div>
            )}
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}

function ExtLink({ href, icon: Icon, label }: { href: string; icon: typeof UserRound; label: string }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className="inline-flex h-9 items-center gap-1.5 rounded-full border border-line-strong px-3 text-sm hover:bg-raised-2">
      <Icon className="size-4" /> {label}
    </a>
  );
}
