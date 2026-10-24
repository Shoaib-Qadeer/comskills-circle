import Link from "next/link";
import { CompassMark } from "@/components/bits";

export const metadata = { title: "Sign-in not allowed" };

export default async function Denied({ searchParams }: { searchParams: Promise<{ reason?: string; error?: string }> }) {
  const sp = await searchParams;
  const domainIssue = sp.reason === "domain";
  const dbIssue = sp.reason === "database";
  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center px-6 text-center">
      <CompassMark size={44} />
      <h1 className="mt-6 font-display text-3xl font-semibold">
        {domainIssue ? "Compass is only for the M1 AIRE class" : dbIssue ? "Compass can't reach its database" : "Sign-in didn't work"}
      </h1>
      <p className="mt-3 text-dim">
        {domainIssue
          ? "Please sign in with your LPI Google account (ending in @learningplanetinstitute.org)."
          : dbIssue
            ? "Your Google sign-in worked, but Compass couldn't save your account. If you run Compass, check MongoDB Atlas Network Access and the MONGODB_URI setting."
            : "Something went wrong while signing in. Try again in a moment."}
      </p>
      <Link href="/" className="mt-8 inline-flex h-11 items-center rounded-full bg-brass px-5 font-medium text-brass-ink">
        Back to sign in
      </Link>
    </div>
  );
}
