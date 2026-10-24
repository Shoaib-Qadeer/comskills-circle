"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState, type ClipboardEvent, type KeyboardEvent, type ReactNode } from "react";
import { motion } from "motion/react";
import { Eye, EyeOff } from "lucide-react";
import { passwordStrength } from "@/lib/password-rules";
import { CircleMark } from "../bits";
import { cx, Input } from "../ui";

/** Centered card used by every signed-out screen. Mobile-first: full width with a 16 px gutter. */
export function AuthShell({ title, subtitle, children, footer }: { title: ReactNode; subtitle?: ReactNode; children: ReactNode; footer?: ReactNode }) {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-4 py-6 sm:py-10">
      <Link href="/" className="mb-8 flex items-center gap-2.5 self-start rounded-full py-1 pr-2" aria-label="Comskills Circle home">
        <CircleMark size={28} />
        <span className="font-display text-lg font-semibold">Comskills Circle</span>
      </Link>
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ type: "spring", stiffness: 260, damping: 26 }}>
        <h1 className="font-display text-3xl font-semibold leading-tight">{title}</h1>
        {subtitle && <p className="mt-2 text-dim">{subtitle}</p>}
        <div className="mt-7">{children}</div>
      </motion.div>
      {footer && <div className="mt-8 text-sm text-dim">{footer}</div>}
    </div>
  );
}

/** Password input with a show/hide toggle and (optionally) a strength hint. */
export function PasswordField({
  id,
  value,
  onChange,
  autoComplete,
  showStrength,
  invalid,
  autoFocus,
  label = "Password",
}: {
  id: string;
  value: string;
  onChange: (v: string) => void;
  autoComplete: "current-password" | "new-password";
  showStrength?: boolean;
  invalid?: boolean;
  autoFocus?: boolean;
  label?: string;
}) {
  const [show, setShow] = useState(false);
  const s = passwordStrength(value);
  const hintId = `${id}-hint`;
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium">
        {label}
      </label>
      <div className="relative">
        <Input
          id={id}
          type={show ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoComplete={autoComplete}
          autoFocus={autoFocus}
          invalid={invalid}
          aria-describedby={showStrength ? hintId : undefined}
          className="pr-12"
          maxLength={200}
        />
        <button
          type="button"
          onClick={() => setShow((v) => !v)}
          aria-label={show ? "Hide password" : "Show password"}
          aria-pressed={show}
          className="absolute right-0.5 top-1/2 grid size-11 -translate-y-1/2 place-items-center rounded-full text-dim hover:text-star"
        >
          {show ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
        </button>
      </div>
      {showStrength && (
        <div id={hintId} className="mt-2" aria-live="polite">
          <div className="flex gap-1" aria-hidden>
            {[1, 2, 3].map((i) => (
              <span
                key={i}
                className={cx(
                  "h-1 flex-1 rounded-full transition-colors",
                  value && s.score >= i ? (s.score === 1 ? "bg-ember" : s.score === 2 ? "bg-brass" : "bg-aurora") : "bg-raised-2",
                )}
              />
            ))}
          </div>
          <p className="mt-1.5 text-xs text-dim">{value ? `${s.label}. ${s.hint}` : "At least 10 characters. A short phrase works well."}</p>
        </div>
      )}
    </div>
  );
}

/** Six digit boxes with paste support, arrow keys and backspace. Calls onComplete when full. */
export function CodeInput({ value, onChange, onComplete, disabled, invalid }: { value: string; onChange: (v: string) => void; onComplete?: (v: string) => void; disabled?: boolean; invalid?: boolean }) {
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  const groupId = useId();
  const digits = Array.from({ length: 6 }, (_, i) => value[i] ?? "");

  useEffect(() => {
    refs.current[0]?.focus();
  }, []);

  // The value is always a run of up to 6 digits with no gaps, so boxes fill left to right.
  function update(next: string, focusAt: number) {
    const clean = next.replace(/\D/g, "").slice(0, 6);
    onChange(clean);
    refs.current[Math.max(0, Math.min(5, focusAt))]?.focus();
    if (clean.length === 6) onComplete?.(clean);
  }

  function onKey(i: number, e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace") {
      e.preventDefault();
      if (digits[i]) update(value.slice(0, i) + value.slice(i + 1), i);
      else if (i > 0) update(value.slice(0, i - 1) + value.slice(i), i - 1);
    } else if (e.key === "ArrowLeft" && i > 0) {
      e.preventDefault();
      refs.current[i - 1]?.focus();
    } else if (e.key === "ArrowRight" && i < 5) {
      e.preventDefault();
      refs.current[i + 1]?.focus();
    }
  }

  function onPaste(e: ClipboardEvent<HTMLInputElement>) {
    const t = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (!t) return;
    e.preventDefault();
    onChange(t);
    refs.current[Math.min(5, t.length)]?.focus();
    if (t.length === 6) onComplete?.(t);
  }

  return (
    <div role="group" aria-labelledby={`${groupId}-label`}>
      <span id={`${groupId}-label`} className="mb-2 block text-sm font-medium">
        6-digit code
      </span>
      <div className="flex justify-between gap-2">
        {digits.map((d, i) => (
          <input
            key={i}
            ref={(el) => {
              refs.current[i] = el;
            }}
            value={d.trim()}
            disabled={disabled}
            inputMode="numeric"
            autoComplete={i === 0 ? "one-time-code" : "off"}
            pattern="[0-9]*"
            maxLength={6}
            aria-label={`Digit ${i + 1} of 6`}
            onKeyDown={(e) => onKey(i, e)}
            onPaste={onPaste}
            onFocus={(e) => {
              // Don't leave gaps: jump to the first empty box
              if (i > value.length) refs.current[value.length]?.focus();
              else e.currentTarget.select();
            }}
            onChange={(e) => {
              const v = e.target.value.replace(/\D/g, "");
              if (!v) return;
              // Several digits at once = keyboard or SMS autofill put the whole code in one box
              const typed = v.length > 1 ? v : v;
              const next = value.slice(0, i) + typed + value.slice(i + typed.length);
              update(next, i + typed.length);
            }}
            className={cx(
              "h-14 w-full min-w-0 rounded-[var(--radius-field)] border bg-night-2 text-center font-display text-2xl font-semibold tabular text-star transition-colors focus:border-brass focus:outline-none focus:ring-2 focus:ring-[var(--glow)]",
              invalid ? "border-ember" : "border-line-strong",
            )}
          />
        ))}
      </div>
    </div>
  );
}

