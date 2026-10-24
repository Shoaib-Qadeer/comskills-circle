"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import useSWR, { mutate as globalMutate } from "swr";
import { AnimatePresence, motion } from "motion/react";
import confetti from "canvas-confetti";
import { ClipboardPaste, Link2, Search, Sparkles, Undo2, Check } from "lucide-react";
import type { ExtractedDraft, PersonDTO } from "@/lib/types";
import { api, ClientError, daysLeft, firstName, timeAgo } from "@/lib/client";
import { CountUp } from "./bits";
import { Avatar, Button, ErrorText, Input, Label, PageHeader, Panel, Skeleton, Textarea, cx } from "./ui";
import { DraftEditor, emptyDraft } from "./DraftEditor";

type ExtractRes =
  | { kind: "duplicate"; opportunityId: string; postedByName: string | null; createdAt: string }
  | { kind: "needsPaste"; reason: string }
  | { kind: "draft"; draft: ExtractedDraft; llm: boolean };

type Stage = "input" | "reading" | "paste" | "duplicate" | "review" | "done";

const READING_LINES = ["Reading the page…", "Finding the deadline…", "Spotting the fields…", "Checking the language…"];

const looksLikeUrl = (s: string) => /^https?:\/\/\S+\.\S+/.test(s.trim());

