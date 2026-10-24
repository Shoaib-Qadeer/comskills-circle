// Client-safe copies of the sign-in error messages (the server throws the keys).
export const LOGIN_ERROR_MESSAGES: Record<string, string> = {
  invalid: "Email or password is incorrect.",
  unverified: "Please confirm your email first. We've sent you a new code.",
  locked: "Too many tries. Wait 15 minutes, or reset your password.",
  token: "That sign-in link has expired. Please log in with your password.",
  server: "We couldn't reach the server. Try again in a minute.",
  CredentialsSignin: "Email or password is incorrect.",
};

export function loginErrorMessage(code: string | null | undefined): string {
  if (!code) return "Something went wrong. Try again.";
  return LOGIN_ERROR_MESSAGES[code] ?? "Something went wrong. Try again.";
}

/** Where a signed-in person should land. */
export const HOME_PATH = "/matches";
export function landingFor(u: { status: string; onboarded: boolean }): string {
  if (u.status !== "approved") return "/pending";
  return u.onboarded ? HOME_PATH : "/onboarding";
}
