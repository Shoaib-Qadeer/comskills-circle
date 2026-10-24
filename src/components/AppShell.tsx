"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import useSWR from "swr";
import { AnimatePresence, motion } from "motion/react";
import { signOut } from "next-auth/react";
import { Archive, Bell, Compass, LogOut, Moon, Plus, Settings, Sparkles, Sun, Users, Shield, Lock } from "lucide-react";
import { Avatar, cx } from "./ui";
import { CircleMark } from "./bits";

type Me = { name: string; photoUrl: string | null; hasPosted: boolean; isAdmin: boolean; email: string };
type Notif = { unseenMatches: number; unread: number; pendingConnect: number; pendingApprovals?: number; total: number };

type NavItem = { href: string; label: string; icon: typeof Bell; badge?: "matches" | "approvals" | "inbox" };
const NAV: NavItem[] = [
  { href: "/matches", label: "Matches", icon: Sparkles, badge: "matches" as const },
  { href: "/opportunities", label: "Opportunities", icon: Compass },
  { href: "/members", label: "Members", icon: Users },
  { href: "/inbox", label: "Inbox", icon: Bell, badge: "inbox" as const },
];
const ARCHIVE: NavItem = { href: "/archive", label: "Archive", icon: Archive };
const ADMIN: NavItem = { href: "/admin", label: "Admin", icon: Shield, badge: "approvals" };

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
        <motion.span
          key={n}
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          exit={{ scale: 0 }}
          className="tabular grid h-5 min-w-5 place-items-center rounded-full bg-ember px-1.5 text-[11px] font-semibold text-white"
        >
          {n > 9 ? "9+" : n}
        </motion.span>
      )}
    </AnimatePresence>
  );
}

