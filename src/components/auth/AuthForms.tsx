"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { api, ClientError } from "@/lib/client";
import { landingFor, loginErrorMessage } from "@/lib/auth-messages";
import { passwordProblem } from "@/lib/password-rules";
import { Button, Input } from "../ui";
import { AuthShell, CodeInput, FormError, FormNote, PasswordField, ResendButton } from "./AuthParts";

const selectCls =
  "h-11 w-full appearance-none rounded-[var(--radius-field)] border border-line-strong bg-night-2 px-3.5 text-star focus:border-brass focus:outline-none focus:ring-2 focus:ring-[var(--glow)]";

const looksLikeEmail = (s: string) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(s.trim());

/** Exchanges a one-time token for a session, then goes to the right page. */
async function signInWithToken(email: string, token: string, router: ReturnType<typeof useRouter>, next: string) {
  const r = await signIn("credentials", { email, oneTimeToken: token, redirect: false });
  if (!r || r.error) throw new Error(loginErrorMessage(r?.error));
  router.replace(next);
  router.refresh();
}

/* ------------------------------------------------------------------ sign up */

export function SignupForm({ batches }: { batches: { id: string; label: string }[] }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [batch, setBatch] = useState("");
  const [saysTeam, setSaysTeam] = useState(false);
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [existing, setExisting] = useState(false);
  const [busy, setBusy] = useState(false);
  const [touched, setTouched] = useState(false);

  const pwProblem = passwordProblem(password);
  const problems = {
    name: name.trim().length < 2 ? "Enter your name." : null,
    email: !looksLikeEmail(email) ? "Enter a valid email address." : null,
    password: pwProblem,
    consent: consent ? null : "Please agree to the privacy notice.",
  };
  const firstProblem = Object.values(problems).find(Boolean) ?? null;

  async function submit(e: FormEvent) {
    e.preventDefault();
    setTouched(true);
    setError(null);
    setExisting(false);
    if (firstProblem) return setError(firstProblem);
    setBusy(true);
    try {
      await api("/api/auth/signup", "POST", { name, email, password, batch: batch || null, saysTeam, consent: true });
      router.push(`/verify?email=${encodeURIComponent(email.trim().toLowerCase())}&sent=1`);
    } catch (err) {
      if (err instanceof ClientError && err.status === 409) setExisting(true);
      setError(err instanceof Error ? err.message : "Could not create your account. Try again.");
      setBusy(false);
    }
  }

  return (
    <AuthShell
      title="Create your account"
      subtitle="For Comskills Fellowship participants and team. We'll email you a code to confirm your address."
      footer={
        <>
          Already have an account?{" "}
          <Link href="/login" className="font-medium text-brass underline-offset-4 hover:underline">
            Log in
          </Link>
        </>
      }
    >
      <form onSubmit={submit} noValidate className="space-y-5">
        <div>
          <label htmlFor="su-name" className="mb-1.5 block text-sm font-medium">
            Your name
          </label>
          <Input id="su-name" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} invalid={touched && Boolean(problems.name)} autoFocus />
        </div>
        <div>
          <label htmlFor="su-email" className="mb-1.5 block text-sm font-medium">
            Email
          </label>
          <Input
            id="su-email"
            type="email"
            inputMode="email"
            autoComplete="email"
            autoCapitalize="none"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            maxLength={200}
            invalid={touched && Boolean(problems.email)}
          />
        </div>
        <PasswordField id="su-password" value={password} onChange={setPassword} autoComplete="new-password" showStrength invalid={touched && Boolean(problems.password)} />
        <div>
          <label htmlFor="su-batch" className="mb-1.5 block text-sm font-medium">
            Which batch?
          </label>
          <select id="su-batch" className={selectCls} value={batch} onChange={(e) => setBatch(e.target.value)}>
            <option value="">{batches.length ? "Choose your batch" : "Not listed yet"}</option>
            {batches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.label}
              </option>
            ))}
          </select>
          <label className="mt-3 flex min-h-11 cursor-pointer items-center gap-3 text-sm">
            <input type="checkbox" checked={saysTeam} onChange={(e) => setSaysTeam(e.target.checked)} className="size-5 shrink-0 accent-[var(--brass)]" />
            I'm on the Comskills team
          </label>
          <p className="text-xs text-faint">This just helps the team approve you faster.</p>
        </div>
        <label className="flex min-h-11 cursor-pointer items-start gap-3 text-sm">
          <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-0.5 size-5 shrink-0 accent-[var(--brass)]" />
          <span>
            I've read the{" "}
            <Link href="/privacy" target="_blank" className="text-brass underline underline-offset-4">
              privacy notice
            </Link>{" "}
            and agree that other approved members can see my profile.
          </span>
        </label>
        <FormError>
          {error ? (
            <>
              {error}
              {existing && (
                <>
                  {" "}
                  <Link href={`/login?email=${encodeURIComponent(email.trim())}`} className="font-medium underline">
                    Log in
                  </Link>{" "}
                  or{" "}
                  <Link href={`/forgot?email=${encodeURIComponent(email.trim())}`} className="font-medium underline">
                    reset your password
                  </Link>
                  .
                </>
              )}
            </>
          ) : null}
        </FormError>
        <Button type="submit" size="lg" className="w-full" loading={busy}>
          Create account
        </Button>
      </form>
    </AuthShell>
  );
}

