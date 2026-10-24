"use client";

import dynamic from "next/dynamic";
import { Skeleton } from "../ui";

// d3-force and the map code are only downloaded when someone opens the map.
const ClassConstellation = dynamic(() => import("../ClassConstellation").then((m) => m.ClassConstellation), {
  ssr: false,
  loading: () => <Skeleton className="h-[520px] rounded-[var(--radius-panel)]" />,
});

export function CommunityMapLoader() {
  return <ClassConstellation />;
}
