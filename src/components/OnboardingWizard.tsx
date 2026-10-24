"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import confetti from "canvas-confetti";
import { ArrowLeft } from "lucide-react";
import type { MeDTO } from "@/lib/types";
import { SUGGESTED_LOCATIONS, SUGGESTED_ROLES, SUGGESTED_SKILLS } from "@/lib/taxonomy";
import { api, firstName } from "@/lib/client";
import { CircleMark } from "./bits";
import { Avatar, Button, ChipInput, ErrorText, Input, Label, Textarea, Toggle, cx } from "./ui";
import { draftFromMe, FieldPicker, LinksFields, linksValid, ProfilePreview, VisibilityPicker, type ProfileDraft } from "./ProfileParts";

const HEADLINE_EXAMPLES = ["Applied AI for digital health", "Neuroscience research, then a PhD", "Climate data for cities", "Frugal tech for public health"];

const STEPS = ["Hello", "Your direction", "Practicalities", "Privacy", "Links & help"] as const;

export function OnboardingWizard({ me }: { me: MeDTO }) {
  const router = useRouter();
  const [d, setD] = useState<ProfileDraft>(() => ({ ...draftFromMe(me), visibility: me.visibility || "class" }));
  const [step, setStep] = useState(0);
  const [dir, setDir] = useState(1);
  const [phIndex, setPhIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [phase, setPhase] = useState<"form" | "saving" | "matching">("form");

  useEffect(() => {
    const t = setInterval(() => setPhIndex((i) => (i + 1) % HEADLINE_EXAMPLES.length), 2600);
    return () => clearInterval(t);
  }, []);

  const set = <K extends keyof ProfileDraft>(k: K, v: ProfileDraft[K]) => setD((p) => ({ ...p, [k]: v }));

  const canNext = [
    d.headline.trim().length >= 3,
    d.summary.trim().length >= 20 && d.fields.length > 0,
    true,
    true,
    linksValid(d.links),
  ][step];
  const hint = [
    "Add a short headline to continue.",
    d.fields.length === 0 ? "Pick at least one field — it's how matching starts." : "Write a sentence or two about where you're heading.",
    "",
    "",
    "Fix the links marked in red.",
  ][step];

  const go = (delta: number) => {
    setError(null);
    setDir(delta);
    setStep((s) => Math.min(STEPS.length - 1, Math.max(0, s + delta)));
  };

  async function finish() {
    setError(null);
    setPhase("saving");
    try {
      await api("/api/me", "PATCH", {
        ...d,
        collaborateOn: d.visibility === "open" ? d.collaborateOn : "",
        links: Object.fromEntries(Object.entries(d.links).filter(([, v]) => v)),
        onboarded: true,
      });
      confetti({ particleCount: 110, spread: 75, origin: { y: 0.7 }, colors: ["#f2c14e", "#5eead4", "#a78bfa", "#eef0ff"], disableForReducedMotion: true });
      setPhase("matching");
      const started = Date.now();
      await api("/api/me/rematch", "POST").catch(() => null);
      // Let the orbit play at least briefly so the moment registers
      const wait = Math.max(0, 1600 - (Date.now() - started));
      setTimeout(() => {
        router.replace("/matches?welcome=1");
        router.refresh();
      }, wait);
    } catch (e) {
      setPhase("form");
      setError(e instanceof Error ? e.message : "Could not save. Try again.");
    }
  }

  if (phase !== "form") return <FindingMatches name={firstName(me.name)} saving={phase === "saving"} />;

  return (
    <div className="mx-auto flex min-h-dvh max-w-2xl flex-col px-5 py-8 sm:px-8">
      <header className="mb-10 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <CircleMark size={28} />
          <span className="font-display text-lg font-semibold">Comskills Circle</span>
        </div>
        <span className="tabular text-sm text-faint">
          Step {step + 1} of {STEPS.length}
        </span>
      </header>

      <div className="mb-10 h-1 overflow-hidden rounded-full bg-raised-2" aria-hidden>
        <motion.div className="h-full rounded-full bg-brass" animate={{ width: `${((step + 1) / STEPS.length) * 100}%` }} transition={{ type: "spring", stiffness: 120, damping: 20 }} />
      </div>

      <div className="relative flex-1">
        <AnimatePresence mode="wait" custom={dir} initial={false}>
          <motion.section
            key={step}
            custom={dir}
            initial={{ opacity: 0, x: dir * 40 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: dir * -40 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            aria-labelledby={`step-${step}`}
          >
            {step === 0 && (
              <div>
                <div className="mb-8 flex items-center gap-4">
                  <Avatar name={me.name} src={me.photoUrl} size={56} />
                  <div>
                    <h1 id="step-0" className="font-display text-3xl font-semibold">
                      Hi {firstName(me.name)}.
                    </h1>
                    <p className="text-dim">Two minutes, and Comskills Circle can start finding things for you.</p>
                  </div>
                </div>
                <Label htmlFor="headline" hint={`${d.headline.length}/80`}>
                  In a few words, where are you heading?
                </Label>
                <div className="relative">
                  <Input id="headline" maxLength={80} autoFocus value={d.headline} onChange={(e) => set("headline", e.target.value)} className="h-13 text-lg" />
                  {!d.headline && (
                    <AnimatePresence mode="wait">
                      <motion.span
                        key={phIndex}
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -6 }}
                        className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-lg text-faint"
                      >
                        {HEADLINE_EXAMPLES[phIndex]}
                      </motion.span>
                    </AnimatePresence>
                  )}
                </div>
              </div>
            )}

            {step === 1 && (
              <div className="space-y-8">
                <div>
                  <h1 id="step-1" className="font-display text-3xl font-semibold">
                    Your direction
                  </h1>
                  <p className="mt-1 text-dim">The more specific you are, the better your matches.</p>
                </div>
                <div>
                  <Label htmlFor="summary" hint={`${d.summary.length}/800`}>
                    What do you want to be doing in three years, and what kind of internship would get you there?
                  </Label>
                  <Textarea
                    id="summary"
                    maxLength={800}
                    rows={5}
                    value={d.summary}
                    onChange={(e) => set("summary", e.target.value)}
                    placeholder="For example: I want to build AI tools for early disease detection. I'm looking for a 6-month lab internship in Paris working with health data."
                  />
                </div>
                <div>
                  <Label>Fields you care about</Label>
                  <FieldPicker value={d.fields} onChange={(v) => set("fields", v)} headline={d.headline} summary={d.summary} />
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-8">
                <div>
                  <h1 id="step-2" className="font-display text-3xl font-semibold">
                    Practicalities
                  </h1>
                  <p className="mt-1 text-dim">Used to rank matches and warn you about mismatches.</p>
                </div>
                <div>
                  <Label>Kinds of roles</Label>
                  <ChipInput values={d.targetRoles} onChange={(v) => set("targetRoles", v)} suggestions={SUGGESTED_ROLES} max={6} placeholder="Add a role…" />
                </div>
                <div>
                  <Label>Where</Label>
                  <ChipInput values={d.preferredLocations} onChange={(v) => set("preferredLocations", v)} suggestions={SUGGESTED_LOCATIONS} max={8} placeholder="Add a city or region…" />
                </div>
                <div className="rounded-2xl border border-line p-4">
                  <Toggle
                    checked={d.openToFrench}
                    onChange={(v) => set("openToFrench", v)}
                    label="I'm open to internships in French"
                    description="If off, roles that require French won't be matched to you (you'll still see them in Opportunities)."
                  />
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="space-y-6">
                <div>
                  <h1 id="step-3" className="font-display text-3xl font-semibold">
                    Who can see your profile?
                  </h1>
                  <p className="mt-1 text-dim">You get matches either way. Change this any time in Settings.</p>
                </div>
                <div className="grid gap-5 md:grid-cols-[1.2fr_1fr]">
                  <VisibilityPicker value={d.visibility} onChange={(v) => set("visibility", v)} />
                  <ProfilePreview d={d} name={me.name} photoUrl={me.photoUrl} />
                </div>
              </div>
            )}

            {step === 4 && (
              <div className="space-y-8">
                <div>
                  <h1 id="step-4" className="font-display text-3xl font-semibold">
                    Links & help
                  </h1>
                  <p className="mt-1 text-dim">All optional. Links only — Comskills Circle never stores files.</p>
                </div>
                <LinksFields links={d.links} onChange={(l) => set("links", l)} />
                <div>
                  <Label>I can help members with</Label>
                  <ChipInput values={d.skillsOffered} onChange={(v) => set("skillsOffered", v)} suggestions={SUGGESTED_SKILLS} max={10} placeholder="Add a skill…" />
                  {d.visibility !== "open" && <p className="mt-2 text-sm text-faint">Shown only if your profile is Open to collaborate.</p>}
                </div>
                {d.visibility === "open" && (
                  <div>
                    <Label htmlFor="collab" hint={`${d.collaborateOn.length}/200`}>
                      Looking to collaborate on
                    </Label>
                    <Input id="collab" maxLength={200} value={d.collaborateOn} onChange={(e) => set("collaborateOn", e.target.value)} placeholder="A hackathon team for climate data, a reading group on AI ethics…" />
                  </div>
                )}
              </div>
            )}
          </motion.section>
        </AnimatePresence>
      </div>

      <footer className="sticky bottom-0 mt-10 flex items-center justify-between gap-3 border-t border-line bg-night/90 py-4 backdrop-blur">
        <Button variant="quiet" onClick={() => go(-1)} className={cx(step === 0 && "invisible")}>
          <ArrowLeft className="size-4" /> Back
        </Button>
        <div className="flex flex-col items-end">
          {step < STEPS.length - 1 ? (
            <Button size="lg" onClick={() => go(1)} disabled={!canNext}>
              Continue
            </Button>
          ) : (
            <Button size="lg" onClick={finish} disabled={!canNext}>
              Find my matches
            </Button>
          )}
          {!canNext && hint && <p className="mt-2 text-xs text-faint">{hint}</p>}
          <ErrorText>{error}</ErrorText>
        </div>
      </footer>
    </div>
  );
}

function FindingMatches({ name, saving }: { name: string; saving: boolean }) {
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
      <h1 className="mt-10 font-display text-3xl font-semibold">{saving ? "Saving your profile…" : `Finding your matches, ${name}…`}</h1>
      <p className="mt-2 text-dim">Comparing your direction with everything your class has shared.</p>
    </div>
  );
}