/* ------------------------------------------------------------------ verify */

export function VerifyForm({ email: initialEmail, justSent }: { email: string; justSent: boolean }) {
  const router = useRouter();
  const [email, setEmail] = useState(initialEmail);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(justSent ? `We sent a 6-digit code to ${initialEmail}. It works for 15 minutes.` : null);
  const [busy, setBusy] = useState(false);

  async function verify(c = code) {
    if (busy) return;
    setError(null);
    if (!looksLikeEmail(email)) return setError("Enter the email you signed up with.");
    if (!/^\d{6}$/.test(c)) return setError("Enter all 6 digits.");
    setBusy(true);
    try {
      const r = await api<{ token: string; status: string; onboarded: boolean }>("/api/auth/verify", "POST", { email, code: c });
      setNote("Email confirmed. Signing you in…");
      await signInWithToken(email, r.token, router, landingFor(r));
    } catch (err) {
      setError(err instanceof Error ? err.message : "That didn't work. Try again.");
      if (err instanceof ClientError && err.data?.codeError === "locked") setCode("");
      setBusy(false);
    }
  }

  async function resend() {
    setError(null);
    try {
      await api("/api/auth/resend", "POST", { email, purpose: "verify" });
      setNote(`If ${email} needs a code, a new one is on its way. Check spam too.`);
      setCode("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send a new code.");
      throw err;
    }
  }

  return (
    <AuthShell
      title="Check your email"
      subtitle="Enter the 6-digit code from Comskills Circle. It can take a minute to arrive."
      footer={
        <>
          Wrong email?{" "}
          <Link href="/signup" className="font-medium text-brass underline-offset-4 hover:underline">
            Sign up again
          </Link>
        </>
      }
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          verify();
        }}
        className="space-y-5"
      >
        {!initialEmail && (
          <div>
            <label htmlFor="v-email" className="mb-1.5 block text-sm font-medium">
              Email
            </label>
            <Input id="v-email" type="email" inputMode="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
        )}
        {note && <FormNote>{note}</FormNote>}
        <CodeInput value={code} onChange={setCode} onComplete={(c) => verify(c)} disabled={busy} invalid={Boolean(error)} />
        <FormError>{error}</FormError>
        <Button type="submit" size="lg" className="w-full" loading={busy}>
          Confirm email
        </Button>
        <div className="flex justify-center">
          <ResendButton onResend={resend} initialWait={justSent ? 60 : 0} />
        </div>
      </form>
    </AuthShell>
  );
}

/* ------------------------------------------------------------------ log in */

export function LoginForm({ initialEmail, reason }: { initialEmail: string; reason?: string }) {
  const router = useRouter();
  const [email, setEmail] = useState(initialEmail);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(reason === "session" ? "Your password was changed, so you were signed out. Please log in again." : null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!looksLikeEmail(email)) return setError("Enter your email address.");
    if (!password) return setError("Enter your password.");
    setBusy(true);
    try {
      const r = await signIn("credentials", { email: email.trim().toLowerCase(), password, redirect: false });
      if (r?.error === "unverified") {
        await api("/api/auth/resend", "POST", { email, purpose: "verify" }).catch(() => null);
        router.push(`/verify?email=${encodeURIComponent(email.trim().toLowerCase())}&sent=1`);
        return;
      }
      if (!r || r.error) {
        setError(loginErrorMessage(r?.error));
        setBusy(false);
        return;
      }
      router.replace("/");
      router.refresh();
    } catch {
      setError(loginErrorMessage("server"));
      setBusy(false);
    }
  }

  return (
    <AuthShell
      title="Welcome back"
      subtitle="Log in to Comskills Circle."
      footer={
        <>
          New here?{" "}
          <Link href="/signup" className="font-medium text-brass underline-offset-4 hover:underline">
            Create an account
          </Link>
        </>
      }
    >
      <form onSubmit={submit} noValidate className="space-y-5">
        <div>
          <label htmlFor="li-email" className="mb-1.5 block text-sm font-medium">
            Email
          </label>
          <Input id="li-email" type="email" inputMode="email" autoComplete="email" autoCapitalize="none" value={email} onChange={(e) => setEmail(e.target.value)} autoFocus={!initialEmail} />
        </div>
        <PasswordField id="li-password" value={password} onChange={setPassword} autoComplete="current-password" autoFocus={Boolean(initialEmail)} />
        <FormError>{error}</FormError>
        <Button type="submit" size="lg" className="w-full" loading={busy}>
          Log in
        </Button>
        <div className="text-center">
          <Link href={`/forgot${email ? `?email=${encodeURIComponent(email.trim())}` : ""}`} className="inline-flex h-11 items-center text-sm text-dim underline-offset-4 hover:text-star hover:underline">
            Forgot your password?
          </Link>
        </div>
      </form>
    </AuthShell>
  );
}

