"use client";

import { useState } from "react";
import useSWR, { mutate as globalMutate } from "swr";
import { toast } from "sonner";
import { RefreshCw, Trash2 } from "lucide-react";
import type { OpportunityDTO } from "@/lib/types";
import { api, formatDate } from "@/lib/client";
import { Button, Segmented, Skeleton } from "../ui";

export function ContentTab() {
  const { data, mutate } = useSWR<{ opportunities: OpportunityDTO[] }>("/api/admin/content");
  const [which, setWhich] = useState<"open" | "expired">("open");
  const [busy, setBusy] = useState<string | null>(null);
  const opps = (data?.opportunities ?? []).filter((o) => (which === "expired" ? o.status === "expired" : o.status === "open"));

  async function rematch(o: OpportunityDTO) {
    setBusy(o.id);
    try {
      const r = await api<{ matchCount: number }>("/api/admin", "POST", { action: "rematch", opportunityId: o.id });
      toast.success(`Matched to ${r.matchCount} members`);
      mutate();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(null);
    }
  }
  async function removeOpp(o: OpportunityDTO) {
    if (!confirm(`Delete "${o.title}" for everyone?`)) return;
    await api(`/api/opportunities/${o.id}`, "DELETE").catch((e) => toast.error(e.message));
    toast.success("Deleted");
    mutate();
    globalMutate("/api/admin");
  }

  return (
    <div className="space-y-8">
      <div>
        <Segmented
          id="content-which"
          value={which}
          onChange={setWhich}
          className="mb-5"
          options={[
            { value: "open", label: "Open", count: data?.opportunities.filter((o) => o.status === "open").length },
            { value: "expired", label: "Archived", count: data?.opportunities.filter((o) => o.status === "expired").length },
          ]}
        />
        {!data ? (
          <Skeleton className="h-64 rounded-[var(--radius-panel)]" />
        ) : (
          <ul className="divide-y divide-line rounded-[var(--radius-panel)] border border-line bg-raised/60">
            {opps.length === 0 && <li className="p-6 text-center text-dim">Nothing here.</li>}
            {opps.map((o) => (
              <li key={o.id} className="flex flex-wrap items-center gap-3 px-5 py-3.5">
                <div className="min-w-0 flex-1 basis-64">
                  <p className="font-medium">{o.title}</p>
                  <p className="text-sm text-dim">
                    {[o.organization, o.postedBy ? `shared by ${o.postedBy.name}` : "former member", o.deadline ? `deadline ${formatDate(o.deadline)}` : "no deadline", `${o.matchCount ?? 0} matches`]
                      .filter(Boolean)
                      .join(", ")}
                  </p>
                </div>
                <Button size="sm" variant="ghost" loading={busy === o.id} onClick={() => rematch(o)}>
                  <RefreshCw className="size-3.5" /> Re-match
                </Button>
                <Button size="sm" variant="quiet" onClick={() => removeOpp(o)} aria-label={`Delete ${o.title}`}>
                  <Trash2 className="size-3.5" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