export function PostFlow() {
  const router = useRouter();
  const params = useSearchParams();
  const [stage, setStage] = useState<Stage>("input");
  const [url, setUrl] = useState("");
  const [pasted, setPasted] = useState("");
  const [pasteReason, setPasteReason] = useState("");
  const [glow, setGlow] = useState(false);
  const [readingLine, setReadingLine] = useState(0);
  const [draft, setDraft] = useState<ExtractedDraft | null>(null);
  const [llm, setLlm] = useState(true);
  const [dup, setDup] = useState<Extract<ExtractRes, { kind: "duplicate" }> | null>(null);
  const [tagged, setTagged] = useState<string[]>(() => (params.get("tag") ? [params.get("tag")!] : []));
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [result, setResult] = useState<{ id: string; matchCount: number; firstPost: boolean } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (stage !== "reading") return;
    const t = setInterval(() => setReadingLine((i) => (i + 1) % READING_LINES.length), 1400);
    return () => clearInterval(t);
  }, [stage]);

  async function extract(withText?: string) {
    setError(null);
    setStage("reading");
    setReadingLine(0);
    try {
      const r = await api<ExtractRes>("/api/opportunities/extract", "POST", {
        url: url.trim() || undefined,
        pastedText: withText || undefined,
      });
      if (r.kind === "duplicate") {
        setDup(r);
        setStage("duplicate");
      } else if (r.kind === "needsPaste") {
        setPasteReason(r.reason);
        setStage("paste");
      } else {
        setDraft({ ...r.draft, url: r.draft.url || url.trim() });
        setLlm(r.llm);
        setStage("review");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not read that link");
      setStage(withText ? "paste" : "input");
    }
  }

  async function publish() {
    if (!draft) return;
    setError(null);
    if (!looksLikeUrl(draft.url)) return setError("Add the link to the posting so classmates can apply.");
    if (draft.title.trim().length < 2) return setError("Add a title.");
    setPublishing(true);
    try {
      const r = await api<{ id: string; matchCount: number; firstPost: boolean }>("/api/opportunities", "POST", {
        ...draft,
        taggedFor: tagged,
        posterNote: note.trim() || null,
      });
      setResult(r);
      setStage("done");
      globalMutate("/api/notifications");
      if (r.firstPost) {
        setTimeout(() => confetti({ particleCount: 120, spread: 80, origin: { y: 0.6 }, colors: ["#f2c14e", "#5eead4", "#a78bfa", "#eef0ff"], disableForReducedMotion: true }), 500);
        router.refresh();
      }
    } catch (e) {
      if (e instanceof ClientError && e.status === 409 && e.data?.opportunityId) {
        setDup({ kind: "duplicate", opportunityId: String(e.data.opportunityId), postedByName: null, createdAt: new Date().toISOString() });
        setStage("duplicate");
      } else setError(e instanceof Error ? e.message : "Could not publish");
    } finally {
      setPublishing(false);
    }
  }

  function reset() {
    setStage("input");
    setUrl("");
    setPasted("");
    setDraft(null);
    setTagged([]);
    setNote("");
    setResult(null);
    setError(null);
    setTimeout(() => inputRef.current?.focus(), 50);
  }

  return (
    <div className="mx-auto max-w-3xl">
      {stage !== "done" && <PageHeader title="Share an opportunity" subtitle="Paste a link. Compass reads it and sends it to every classmate it fits." />}

      <AnimatePresence mode="wait">
        {(stage === "input" || stage === "reading" || stage === "paste") && (
          <motion.div key="in" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
            <Panel className="p-5 sm:p-6">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (looksLikeUrl(url)) extract();
                }}
                className="flex flex-col gap-3 sm:flex-row"
              >
                <div className="relative flex-1">
                  <Link2 className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-faint" />
                  <Input
                    ref={inputRef}
                    autoFocus
                    type="url"
                    inputMode="url"
                    aria-label="Link to the opportunity"
                    placeholder="https://… link to the posting"
                    value={url}
                    disabled={stage === "reading"}
                    onChange={(e) => {
                      setUrl(e.target.value);
                      setGlow(looksLikeUrl(e.target.value));
                    }}
                    onPaste={(e) => {
                      const t = e.clipboardData.getData("text");
                      if (looksLikeUrl(t)) setGlow(true);
                    }}
                    className="h-14 pl-12 text-base"
                  />
                </div>
                <Button
                  type="submit"
                  size="lg"
                  className={cx("h-14", glow && stage === "input" && "fab-pulse")}
                  disabled={!looksLikeUrl(url) || stage === "reading"}
                  loading={stage === "reading"}
                >
                  <Search className="size-4" /> Fetch details
                </Button>
              </form>
              <ErrorText>{error && stage !== "paste" ? error : null}</ErrorText>

              <AnimatePresence>
                {stage === "reading" && (
                  <motion.div key="reading" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                    <div className="mt-6 space-y-4 rounded-2xl border border-line p-5" role="status" aria-live="polite">
                      <AnimatePresence mode="wait">
                        <motion.p key={readingLine} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} className="flex items-center gap-2 text-sm text-brass">
                          <Sparkles className="size-4" />
                          {READING_LINES[readingLine]}
                        </motion.p>
                      </AnimatePresence>
                      <Skeleton className="h-7 w-3/4" />
                      <div className="flex gap-2">
                        <Skeleton className="h-5 w-24" />
                        <Skeleton className="h-5 w-20" />
                        <Skeleton className="h-5 w-28" />
                      </div>
                      <Skeleton className="h-16 w-full" />
                    </div>
                  </motion.div>
                )}

                {stage === "paste" && (
                  <motion.div key="paste" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                    <div className="mt-6">
                      <p className="mb-3 flex items-start gap-2 text-sm">
                        <ClipboardPaste className="mt-0.5 size-4 shrink-0 text-brass" />
                        <span>
                          {pasteReason} Copy the text of the posting from the page and paste it here — Compass will read it the same way.
                        </span>
                      </p>
                      <Textarea autoFocus rows={8} value={pasted} onChange={(e) => setPasted(e.target.value)} placeholder="Paste the posting text…" maxLength={30000} />
                      <ErrorText>{error}</ErrorText>
                      <div className="mt-4 flex flex-wrap justify-end gap-2">
                        <Button variant="quiet" onClick={() => { setDraft(emptyDraft(url.trim())); setLlm(false); setStage("review"); }}>
                          Fill in by hand
                        </Button>
                        <Button onClick={() => extract(pasted)} disabled={pasted.trim().length < 40}>
                          Read this text
                        </Button>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </Panel>
          </motion.div>
        )}

        {stage === "duplicate" && dup && (
          <motion.div key="dup" initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}>
            <Panel className="p-6 text-center sm:p-10">
              <div className="mx-auto mb-4 grid size-12 place-items-center rounded-full bg-aurora/15 text-aurora">
                <Check className="size-6" />
              </div>
              <h2 className="font-display text-2xl font-semibold">Already shared</h2>
              <p className="mt-2 text-dim">
                {dup.postedByName ? `${firstName(dup.postedByName)} shared this ${timeAgo(dup.createdAt)}` : "Someone in the class already shared this"}, so the right classmates have it.
              </p>
              <div className="mt-6 flex flex-wrap justify-center gap-2">
                <Link href={`/opportunities?open=${dup.opportunityId}`} className="inline-flex h-10 items-center rounded-full bg-brass px-4 text-sm font-medium text-brass-ink">
                  View it
                </Link>
                <Button variant="ghost" onClick={reset}>
                  Share something else
                </Button>
              </div>
            </Panel>
          </motion.div>
        )}

        {stage === "review" && draft && (
          <motion.div key="review" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -40, scale: 0.9 }} transition={{ type: "spring", stiffness: 220, damping: 26 }}>
            <Panel className="p-5 sm:p-7">
              <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
                <p className="flex items-center gap-2 text-sm text-dim">
                  {llm ? (
                    <>
                      <Sparkles className="size-4 text-brass" /> Check the details — everything is editable.
                    </>
                  ) : (
                    "Automatic reading isn't available right now. Fill in what you know."
                  )}
                </p>
                <Button variant="quiet" size="sm" onClick={reset}>
                  <Undo2 className="size-4" /> Start over
                </Button>
              </div>
              <div className="mb-5">
                <Label htmlFor="d-url">Link</Label>
                <Input id="d-url" type="url" value={draft.url} onChange={(e) => setDraft({ ...draft, url: e.target.value })} placeholder="https://…" />
              </div>
              <DraftEditor d={draft} onChange={setDraft} />
            </Panel>

            <TagClassmates selected={tagged} onChange={setTagged} note={note} onNote={setNote} />

            <div className="sticky bottom-20 z-10 mt-6 flex flex-wrap items-center justify-end gap-3 rounded-full border border-line-strong bg-raised/95 py-2 pl-5 pr-2 shadow-2xl backdrop-blur lg:bottom-6">
              <span className="mr-auto text-sm text-dim">{error ? (
                  <span className="text-ember">{error}</span>
                ) : draft.deadline && (daysLeft(draft.deadline) ?? 0) < 0 ? (
                  <span className="text-brass">This deadline has passed, so it will go straight to the Archive.</span>
                ) : (
                  "Looks right? It goes to everyone it fits."
                )}</span>
              <Button size="lg" loading={publishing} onClick={publish}>
                Publish to the class
              </Button>
            </div>
          </motion.div>
        )}

        {stage === "done" && result && draft && <Done key="done" title={draft.title} result={result} onAnother={reset} />}
      </AnimatePresence>
    </div>
  );
}

