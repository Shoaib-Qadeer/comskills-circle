"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { ArrowLeft } from "lucide-react";
import type { MeDTO } from "@/lib/types";
import { api, firstName } from "@/lib/client";
import { HOME_PATH } from "@/lib/auth-messages";
import { CircleMark } from "./bits";
import { Button, ErrorText, cx } from "./ui";
import {
  BasicsFields,
  basicsProblems,
  draftFromMe,
  draftToPatch,
  LookingForFields,
  lookingForProblems,
  PhotoPicker,
  ProfilePreview,
  TechnicalFields,
  technicalProblems,
  VolunteeringFields,
  type ProfileDraft,
} from "./ProfileParts";

const STEPS = [
  { title: "The basics", sub: "Where you study and how people can reach you once you connect." },
  { title: "Your technical background", sub: "What you know and what you've built. This is how projects find you." },
  { title: "What you're looking for", sub: "We use this to match you with projects and opportunities." },
  { title: "Volunteering", sub: "Comskills runs on volunteers. Tell the team if you'd like to help." },
  { title: "Check your profile", sub: "This is what other members will see. You can change it any time in Settings." },
] as const;

const DRAFT_KEY = "circle-onboarding-draft";

async function celebrate() {
  try {
    const confetti = (await import("canvas-confetti")).default;
    confetti({ particleCount: 110, spread: 75, origin: { y: 0.7 }, colors: ["#f2c14e", "#5eead4", "#a78bfa", "#eef0ff"], disableForReducedMotion: true });
  } catch {
    /* decoration only */
  }
}

