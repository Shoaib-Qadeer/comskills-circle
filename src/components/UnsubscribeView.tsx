"use client";

import { useState } from "react";
import Link from "next/link";
import { MailX } from "lucide-react";
import { api } from "@/lib/client";
import { AuthShell } from "./auth/AuthParts";
import { Button, ErrorText } from "./ui";

/** Confirm step (so link scanners in mail apps don't unsubscribe people by just opening the link). */
export function UnsubscribeView({ u, s }: { u: string; s: string }) {
  const [state, setState] = useState<"ask" | "busy" | "done">("ask");
  const [err, setErr] = useState<string | null>(null);
  async function go() {
    setState("busy");
    setErr(null);
    try {
      await api("/api/unsubscribe", "POST", { u, s });
      setState("done");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Something went wrong.");
      setState("ask");
    }
  }
  return (
    <AuthShell title={state === "done" ? "You're unsubscribed" : "Stop Comskills Circle emails?"}>
      <div className="flex flex-col items-center text-center">
        <MailX className="mb-4 size-10 text-brass" />
        {state === "done" ? (
          <p className="text-dim">
            No more digests or notification emails. You&rsquo;ll still get account emails like sign-in codes. You can turn emails back on any time in{" "}
            <Link href="/settings" className="text-brass underline">
              Settings
            </Link>
            .
          </p>
        ) : (
          <>
            <p className="text-dim">This turns off the digest and all notification emails. Everything still shows up inside the app.</p>
            <ErrorText>{err}</ErrorText>
            <Button className="mt-6 w-full" size="lg" loading={state === "busy"} onClick={go} disabled={!u || !s}>
              Unsubscribe
            </Button>
            <Link href="/settings" className="mt-4 inline-flex min-h-11 items-center text-sm text-dim hover:text-star">
              Or choose which emails to keep in Settings
            </Link>
          </>
        )}
      </div>
    </AuthShell>
  );
}
