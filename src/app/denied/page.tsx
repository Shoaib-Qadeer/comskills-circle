import Link from "next/link";
import { CircleMark } from "@/components/bits";

export const metadata = { title: "Something went wrong" };

export default async function Denied({ searchParams }: { searchParams: Promise<{ reason?: string; error?: string }> }) {
  const sp = await searchParams;
  const dbIssue = sp.reason === "database";
  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center px-6 text-center">
      <CircleMark size={44} />
      <h1 className="mt-6 font-display text-3xl font-semibold">{dbIssue ? "Comskills Circle can't reach its database" : "That didn't work"}</h1>
      <p className="mt-3 text-dim">
        {dbIssue
          ? "If you run Comskills Circle, check MongoDB Atlas Network Access (allow 0.0.0.0/0) and the MONGODB_URI setting."
          : "Something went wrong while signing in. Try again in a moment."}
      </p>
      <Link href="/" className="mt-8 inline-flex h-11 items-center rounded-full bg-brass px-5 font-medium text-brass-ink">
        Back to the start
      </Link>
    </div>
  );
}