function TagClassmates({ selected, onChange, note, onNote }: { selected: string[]; onChange: (v: string[]) => void; note: string; onNote: (v: string) => void }) {
  const { data } = useSWR<{ people: PersonDTO[]; privateCount: number }>("/api/people");
  const [q, setQ] = useState("");
  const people = useMemo(() => (data?.people ?? []).filter((p) => !p.isMe), [data]);
  const shown = people.filter((p) => !q || p.name.toLowerCase().includes(q.toLowerCase()) || p.headline.toLowerCase().includes(q.toLowerCase()));
  return (
    <Panel className="mt-6 p-5 sm:p-7">
      <h2 className="font-display text-lg font-semibold">Thought of someone?</h2>
      <p className="mt-1 text-sm text-dim">Optional. They’ll see it first, with your note. Compass still finds everyone else it fits.</p>
      {people.length > 6 && <Input className="mt-4" placeholder="Search classmates…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search classmates" />}
      <div className="mt-4 flex flex-wrap gap-2">
        {!data ? (
          <Skeleton className="h-10 w-full" />
        ) : people.length === 0 ? (
          <p className="text-sm text-faint">No visible classmates yet.</p>
        ) : (
          shown.map((p) => {
            const on = selected.includes(p.id);
            return (
              <motion.button
                key={p.id}
                type="button"
                whileTap={{ scale: 0.95 }}
                onClick={() => onChange(on ? selected.filter((x) => x !== p.id) : [...selected, p.id])}
                aria-pressed={on}
                className={cx("flex h-10 items-center gap-2 rounded-full border pl-1 pr-3 text-sm transition-colors", on ? "border-brass bg-brass/10" : "border-line-strong hover:bg-raised-2")}
              >
                <Avatar name={p.name} src={p.photoUrl} size={30} ring={on ? "brass" : undefined} />
                {firstName(p.name)}
                {on && <Check className="size-3.5 text-brass" />}
              </motion.button>
            );
          })
        )}
      </div>
      {data && data.privateCount > 0 && <p className="mt-3 text-xs text-faint">{data.privateCount} classmates keep their profiles private — they can still be matched automatically.</p>}
      <AnimatePresence>
        {selected.length > 0 && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
            <Label htmlFor="note" hint={`${note.length}/200`} className="mt-5">
              A note for them
            </Label>
            <Input id="note" maxLength={200} value={note} onChange={(e) => onNote(e.target.value)} placeholder="This sounds like your thesis idea!" />
          </motion.div>
        )}
      </AnimatePresence>
    </Panel>
  );
}

