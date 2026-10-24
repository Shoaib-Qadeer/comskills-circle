/** Which ways of signing in are switched on (read on the server only). */

export function googleConfigured(): boolean {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

/**
 * Email + password (with emailed codes) is off once Google sign-in is set up, unless
 * PASSWORD_LOGIN=on. Without Google it stays on, so nobody is ever locked out.
 */
export function passwordLoginEnabled(): boolean {
  return process.env.PASSWORD_LOGIN === "on" || !googleConfigured();
}

export const PASSWORD_LOGIN_OFF_MESSAGE = "Email sign-up is switched off. Use “Continue with Google” instead.";