/* ------------------------------------------------------------------ forgot */

export function ForgotForm({ initialEmail }: { initialEmail: string }) {
  const router = useRouter();
  const [email, setEmail] = useState(initialEmail);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!looksLikeEmail(email)) return setError("Enter your email address.");
    setBusy(true);
    try {
      await api("/api/auth/forgot", "POST", { email });
      router.push(`/reset?email=${encodeURIComponent(email.trim().toLowerCase())}&sent=1`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send a code. Try again.");
      setBusy(false);
    }
  }

  return (
    <AuthShell
      title="Reset your password"
      subtitle="Enter your email and we'll send a 6-digit code."
      footer={
        <Link href="/login" className="font-medium text-brass underline-offset-4 hover:underline">
          Back to log in
        </Link>
      }
    >
      <form onSubmit={submit} noValidate className="space-y-5">
        <div>
          <label htmlFor="fg-email" className="mb-1.5 block text-sm font-medium">
            Email
          </label>
          <Input id="fg-email" type="email" inputMode="email" autoComplete="email" autoCapitalize="none" value={email} onChange={(e) => setEmail(e.target.value)} autoFocus />
        </div>
        <FormError>{error}</FormError>
        <Button type="submit" size="lg" className="w-full" loading={busy}>
          Send code
        </Button>
      </form>
    </AuthShell>
  );
}

/* ------------------------------------------------------------------ reset */

export function ResetForm({ email: initialEmail, justSent }: { email: string; justSent: boolean }) {
  const router = useRouter();
  const [email, setEmail] = useState(initialEmail);
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(justSent ? "If that email has an account, we sent a code. Check your inbox (and spam)." : null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!looksLikeEmail(email)) return setError("Enter your email address.");
    if (!/^\d{6}$/.test(code)) return setError("Enter all 6 digits of the code.");
    const p = passwordProblem(password);
    if (p) return setError(p);
    setBusy(true);
    try {
      const r = await api<{ token: string }>("/api/auth/reset", "POST", { email, code, password });
      setNote("Password changed. Other devices have been signed out. Signing you in…");
      await signInWithToken(email, r.token, router, "/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "That didn't work. Try again.");
      setBusy(false);
    }
  }

  async function resend() {
    setError(null);
    try {
      await api("/api/auth/resend", "POST", { email, purpose: "reset" });
      setNote("If that email has an account, a new code is on its way.");
      setCode("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send a new code.");
      throw err;
    }
  }

  return (
    <AuthShell
      title="Choose a new password"
      subtitle="Enter the code we emailed you and a new password."
      footer={
        <Link href="/login" className="font-medium text-brass underline-offset-4 hover:underline">
          Back to log in
        </Link>
      }
    >
      <form onSubmit={submit} noValidate className="space-y-5">
        {!initialEmail && (
          <div>
            <label htmlFor="rs-email" className="mb-1.5 block text-sm font-medium">
              Email
            </label>
            <Input id="rs-email" type="email" inputMode="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
        )}
        {note && <FormNote>{note}</FormNote>}
        <CodeInput value={code} onChange={setCode} disabled={busy} />
        <PasswordField id="rs-password" label="New password" value={password} onChange={setPassword} autoComplete="new-password" showStrength />
        <FormError>{error}</FormError>
        <Button type="submit" size="lg" className="w-full" loading={busy}>
          Save new password
        </Button>
        <div className="flex justify-center">
          <ResendButton onResend={resend} initialWait={justSent ? 60 : 0} />
        </div>
      </form>
    </AuthShell>
  );
}
