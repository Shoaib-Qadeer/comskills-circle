import Link from "next/link";
import { CompassMark } from "@/components/bits";

export const metadata = { title: "Privacy" };

const sections: { h: string; p: React.ReactNode[] }[] = [
  {
    h: "What Compass stores",
    p: [
      "Your name, email and Google profile photo (from your LPI Google account).",
      "What you write in your profile: headline, direction, fields, roles, locations, skills and links. Links only — Compass never stores files.",
      "Opportunities you share, connections you add, and intro requests.",
      "Which matches you saved or dismissed.",
    ],
  },
  {
    h: "Who sees what",
    p: [
      "Private: only the matcher reads your profile. Nobody else sees your goals, and you don't appear on the Class page. You still get matches.",
      "Class: classmates see your name, photo, headline, direction, fields, locations and links.",
      "Open to collaborate: everything in Class, plus what you can help with and what you want to team up on.",
      "Whatever you choose, anything you post (an opportunity, a connection) shows your name, and the person you ask for an intro sees your request.",
      "When you share an opportunity, you see how many classmates it matched — never who.",
    ],
  },
  {
    h: "The AI part",
    p: [
      "Compass uses a language model to read opportunity pages and to score matches. Profile text is sent with a code like u7 instead of your name or email.",
      "The model provider is used on a paid plan, so the text isn't used to train their models.",
    ],
  },
  {
    h: "Connections",
    p: [
      "Only public profile links (like LinkedIn) are allowed — no phone numbers or personal emails. Whoever adds a person confirms the profile is public or that the person agreed to be listed.",
    ],
  },
  {
    h: "Deleting your data",
    p: [
      "Settings → Delete my account removes your profile, matches, connections and intro requests immediately. Opportunities you shared stay for the class, marked as posted by a former member.",
      "You can also download a copy of your data from Settings at any time.",
    ],
  },
];

export default function Privacy() {
  return (
    <div className="mx-auto max-w-2xl px-6 py-14">
      <Link href="/" className="mb-10 flex items-center gap-2.5">
        <CompassMark size={28} />
        <span className="font-display text-lg font-semibold">Compass</span>
      </Link>
      <h1 className="font-display text-4xl font-semibold">Privacy, in plain words</h1>
      <p className="mt-3 text-dim">Compass is a class project for the M1 AIRE cohort at Learning Planet Institute. Here is exactly what it keeps and who can see it.</p>
      <div className="mt-10 space-y-10">
        {sections.map((s) => (
          <section key={s.h}>
            <h2 className="font-display text-xl font-semibold">{s.h}</h2>
            <ul className="mt-3 space-y-2.5 leading-relaxed text-dim">
              {s.p.map((x, i) => (
                <li key={i} className="flex gap-3">
                  <span className="mt-2.5 size-1.5 shrink-0 rounded-full bg-brass" aria-hidden />
                  <span>{x}</span>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
