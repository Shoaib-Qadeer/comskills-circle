"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import useSWR from "swr";
import { AnimatePresence, motion } from "motion/react";
import { PageHeader, Segmented } from "../ui";
import type { AdminTab, Overview } from "./shared";
import { OverviewTab } from "./OverviewTab";
import { PeopleTab } from "./PeopleTab";
import { AccessTab } from "./AccessTab";
import { AiTab } from "./AiTab";
import { ContentTab } from "./ContentTab";
import { EmailTab } from "./EmailTab";

const TABS: AdminTab[] = ["overview", "people", "access", "email", "ai", "content"];

export function AdminView() {
  const params = useSearchParams();
  const router = useRouter();
  const initial = params.get("tab") as AdminTab | null;
  const [tab, setTabState] = useState<AdminTab>(initial && TABS.includes(initial) ? initial : "overview");
  const { data: overview } = useSWR<Overview>("/api/admin", { refreshInterval: 30_000 });
  const setTab = (t: AdminTab) => {
    setTabState(t);
    router.replace(t === "overview" ? "/admin" : `/admin?tab=${t}`, { scroll: false });
  };
  return (
    <div>
      <PageHeader title="Admin" subtitle="Only admins see this page. Approve members, set roles and batches, tune email and AI, and keep content tidy." />
      <div className="-mx-4 mb-8 overflow-x-auto px-4 [scrollbar-width:none] sm:mx-0 sm:px-0">
        <Segmented
          id="admin-tab"
          value={tab}
          onChange={setTab}
          options={[
            { value: "overview", label: "Overview" },
            { value: "people", label: "People", count: overview?.counts.pending },
            { value: "access", label: "Access" },
            { value: "email", label: "Email" },
            { value: "ai", label: "AI" },
            { value: "content", label: "Content", count: overview?.counts.openReports || undefined },
          ]}
        />
      </div>
      <AnimatePresence mode="wait">
        <motion.div key={tab} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }}>
          {tab === "overview" && <OverviewTab data={overview} go={setTab} />}
          {tab === "people" && <PeopleTab />}
          {tab === "access" && <AccessTab />}
          {tab === "email" && <EmailTab />}
          {tab === "ai" && <AiTab overview={overview} />}
          {tab === "content" && <ContentTab />}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
