"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import { motion } from "motion/react";
import { CircleMark } from "./bits";
import { Avatar, Button } from "./ui";
import { firstName } from "@/lib/client";

export function PendingView({ name, email, photoUrl, rejected }: { name: string; email: string; photoUrl: string | null; rejected: boolean }) {
  const router = useRouter();
  // Check every 30 seconds whether an admin has let them in
  useEffect(() => {
    if (rejected) return;
    const t = setInterval(() => router.refresh(), 30_000);
    return () => clearInterval(t);
  }, [rejected, router]);

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center px-6 text-center">
      <div className="relative mb-10 size-32">
        {!rejected &&
          [0, 1].map((i) => (
            <motion.div
              key={i}
              className="absolute inset-0 rounded-full border border-line-strong"
              style={{ scale: 1 - i * 0.25 }}
              animate={{ rotate: i ? -360 : 360 }}
              transition={{ duration: 10 + i * 4, repeat: Infinity, ease: "linear" }}
            >
              <span className="absolute -top-1.5 left-1/2 size-3 -translate-x-1/2 rounded-full" style={{ background: i ? "var(--aurora)" : "var(--brass)" }} />
            </motion.div>
          ))}
        <div className="absolute inset-0 grid place-items-center">
          <Avatar name={name} src={photoUrl} size={64} />
        </div>
      </div>
      {rejected ? (
        <>
          <h1 className="font-display text-3xl font-semibold">Access not approved</h1>
          <p className="mt-3 text-dim" aria-live="polite">
            Your request to join Comskills Circle with {email} wasn't approved. If you think this is a mistake, message the Comskills team.
          </p>
        </>
      ) : (
        <>
          <h1 className="font-display text-3xl font-semibold">You're on the list, {firstName(name)}</h1>
          <p className="mt-3 text-dim" aria-live="polite">
            Comskills Circle is for the Comskills Fellowship, so the team approves each new account. This page opens by itself once you're in. You can close it and come back later.
          </p>
          <p className="mt-6 text-sm text-faint">Signed in as {email}</p>
        </>
      )}
      <div className="mt-8 flex items-center gap-3">
        <CircleMark size={24} />
        <Button variant="ghost" onClick={() => signOut({ callbackUrl: "/" })}>
          Sign out
        </Button>
      </div>
    </div>
  );
}