/** A resend button with a visible countdown. */
export function ResendButton({ onResend, initialWait = 0 }: { onResend: () => Promise<void>; initialWait?: number }) {
  const [wait, setWait] = useState(initialWait);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (wait <= 0) return;
    const t = setTimeout(() => setWait((w) => w - 1), 1000);
    return () => clearTimeout(t);
  }, [wait]);
  return (
    <button
      type="button"
      disabled={wait > 0 || busy}
      onClick={async () => {
        setBusy(true);
        try {
          await onResend();
          setWait(60);
        } finally {
          setBusy(false);
        }
      }}
      className="inline-flex h-11 items-center rounded-full px-1 text-sm font-medium text-brass underline-offset-4 hover:underline disabled:text-faint disabled:no-underline"
    >
      {busy ? "Sending…" : wait > 0 ? `Send a new code in ${wait}s` : "Send a new code"}
    </button>
  );
}

export function FormError({ children }: { children: ReactNode }) {
  return (
    <div aria-live="assertive" className="min-h-0">
      {children ? (
        <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} role="alert" className="rounded-xl border border-ember/40 bg-ember/10 px-3.5 py-2.5 text-sm text-ember">
          {children}
        </motion.p>
      ) : null}
    </div>
  );
}

export function FormNote({ children }: { children: ReactNode }) {
  return (
    <p aria-live="polite" className="rounded-xl border border-aurora/40 bg-aurora/10 px-3.5 py-2.5 text-sm text-aurora">
      {children}
    </p>
  );
}
