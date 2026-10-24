"use client";

import { SessionProvider } from "next-auth/react";
import { SWRConfig } from "swr";
import { MotionConfig } from "motion/react";
import { fetcher } from "@/lib/client";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider refetchOnWindowFocus={false}>
      <SWRConfig value={{ fetcher, revalidateOnFocus: true, dedupingInterval: 3000 }}>
        <MotionConfig reducedMotion="user" transition={{ type: "spring", stiffness: 260, damping: 24 }}>
          {children}
        </MotionConfig>
      </SWRConfig>
    </SessionProvider>
  );
}