export function OnboardingWizard({ me }: { me: MeDTO }) {
  const router = useRouter();
  const [d, setD] = useState<ProfileDraft>(() => draftFromMe(me));
  const [photoUrl, setPhotoUrl] = useState<string | null>(me.photoUrl);
  const [step, setStep] = useState(0);
  const [dir, setDir] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [phase, setPhase] = useState<"form" | "saving" | "matching">("form");

  // Keep a draft on this phone so a dropped connection or closed tab doesn't lose the typing.
  useEffect(() => {
    try {
      const saved = localStorage.getItem(`${DRAFT_KEY}:${me.id}`);
      if (saved) setD((cur) => ({ ...cur, ...JSON.parse(saved) }));
    } catch {
      /* storage unavailable */
    }
  }, [me.id]);
  useEffect(() => {
    try {
      localStorage.setItem(`${DRAFT_KEY}:${me.id}`, JSON.stringify(d));
    } catch {
      /* storage unavailable */
    }
  }, [d, me.id]);

  const set = <K extends keyof ProfileDraft>(k: K, v: ProfileDraft[K]) => setD((p) => ({ ...p, [k]: v }));
  const problem = [basicsProblems(d), technicalProblems(d), lookingForProblems(d), null, null][step];

  const go = (delta: number) => {
    setError(null);
    if (delta > 0 && problem) return setError(problem);
    setDir(delta);
    setStep((s) => Math.min(STEPS.length - 1, Math.max(0, s + delta)));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  async function finish() {
    setError(null);
    const first = basicsProblems(d) || technicalProblems(d) || lookingForProblems(d);
    if (first) return setError(first);
    setPhase("saving");
    try {
      await api("/api/me", "PATCH", { ...draftToPatch(d), onboarded: true });
      try {
        localStorage.removeItem(`${DRAFT_KEY}:${me.id}`);
      } catch {}
      celebrate();
      setPhase("matching");
      const started = Date.now();
      await api("/api/me/rematch", "POST").catch(() => null);
      const wait = Math.max(0, 1600 - (Date.now() - started));
      setTimeout(() => {
        router.replace(`${HOME_PATH}?welcome=1`);
        router.refresh();
      }, wait);
    } catch (e) {
      setPhase("form");
      setError(e instanceof Error ? e.message : "Could not save. Check your connection and try again.");
    }
  }

  if (phase !== "form") return <FindingProjects name={firstName(me.name)} saving={phase === "saving"} />;

  return (
    <div className="mx-auto flex min-h-dvh max-w-2xl flex-col px-4 pt-5 sm:px-8 sm:pt-8">
      <header className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <CircleMark size={26} />
          <span className="font-display font-semibold">Comskills Circle</span>
        </div>
        <span className="tabular text-sm text-faint">
          Step {step + 1} of {STEPS.length}
        </span>
      </header>

      <div className="mb-8 h-1 overflow-hidden rounded-full bg-raised-2" aria-hidden>
        <motion.div className="h-full rounded-full bg-brass" animate={{ width: `${((step + 1) / STEPS.length) * 100}%` }} transition={{ type: "spring", stiffness: 120, damping: 20 }} />
      </div>

      <div className="relative flex-1">
        <AnimatePresence mode="wait" custom={dir} initial={false}>
          <motion.section
            key={step}
            custom={dir}
            initial={{ opacity: 0, x: dir * 32 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: dir * -32 }}
            transition={{ type: "spring", stiffness: 320, damping: 32 }}
            aria-labelledby={`step-${step}`}
          >
            <div className="mb-7">
              {step === 0 && <p className="mb-1 text-brass">Welcome, {firstName(me.name)}!</p>}
              <h1 id={`step-${step}`} className="font-display text-3xl font-semibold leading-tight">
                {STEPS[step].title}
              </h1>
              <p className="mt-1.5 text-dim">{STEPS[step].sub}</p>
            </div>

            {step === 0 && (
              <div className="space-y-7">
                <PhotoPicker name={d.name} photoUrl={photoUrl} onChange={setPhotoUrl} />
                <BasicsFields d={d} set={set} accountEmail={me.email} />
              </div>
            )}
            {step === 1 && <TechnicalFields d={d} set={set} />}
            {step === 2 && <LookingForFields d={d} set={set} />}
            {step === 3 && <VolunteeringFields d={d} set={set} />}
            {step === 4 && <ProfilePreview d={d} photoUrl={photoUrl} teamTitle={me.role === "team" ? me.teamTitle : null} batchLabel={me.batchLabel} />}
          </motion.section>
        </AnimatePresence>
      </div>

      <footer className="sticky bottom-0 -mx-4 mt-8 border-t border-line bg-night/95 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur sm:mx-0 sm:px-0">
        <ErrorText>{error}</ErrorText>
        <div className="mt-2 flex items-center justify-between gap-3">
          <Button variant="quiet" onClick={() => go(-1)} className={cx(step === 0 && "invisible")}>
            <ArrowLeft className="size-4" /> Back
          </Button>
          {step < STEPS.length - 1 ? (
            <Button size="lg" onClick={() => go(1)}>
              Continue
            </Button>
          ) : (
            <Button size="lg" onClick={finish}>
              Looks good, let's go
            </Button>
          )}
        </div>
      </footer>
    </div>
  );
}

function FindingProjects({ name, saving }: { name: string; saving: boolean }) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-6 text-center" role="status" aria-live="polite">
      <div className="relative size-40">
        {[0, 1, 2].map((i) => (
          <motion.div
            key={i}
            className="absolute inset-0 rounded-full border border-line-strong"
            style={{ scale: 1 - i * 0.22 }}
            animate={{ rotate: i % 2 ? -360 : 360 }}
            transition={{ duration: 6 + i * 3, repeat: Infinity, ease: "linear" }}
          >
            <span className="absolute -top-1.5 left-1/2 size-3 -translate-x-1/2 rounded-full" style={{ background: ["#f2c14e", "#5eead4", "#a78bfa"][i] }} />
          </motion.div>
        ))}
        <div className="absolute inset-0 grid place-items-center">
          <CircleMark size={40} spin />
        </div>
      </div>
      <h1 className="mt-10 font-display text-3xl font-semibold">{saving ? "Saving your profile…" : `Finding projects for you, ${name}…`}</h1>
      <p className="mt-2 text-dim">Comparing your skills with what the community is building.</p>
    </div>
  );
}