function AccountMenu({ me }: { me: Me }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const { theme, toggle } = useTheme();
  useEffect(() => {
    const onDoc = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);
  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen((o) => !o)} className="flex w-full items-center gap-3 rounded-2xl p-2 text-left hover:bg-raised-2" aria-expanded={open}>
        <Avatar name={me.name} src={me.photoUrl} size={34} />
        <span className="hidden min-w-0 lg:block">
          <span className="block truncate text-sm font-medium">{me.name}</span>
          <span className="block truncate text-xs text-faint">{me.email}</span>
        </span>
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.98 }}
            className="absolute bottom-full right-0 z-50 mb-2 w-56 overflow-hidden rounded-2xl border border-line-strong bg-raised p-1.5 shadow-2xl lg:left-0 lg:right-auto"
          >
            <Link href="/settings" onClick={() => setOpen(false)} className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm hover:bg-raised-2">
              <Settings className="size-4 text-dim" /> Settings
            </Link>
            <Link href="/archive" onClick={() => setOpen(false)} className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm hover:bg-raised-2 lg:hidden">
              <Archive className="size-4 text-dim" /> Archive
            </Link>
            <button onClick={toggle} className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-sm hover:bg-raised-2">
              {theme === "dark" ? <Sun className="size-4 text-dim" /> : <Moon className="size-4 text-dim" />}
              {theme === "dark" ? "Light theme" : "Dark theme"}
            </button>
            <Link href="/privacy" onClick={() => setOpen(false)} className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm hover:bg-raised-2">
              <Lock className="size-4 text-dim" /> Privacy
            </Link>
            {me.isAdmin && (
              <Link href="/admin" onClick={() => setOpen(false)} className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm hover:bg-raised-2">
                <Shield className="size-4 text-dim" /> Admin
              </Link>
            )}
            <button onClick={() => signOut({ callbackUrl: "/" })} className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-sm text-ember hover:bg-raised-2">
              <LogOut className="size-4" /> Sign out
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function AppShell({ me, children }: { me: Me; children: React.ReactNode }) {
  const pathname = usePathname();
  const { data: notif } = useSWR<Notif>("/api/notifications", { refreshInterval: 60_000 });
  const count = (b?: "matches" | "approvals" | "inbox") =>
    b === "inbox" ? (notif?.unread ?? 0) + (notif?.pendingConnect ?? 0) : b === "matches" ? notif?.unseenMatches ?? 0 : b === "approvals" ? notif?.pendingApprovals ?? 0 : 0;
  const sideNav = [...NAV, ARCHIVE, ...(me.isAdmin ? [ADMIN] : [])];
  const isActive = (href: string) => pathname === href || (href !== "/" && pathname.startsWith(href + "/")) || pathname === href;
  const posting = pathname.startsWith("/opportunities/new");

  return (
    <div className="min-h-dvh lg:pl-64">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r border-line bg-night/80 px-4 py-6 backdrop-blur-md lg:flex">
        <Link href="/matches" className="mb-8 flex items-center gap-2.5 px-2 text-star">
          <CircleMark size={30} />
          <span className="font-display text-xl font-semibold">Comskills Circle</span>
        </Link>
        <Link
          href="/opportunities/new"
          className={cx(
            "mb-6 flex h-11 items-center justify-center gap-2 rounded-full bg-brass font-medium text-brass-ink transition-shadow hover:shadow-[0_0_0_4px_var(--glow)]",
            !me.hasPosted && !posting && "fab-pulse",
          )}
        >
          <Plus className="size-4" /> Share an opportunity
        </Link>
        <nav className="flex flex-col gap-1" aria-label="Main">
          {sideNav.map((n) => {
            const active = isActive(n.href) && !posting;
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
        <div className="mt-auto">
          <AccountMenu me={me} />
        </div>
      </aside>

      {/* Mobile top bar */}
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-line bg-night/85 px-4 backdrop-blur-md lg:hidden">
        <Link href="/matches" className="flex items-center gap-2">
          <CircleMark size={26} />
          <span className="font-display text-lg font-semibold">Comskills Circle</span>
        </Link>
        <div className="flex items-center gap-1">
          <Link href="/inbox" className="relative grid size-11 place-items-center rounded-full text-dim" aria-label={`Inbox: ${count("inbox")} new`}>
            <Bell className="size-5" />
            <span className="absolute right-0.5 top-0.5">
              <Badge n={count("inbox")} />
            </span>
          </Link>
          <div className="w-12">
            <AccountMenu me={me} />
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl px-4 pb-28 pt-6 sm:px-6 lg:px-10 lg:pb-16 lg:pt-10">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div key={pathname} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.2, ease: "easeOut" }}>
            {children}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Mobile bottom bar */}
      <nav aria-label="Main" className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-night/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-md lg:hidden">
        <div className="mx-auto grid h-16 max-w-md grid-cols-5 items-center">
          {[NAV[0], NAV[1]].map((n) => (
            <MobileTab key={n.href} {...n} active={isActive(n.href) && !posting} count={count(n.badge)} />
          ))}
          <Link
            href="/opportunities/new"
            aria-label="Share an opportunity"
            className={cx("mx-auto -mt-6 grid size-14 place-items-center rounded-full bg-brass text-brass-ink shadow-lg", !me.hasPosted && !posting && "fab-pulse")}
          >
            <Plus className="size-6" />
          </Link>
          {[NAV[2], NAV[3]].map((n) => (
            <MobileTab key={n.href} {...n} active={isActive(n.href) && !posting} count={count(n.badge)} />
          ))}
        </div>
      </nav>
    </div>
  );
}

function MobileTab({ href, label, icon: Icon, active, count }: { href: string; label: string; icon: typeof Bell; active: boolean; count: number }) {
  return (
    <Link href={href} aria-current={active ? "page" : undefined} className={cx("relative flex flex-col items-center gap-1 text-[11px]", active ? "text-brass" : "text-dim")}>
      <Icon className="size-5" />
      {label}
      <span className="absolute -top-1 left-1/2 ml-2">
        <Badge n={count} />
      </span>
    </Link>
  );
}
