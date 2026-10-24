"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import useSWR from "swr";
import { AnimatePresence, motion } from "motion/react";
import { signOut } from "next-auth/react";
import {
  Archive,
  Bell,
  Compass,
  GraduationCap,
  Lightbulb,
  Lock,
  LogOut,
  Megaphone,
  Moon,
  Plus,
  Settings,
  Shield,
  Sparkles,
  Sun,
  UsersRound,
  Users,
  X,
} from "lucide-react";
import { Avatar, cx } from "./ui";
import { CircleMark } from "./bits";

export type ShellMe = { name: string; photoUrl: string | null; hasPosted: boolean; isAdmin: boolean; isTeam: boolean; email: string };
type Notif = {
  unseenMatches: number;
  unseenProjectMatches?: number;
  unread: number;
  pendingConnect: number;
  pendingApprovals?: number;
  unreadNews?: number;
  total: number;
};
type BadgeKey = "matches" | "approvals" | "inbox" | "news";
type NavItem = { href: string; label: string; icon: typeof Bell; badge?: BadgeKey; show?: (me: ShellMe) => boolean };

/** Sidebar order (desktop). Projects is home and the heart of the platform. */
const NAV: NavItem[] = [
  { href: "/projects", label: "Projects", icon: Lightbulb },
  { href: "/for-you", label: "For you", icon: Sparkles, badge: "matches" },
  { href: "/opportunities", label: "Opportunities", icon: Compass },
  { href: "/scholarships", label: "Scholarships", icon: GraduationCap },
  { href: "/news", label: "News", icon: Megaphone, badge: "news" },
  { href: "/members", label: "Members", icon: Users },
  { href: "/inbox", label: "Inbox", icon: Bell, badge: "inbox" },
  { href: "/team", label: "Team", icon: UsersRound, show: (me) => me.isTeam },
  { href: "/admin", label: "Admin", icon: Shield, badge: "approvals", show: (me) => me.isAdmin },
];

/** Mobile bottom bar: two tabs, the + button, two tabs. */
const BOTTOM: [NavItem, NavItem, NavItem, NavItem] = [
  { href: "/projects", label: "Projects", icon: Lightbulb },
  { href: "/opportunities", label: "Opportunities", icon: Compass },
  { href: "/scholarships", label: "Scholarships", icon: GraduationCap },
  { href: "/members", label: "Members", icon: Users },
];

const CREATE = [
  { href: "/projects/new", label: "Propose a project", hint: "Find teammates for an idea", icon: Lightbulb },
  { href: "/opportunities/new", label: "Share an opportunity", hint: "Paste a link, the AI reads it", icon: Compass },
  { href: "/scholarships?add=1", label: "Add a scholarship", hint: "Track where you applied", icon: GraduationCap },
];

export function useTheme() {
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  useEffect(() => {
    setTheme((document.documentElement.dataset.theme as "dark" | "light") || "dark");
  }, []);
  const toggle = () => {
    const next = theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem("circle-theme", next);
    } catch {}
    setTheme(next);
  };
  return { theme, toggle };
}

function Badge({ n }: { n: number }) {
  return (
    <AnimatePresence>
      {n > 0 && (
        <motion.span key={n} initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }} className="tabular grid h-5 min-w-5 place-items-center rounded-full bg-ember px-1.5 text-[11px] font-semibold text-white">
          {n > 9 ? "9+" : n}
        </motion.span>
      )}
    </AnimatePresence>
  );
}

