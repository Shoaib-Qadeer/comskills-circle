import Link from "next/link";
import { CircleMark } from "@/components/bits";

export const metadata = { title: "Privacy" };

export default function Privacy() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-12 sm:px-6">
      <Link href="/" className="mb-10 flex items-center gap-2.5">
        <CircleMark size={28} />
        <span className="font-display text-lg font-semibold">Comskills Circle</span>
      </Link>
      <h1 className="font-display text-4xl font-semibold">Privacy, in plain words</h1>
      <p className="mt-3 text-dim">The full privacy notice is being written.</p>
    </div>
  );
}
