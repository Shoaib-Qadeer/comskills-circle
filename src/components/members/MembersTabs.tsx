"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { cx } from "../ui";

/** Directory · Map switch at the top of the Members area. */
export function MembersTabs({ active }: { active: "directory" | "map" }) {
  const tabs = [
    { key: "directory", href: "/members", label: "Directory" },
    { key: "map", href: "/members/map", label: "Community map" },
  ] as const;
  return (
    <nav aria-label="Members views" className="mb-6 inline-flex rounded-full border border-line bg-night-2 p-1">
      {tabs.map((t) => {
        const on = t.key === active;
        return (
          <Link key={t.key} href={t.href} aria-current={on ? "page" : undefined} className={cx("relative inline-flex h-10 items-center rounded-full px-4 text-sm sm:h-8", on ? "text-brass-ink" : "text-dim hover:text-star")}>
            {on && <motion.span layoutId="members-tab" className="absolute inset-0 rounded-full bg-brass" transition={{ type: "spring", stiffness: 400, damping: 32 }} />}
            <span className="relative">{t.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