function AccountMenu({ me, compact }: { me: ShellMe; compact?: boolean }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const { theme, toggle } = useTheme();
  useEffect(() => {
    const onDoc = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, []);
  const item = "flex min-h-11 w-full items-center gap-2.5 rounded-xl px-3 text-sm hover:bg-raised-2";
  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen((o) => !o)} className={cx("flex items-center gap-3 rounded-2xl text-left hover:bg-raised-2", compact ? "p-1" : "w-full p-2")} aria-expanded={open} aria-haspopup="menu" aria-label="Account menu">
        <Avatar name={me.name} src={me.photoUrl} size={compact ? 34 : 34} />
        {!compact && (
          <span className="min-w-0">
            <span className="block truncate text-sm font-medium">{me.name}</span>
            <span className="block truncate text-xs text-faint">{me.email}</span>
          </span>
        )}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            role="menu"
            initial={{ opacity: 0, y: 6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.98 }}
            className={cx("absolute z-50 w-60 overflow-hidden rounded-2xl border border-line-strong bg-raised p-1.5 shadow-2xl", compact ? "right-0 top-full mt-2" : "bottom-full left-0 mb-2")}
          >
            <Link role="menuitem" href="/settings" onClick={() => setOpen(false)} className={item}>
              <Settings className="size-4 text-dim" /> Settings
            </Link>
            <Link role="menuitem" href="/archive" onClick={() => setOpen(false)} className={item}>
              <Archive className="size-4 text-dim" /> Archive
            </Link>
            {compact && (
              <>
                <Link role="menuitem" href="/for-you" onClick={() => setOpen(false)} className={item}>
                  <Sparkles className="size-4 text-dim" /> For you
                </Link>
                {me.isTeam && (
                  <Link role="menuitem" href="/team" onClick={() => setOpen(false)} className={item}>
                    <UsersRound className="size-4 text-dim" /> Team
                  </Link>
                )}
                {me.isAdmin && (
                  <Link role="menuitem" href="/admin" onClick={() => setOpen(false)} className={item}>
                    <Shield className="size-4 text-dim" /> Admin
                  </Link>
                )}
              </>
            )}
            <button role="menuitem" onClick={toggle} className={item}>
              {theme === "dark" ? <Sun className="size-4 text-dim" /> : <Moon className="size-4 text-dim" />}
              {theme === "dark" ? "Light theme" : "Dark theme"}
            </button>
            <Link role="menuitem" href="/privacy" onClick={() => setOpen(false)} className={item}>
              <Lock className="size-4 text-dim" /> Privacy
            </Link>
            <button role="menuitem" onClick={() => signOut({ callbackUrl: "/" })} className={cx(item, "text-ember")}>
              <LogOut className="size-4" /> Sign out
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/** The centre + on phones: Propose a project comes first. */
function CreateSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-50 lg:hidden" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <div className="absolute inset-0 bg-[#060a1c]/70 backdrop-blur-sm" onClick={onClose} aria-hidden />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="Create"
            initial={{ y: 60 }}
            animate={{ y: 0 }}
            exit={{ y: 60 }}
            className="absolute inset-x-0 bottom-0 rounded-t-[28px] border border-line-strong bg-raised p-4 pb-[max(1.25rem,env(safe-area-inset-bottom))]"
          >
            <div className="mb-2 flex items-center justify-between px-1">
              <p className="font-display text-lg font-semibold">What would you like to do?</p>
              <button onClick={onClose} aria-label="Close" className="grid size-11 place-items-center rounded-full text-dim hover:bg-raised-2">
                <X className="size-5" />
              </button>
            </div>
            <ul className="space-y-2">
              {CREATE.map((c, i) => (
                <motion.li key={c.href} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0, transition: { delay: 0.04 * i } }}>
                  <Link
                    href={c.href}
                    onClick={onClose}
                    className={cx("flex items-center gap-3 rounded-2xl border p-3.5", i === 0 ? "border-brass/50 bg-brass/[0.08]" : "border-line hover:bg-raised-2")}
                  >
                    <span className={cx("grid size-11 shrink-0 place-items-center rounded-xl", i === 0 ? "bg-brass text-brass-ink" : "bg-night-2 text-brass")}>
                      <c.icon className="size-5" />
                    </span>
                    <span>
                      <span className="block font-medium">{c.label}</span>
                      <span className="block text-sm text-dim">{c.hint}</span>
                    </span>
                  </Link>
                </motion.li>
              ))}
            </ul>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function AppShell({ me, children }: { me: ShellMe; children: React.ReactNode }) {
  const pathname = usePathname();
  const [creating, setCreating] = useState(false);
  const { data: notif } = useSWR<Notif>("/api/notifications", { refreshInterval: 60_000 });
  const count = (b?: BadgeKey) =>
    b === "inbox"
      ? (notif?.unread ?? 0) + (notif?.pendingConnect ?? 0)
      : b === "matches"
        ? notif?.unseenMatches ?? 0
        : b === "approvals"
          ? notif?.pendingApprovals ?? 0
          : b === "news"
            ? notif?.unreadNews ?? 0
            : 0;
  const nav = NAV.filter((n) => !n.show || n.show(me));
  const posting = pathname.endsWith("/new");
  const isActive = (href: string) => !posting && (pathname === href || pathname.startsWith(href + "/"));

  return (
    <div className="min-h-dvh lg:pl-64">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[60] focus:rounded-full focus:bg-brass focus:px-4 focus:py-2 focus:text-brass-ink">
        Skip to content
      </a>
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r border-line bg-night/80 px-4 py-6 backdrop-blur-md lg:flex">
        <Link href="/projects" className="mb-7 flex items-center gap-2.5 px-2 text-star">
          <CircleMark size={30} />
          <span className="font-display text-xl font-semibold">Comskills Circle</span>
        </Link>
        <Link
          href="/projects/new"
          className={cx(
            "mb-5 flex h-11 items-center justify-center gap-2 rounded-full bg-brass font-medium text-brass-ink transition-shadow hover:shadow-[0_0_0_4px_var(--glow)]",
            !me.hasPosted && !posting && "fab-pulse",
          )}
        >
          <Plus className="size-4" /> Propose a project
        </Link>
        <nav className="flex flex-col gap-0.5 overflow-y-auto" aria-label="Main">
          {nav.map((n) => {
            const active = isActive(n.href);
            return (
              <Link
                key={n.href}
                href={n.href}
                aria-current={active ? "page" : undefined}
                className={cx("relative flex h-11 items-center gap-3 rounded-xl px-3 text-sm transition-colors", active ? "text-star" : "text-dim hover:text-star")}
              >
                {active && <motion.span layoutId="nav-active" className="absolute inset-0 rounded-xl bg-raised-2" transition={{ type: "spring", stiffness: 400, damping: 34 }} />}
                <n.icon className={cx("relative size-[18px]", active && "text-brass")} />
                <span className="relative flex-1">{n.label}</span>
                <span className="relative">
                  <Badge n={count(n.badge)} />
                </span>
              </Link>
            );
          })}
        </nav>
        <div className="mt-auto pt-4">
          <AccountMenu me={me} />
        </div>
      </aside>

      {/* Mobile top bar */}
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-line bg-night/85 pl-4 pr-2 backdrop-blur-md lg:hidden">
        <Link href="/projects" className="flex min-w-0 items-center gap-2">
          <CircleMark size={26} />
          <span className="truncate font-display text-lg font-semibold">Comskills Circle</span>
        </Link>
        <div className="flex items-center">
          <Link href="/news" className="relative grid size-11 place-items-center rounded-full text-dim" aria-label={`News: ${count("news")} unread`}>
            <Megaphone className="size-5" />
            <span className="absolute right-0.5 top-0.5">
              <Badge n={count("news")} />
            </span>
          </Link>
          <Link href="/inbox" className="relative grid size-11 place-items-center rounded-full text-dim" aria-label={`Inbox: ${count("inbox")} new`}>
            <Bell className="size-5" />
            <span className="absolute right-0.5 top-0.5">
              <Badge n={count("inbox")} />
            </span>
          </Link>
          <AccountMenu me={me} compact />
        </div>
      </header>

      <main id="main" className="mx-auto w-full max-w-6xl px-4 pb-28 pt-5 sm:px-6 lg:px-10 lg:pb-16 lg:pt-10">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div key={pathname} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.18, ease: "easeOut" }}>
            {children}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Mobile bottom bar */}
      <nav aria-label="Main" className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-night/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-md lg:hidden">
        <div className="mx-auto grid h-16 max-w-md grid-cols-5 items-center">
          {BOTTOM.slice(0, 2).map((n) => (
            <MobileTab key={n.href} {...n} active={isActive(n.href)} count={count(n.badge)} />
          ))}
          <button
            onClick={() => setCreating(true)}
            aria-label="Create: propose a project, share an opportunity or add a scholarship"
            aria-haspopup="dialog"
            className={cx("mx-auto -mt-6 grid size-14 place-items-center rounded-full bg-brass text-brass-ink shadow-lg", !me.hasPosted && !posting && "fab-pulse")}
          >
            <Plus className="size-6" />
          </button>
          {BOTTOM.slice(2).map((n) => (
            <MobileTab key={n.href} {...n} active={isActive(n.href)} count={count(n.badge)} />
          ))}
        </div>
      </nav>
      <CreateSheet open={creating} onClose={() => setCreating(false)} />
    </div>
  );
}

function MobileTab({ href, label, icon: Icon, active, count }: { href: string; label: string; icon: typeof Bell; active: boolean; count: number }) {
  return (
    <Link href={href} aria-current={active ? "page" : undefined} className={cx("relative flex h-full flex-col items-center justify-center gap-1 text-[11px]", active ? "text-brass" : "text-dim")}>
      <Icon className="size-5" />
      {label}
      <span className="absolute left-1/2 top-1 ml-2">
        <Badge n={count} />
      </span>
    </Link>
  );
}
