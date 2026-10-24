/** Free-tier budgets the app is designed around (shown in Admin so nobody is surprised). */
export const BUDGETS = {
  vercel: "Vercel Hobby: 1 cron job a day, functions up to 60 s",
  atlasBytes: 512 * 1024 * 1024,
  gemini: { rpm: 15, tpm: 250_000, rpd: 500 },
  gmailPerDay: 500,
};

