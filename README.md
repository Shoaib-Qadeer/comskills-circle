# Compass

A private opportunity-sharing platform for the M1 AIRE class at Learning Planet Institute.
Classmates share internship links, Compass reads the posting, and every classmate it fits gets a match with a reason and warnings (deadline, French required, not 6 months). It also has a shared network of contacts with warm-intro requests, and the **Class constellation**: an animated map of where everyone is heading.

Built with Next.js, MongoDB Atlas, NextAuth (Google, LPI accounts only), Tailwind, Motion and d3-force.

---

## Deploy it (browser only, about 30 minutes)

You need five things. Do them in this order, because later steps need values from earlier ones.

### 1. MongoDB Atlas (database, free)
1. Create a free account at mongodb.com/atlas and create an **M0 (free)** cluster. Pick a European region (e.g. Paris or Frankfurt).
2. **Database Access** → add a database user with a password. Keep it.
3. **Network Access** → add IP address `0.0.0.0/0` (Vercel's addresses change, so it must be open; the password protects it).
4. **Connect → Drivers** → copy the connection string. Replace `<password>` with your user's password. This is `MONGODB_URI`.

### 2. LLM API key (paid tier, ≤ €5)
Any of these work. Pick one, create an API key, **enable billing and set a budget alert of €5**.

| `LLM_PROVIDER` | Where | `LLM_MODEL` |
|---|---|---|
| `gemini` | Google AI Studio → API keys, with billing linked | the cheapest "flash-lite" model listed on the pricing page |
| `openai` | platform.openai.com | the cheapest "mini/nano" model |
| `anthropic` | console.anthropic.com | the cheapest "haiku" model |
| `openrouter` | openrouter.ai | any cheap model ID |

Use a **paid** tier: Gemini's free tier, for example, may not be used for apps serving EU users, and free tiers may use your prompts for training. At this scale it costs cents per month. If the key is missing or the daily cap is hit, Compass still works with basic rule-based matching.

### 3. Vercel (hosting, free) — first deploy
1. Sign in to vercel.com with GitHub → **Add New → Project** → import this repository.
2. Before clicking Deploy, open **Environment Variables** and add everything from `.env.example`:
   - `MONGODB_URI`, `MONGODB_DB` = `compass`
   - `NEXTAUTH_SECRET` = any long random string (40+ characters)
   - `ALLOWED_EMAIL_DOMAIN` = `learningplanetinstitute.org`
   - `ADMIN_EMAILS` = your LPI email
   - `LLM_PROVIDER`, `LLM_API_KEY`, `LLM_MODEL`, `LLM_DAILY_CALL_LIMIT` = `150`
   - Leave `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` / `NEXTAUTH_URL` for now.
3. Deploy. Note your URL, e.g. `https://compass-aire.vercel.app`.

### 4. Google login (free)
1. console.cloud.google.com → create a project ("Compass").
2. **APIs & Services → OAuth consent screen**: choose **Internal** if your LPI account allows it (only LPI accounts can then see it), otherwise **External**. App name "Compass", your email as support contact.
3. **Credentials → Create credentials → OAuth client ID → Web application**.
   - Authorized JavaScript origin: `https://YOUR-APP.vercel.app`
   - Authorized redirect URI: `https://YOUR-APP.vercel.app/api/auth/callback/google`
4. Copy the client ID and secret.

### 5. Finish in Vercel
Add `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` and `NEXTAUTH_URL` (= your Vercel URL, no trailing slash). Then **Deployments → ⋯ → Redeploy**.

Open the site and sign in with your LPI account. Indexes are created automatically on first sign-in.

> If Google says the app is blocked by your organization, LPI IT has restricted third-party apps. Ask them to allow the OAuth client ID from step 4.

---

## Admin (only for ADMIN_EMAILS, default shoaib.qadeer@learningplanetinstitute.org)

Open **Admin** in the sidebar.
- **People:** new sign-ups wait here. Approve, decline, revoke, re-match or delete accounts, approve everyone at once, export a CSV. Accounts created before approvals existed count as approved.
- **Access:** turn "wait for my approval" on or off, paste the class list as pre-approved emails (they skip the wait), and allow specific emails from other domains.
- **AI:** switch AI on or off, override the model, set daily call and token budgets (defaults 1,000 calls and 1,000,000 tokens), the match threshold, how much of each page is read, each AI feature, per-person limits, and edit every prompt. "Test the AI" checks the key and model; the call log shows token use and provider errors (for example 429 quota errors).
- **Content:** add the starter opportunities, re-match or delete any opportunity (open or archived), remove connections.

## Starter opportunities

`src/lib/starter-opportunities.ts` holds 26 real internships and programmes across 12 themes, researched in October 2026 (OECD, UNESCO, UNICEF, WHO, UNFPA, UN Women, EEA, the Commission's Blue Book, IIASA, WMO, Stryker, GE HealthCare and ENS / Inserm / Institut Pasteur lab offers). Add them from **Admin → Content → Add starter opportunities** (no install needed), or with `npm run db:starter`. Both skip items already added. Fields a posting doesn't state are left empty rather than guessed.

## How it works

**Privacy model** (enforced on the server, not just hidden in the UI)
- *Private*: profile only read by the matcher. Never listed, never on the Class page, can't be tagged. Still gets matches.
- *Class*: name, headline, direction, fields, locations and links visible to classmates.
- *Open to collaborate*: Class plus skills offered and "looking to collaborate on".
- Posters see how many classmates an opportunity matched, never who.
- Names and emails are never sent to the LLM; profiles go as `u1…u19`.

**Matching**
- New opportunity → one LLM call scores it against every eligible classmate. Matches at 60+ are saved. Tagged classmates always get it.
- New or edited profile → re-scored against all open opportunities (10 per call).
- French-required roles are only auto-matched to people who said they're open to French.
- Warnings (deadline, French, duration ≠ 6 months, unpaid) are computed in code, not by the LLM.
- Fallback when the LLM is unavailable: field overlap + role keywords + location.

**Link reading**: SSRF-protected fetch (public addresses only, 8 s timeout, 2 MB cap), Readability + JSON-LD `JobPosting` parsing. Sites that block bots (LinkedIn) fall back to "paste the text".

**Limits**: per-person daily limits and the app-wide AI budget are set in Admin → AI. (`LLM_DAILY_CALL_LIMIT` is no longer used.)

**Archive**: anything whose deadline has passed leaves Matches and Opportunities and appears under Archive, together with your saved matches that closed.

## Develop locally (optional)
```bash
npm install
cp .env.example .env.local   # fill in values; use http://localhost:3000 for NEXTAUTH_URL
npm run dev
npm test                     # logic tests (URL dedupe, SSRF guard, warnings, matching fallback…)
MONGODB_DB=compass-dev npm run db:seed   # fake classmates for a dev database (refuses production)
```
Add `http://localhost:3000/api/auth/callback/google` as a redirect URI in Google Cloud for local login.

## Project map
```
src/app/(app)/        signed-in pages: matches, opportunities, class, connections, settings, admin
src/app/api/          route handlers (all zod-validated, all require a session)
src/lib/              auth, db, llm adapter, prompts, extraction, matching, warnings, serializers
src/components/       UI, incl. ClassConstellation (d3-force + SVG)
scripts/              create-indexes, seed-dev
tests/                vitest logic tests
```