function Done({ title, result, onAnother }: { title: string; result: { id: string; matchCount: number }; onAnother: () => void }) {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center py-10 text-center">
      {/* The posted card drops onto the class stack */}
      <div className="relative mb-12 h-36 w-full max-w-sm">
        {[2, 1].map((i) => (
          <div key={i} className="absolute inset-x-0 top-0 mx-auto h-28 rounded-[var(--radius-panel)] border border-line bg-raised/60" style={{ transform: `translateY(${i * 12}px) scale(${1 - i * 0.05})` }} />
        ))}
        <motion.div
          initial={{ y: -120, opacity: 0, rotate: -6, scale: 1.05 }}
          animate={{ y: 0, opacity: 1, rotate: 0, scale: 1 }}
          transition={{ type: "spring", stiffness: 180, damping: 16 }}
          className="absolute inset-x-0 top-0 mx-auto flex h-28 items-center rounded-[var(--radius-panel)] border border-brass/50 bg-raised px-6 text-left shadow-[0_20px_60px_-25px_var(--glow)]"
        >
          <p className="line-clamp-2 font-display text-lg font-semibold">{title}</p>
        </motion.div>
      </div>
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}>
        <h1 className="font-display text-3xl font-semibold sm:text-4xl">Published</h1>
        <p className="mt-4 text-lg">
          {result.matchCount > 0 ? (
            <>
              Relevant to <CountUp value={result.matchCount} className="font-display text-4xl font-semibold text-brass" /> classmate{result.matchCount === 1 ? "" : "s"}
            </>
          ) : (
            "It’s on the board for everyone to browse."
          )}
        </p>
        <p className="mt-2 text-sm text-dim">{result.matchCount > 0 ? "They’ll see it in their matches. Compass never shows you who." : "No strong matches yet — new classmates will be matched as they join."}</p>
        <div className="mt-8 flex flex-wrap justify-center gap-2">
          <Button onClick={onAnother}>Share another</Button>
          <Link href={`/opportunities?open=${result.id}`} className="inline-flex h-10 items-center rounded-full border border-line-strong px-4 text-sm font-medium hover:bg-raised-2">
            View it
          </Link>
        </div>
      </motion.div>
    </motion.div>
  );
}
