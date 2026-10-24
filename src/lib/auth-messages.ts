// Client-safe copies of the sign-in error messages (the server throws the keys).
export const LOGIN_ERROR_MESSAGES: Record<string, string> = {
  invalid: "Email or password is incorrect.",
  unverified: "Please confirm your email first. We've sent you a new code.",
  locked: "Too many tries. Wait 15 minutes, or reset your password.",
  token: "That sign-in link has expired. Please log in with your password.",
  server: "We couldn't reach the server. Try again in a minute.",
  CredentialsSignin: "Email or password is incorrect.",
};

/** Messages for errors coming back from Google sign-in (next-auth puts them in ?error=). */
export const GOOGLE_ERROR_MESSAGES: Record<string, string> = {
  GoogleUnverified: "Google says that email isn't verified yet. Verify it with Google, then try again.",
  AccessDenied: "Sign-in was cancelled or not allowed. Try again.",
  OAuthSignin: "We couldn't start Google sign-in. Try again in a minute.",
  OAuthCallback: "Google sign-in didn't finish. Try again (and allow the popup or redirect).",
  Callback: "Google sign-in didn't finish. Try again.",
  Configuration: "Google sign-in isn't set up correctly yet. Please tell the Comskills team.",
  Server: "We couldn't reach the server. Try again in a minute.",
  SessionRequired: "Please sign in first.",
};

export function googleErrorMessage(code: string | null | undefined): string | null {
  if (!code) return null;
  return GOOGLE_ERROR_MESSAGES[code] ?? "Something went wrong with Google sign-in. Try again.";
}

export function loginErrorMessage(code: string | null | undefined): string {
  if (!code) return "Something went wrong. Try again.";
  return LOGIN_ERROR_MESSAGES[code] ?? "Something went wrong. Try again.";
}

/** Where a signed-in person should land. */
export const HOME_PATH = "/projects";
export function landingFor(u: { status: string; onboarded: boolean }): string {
  if (u.status !== "approved") return "/pending";
  return u.onboarded ? HOME_PATH : "/onboarding";
}
