# Comskills Circle

The private community platform for the **Comskills Fellowship**. Members:

- pitch projects and find teammates
- track their scholarship applications
- read the team's announcements
- share opportunities, which the AI matches to the right people

It runs entirely on free plans (€0 a month):

| Service | What it does | Free limit that matters |
|---|---|---|
| **Vercel Hobby** | Hosts the website | 1 scheduled job a day; each request can run up to 60 seconds |
| **MongoDB Atlas M0** | The database | 512 MB of storage |
| **Google Gemini (free tier)** | Reads links, matches people, gives tips | About 15 requests a minute and a few hundred a day |
| **Gmail** (comskills.official@gmail.com) | Sends sign-up codes, digests and notifications | About 500 emails a day |

Admin → Overview shows how much of each limit you've used today.

---

## Part 1. Deploy it, step by step

You don't need to write any code. Allow about 45 minutes. Do the steps **in this order**: each one gives you a value you paste into Vercel in Step 4.

Keep a private note (not in a shared document) with these values as you collect them:

```
MONGODB_URI=
NEXTAUTH_SECRET=
NEXTAUTH_URL=
GMAIL_APP_PASSWORD=
LLM_API_KEY=
CRON_SECRET=
```

### Step 1. Create the database (MongoDB Atlas)

1. Go to <https://www.mongodb.com/cloud/atlas/register> and sign up. Using the comskills.official@gmail.com Google account keeps everything in one place.
2. When asked to deploy a cluster, choose **M0 (Free)**. For the provider and region, pick AWS and the region closest to your members (for example *Mumbai ap-south-1*). Name it `comskills` and click **Create**.
3. **Create a database user.** Atlas shows a "Connect" / security quickstart screen:
   - Username: `comskills-app`
   - Password: click **Autogenerate Secure Password** and **copy it** into your note. Avoid typing your own password with `@ : / ? #` in it, because those characters break the connection string.
   - Click **Create Database User**.
4. **Allow Vercel to connect (important).** In the left menu open **Security → Network Access → Add IP Address**, choose **Allow access from anywhere** (`0.0.0.0/0`) and **Confirm**. Vercel's servers change address all the time, so this is required. The database is still protected by the username and password.
5. **Get the connection string.** Go to **Database → Clusters → Connect → Drivers** and copy the string. It looks like:
   ```
   mongodb+srv://comskills-app:<db_password>@comskills.abcde.mongodb.net/?retryWrites=true&w=majority&appName=comskills
   ```
   Replace `<db_password>` (including the `< >`) with the password from step 3. This whole line is your **`MONGODB_URI`**.

You don't need to create collections. The app creates everything the first time someone signs in.

### Step 2. Let the app send email from Gmail (App Password)

Google only gives an App Password to accounts that have 2-Step Verification on, so turn that on first.

1. Sign in to <https://myaccount.google.com> as **comskills.official@gmail.com**.
2. Go to **Security → 2-Step Verification** and turn it on (a phone number is enough).
3. Then open <https://myaccount.google.com/apppasswords>. If the page says the setting isn't available, 2-Step Verification isn't on yet.
4. Type the name `Comskills Circle` and click **Create**.
5. Google shows a 16-letter password like `abcd efgh ijkl mnop`. Copy it **without the spaces**: `abcdefghijklmnop`. This is your **`GMAIL_APP_PASSWORD`**. Google shows it only once.

> If you ever change the Google account's normal password, Google cancels all App Passwords. Make a new one and update it in Vercel.

### Step 3. Get a Gemini API key (free)

1. Go to <https://aistudio.google.com> and sign in (the comskills.official account is fine).
2. Click **Get API key → Create API key**, and accept creating a new project if asked.
3. Copy the key (it starts with `AIza…`). This is your **`LLM_API_KEY`**.
4. **Check the model name.** Google renames models often. In AI Studio, open the model picker and find a free **Flash-Lite** (or **Flash**) model. Copy its exact id, for example `gemini-3.5-flash-lite`. That's your **`LLM_MODEL`**. You can change it later in Admin → AI → Model override without redeploying.

**Free-tier note.** On the free tier, Google may use what the app sends to improve its products. The app never sends names, emails, phone numbers or universities (people appear as "u1", "u2"…). Google's terms also limit the free tier for apps serving users in the **EEA, UK and Switzerland**. If members in Europe join, enable billing on the Google Cloud project (pay-as-you-go). Nothing in the app changes: it's the same key and model.

The app works without the AI too. If the key is missing or the daily limit is reached, it falls back to simpler matching (shown as "basic match") and members fill opportunity details by hand.

### Step 4. Put the code on GitHub and deploy on Vercel

**4a. Put the code on GitHub**

1. Create a GitHub account if you don't have one, then click **New repository**. Name it `comskills-circle`, leave it empty (no README) and click **Create**.
2. Upload the code. The simplest way is to install **GitHub Desktop**, choose *File → Add local repository*, pick the unzipped `comskills-circle` folder, then click **Publish repository**.

> **Vercel Hobby rule:** on the free plan, Vercel only builds commits whose author is the GitHub account connected to Vercel. **Either** make the repository **public**, **or** make sure the commits are authored by the same GitHub account you use to sign in to Vercel. If a deploy says it was "blocked" or nothing happens after a push, this is why. Commits made with GitHub Desktop while signed in as that account are fine.

**4b. Create two random secrets**

You need two long random strings. Open <https://generate-secret.vercel.app/48> twice, or run `openssl rand -base64 48` in a terminal.
- The first is **`NEXTAUTH_SECRET`**. It signs logins and email codes; if you change it, everyone has to log in again.
- The second is **`CRON_SECRET`**. Vercel uses it to start the daily job.

**4c. Import into Vercel**

1. Go to <https://vercel.com/signup>, sign up with **GitHub**, then click **Add New → Project** and **Import** `comskills-circle`.
2. Leave the framework (Next.js) and the build settings as they are.
3. Open **Environment Variables** and add these one by one (Name = Value):

| Name | Value |
|---|---|
| `MONGODB_URI` | from Step 1 |
| `MONGODB_DB` | `comskills` |
| `NEXTAUTH_SECRET` | the first random string |
| `NEXTAUTH_URL` | leave it out for the first deploy (see 4d) |
| `ADMIN_EMAILS` | `comskills.official@gmail.com,shoaibqadeer0342@gmail.com` |
| `GMAIL_USER` | `comskills.official@gmail.com` |
| `GMAIL_APP_PASSWORD` | from Step 2 (no spaces) |
| `MAIL_FROM_NAME` | `Comskills Circle` |
| `APP_TIME_ZONE` | `Asia/Karachi` |
| `CRON_SECRET` | the second random string |
| `LLM_PROVIDER` | `gemini` |
| `LLM_API_KEY` | from Step 3 |
| `LLM_MODEL` | from Step 3, e.g. `gemini-3.5-flash-lite` |

4. Click **Deploy** and wait 2 to 3 minutes.

**4d. Set the website address**

1. When the deploy finishes, Vercel shows your address, e.g. `https://comskills-circle.vercel.app`.
2. Go to **Settings → Environment Variables** and add `NEXTAUTH_URL` = that address, with **no slash at the end**.
3. Go to **Deployments**, open the **⋯** menu on the latest deployment and choose **Redeploy**. Every time you change an environment variable you need to redeploy.

`NEXTAUTH_URL` is also used for the links inside emails. If you later add your own domain, update it and redeploy.

**4e. The daily job (cron)**

The file `vercel.json` already tells Vercel to run `/api/cron/digest` once a day at **04:00 UTC (09:00 in Pakistan)**. Each run:
- sends the digests
- sends 7-day and 1-day deadline reminders
- sends the monthly nudge (if switched on)
- removes accounts that never confirmed their email

Check it under **Vercel → your project → Settings → Cron Jobs**. It only works when `CRON_SECRET` is set. You can preview a run any time in **Admin → Email → Preview today's run**, which sends nothing.

### Step 5. First sign-up: become the admin

1. Open your site and click **Join**.
2. Sign up with **shoaibqadeer0342@gmail.com** or **comskills.official@gmail.com**, the two addresses in `ADMIN_EMAILS`.
3. Enter the 6-digit code from the email.
   - **No email?** Look in spam, then check Step 2. **Admin → Email → Send me a test** shows Gmail's exact error.
4. Admin accounts are approved automatically. Finish your profile, then open **Admin** from the menu.

Being an admin comes only from `ADMIN_EMAILS`. It's never stored in the database, so to add or remove an admin you edit that variable in Vercel and redeploy.

### Step 6. Set up batches and approve people

1. **Admin → Access → Batches:** add your batches, e.g. "Batch 1", "Batch 2". People pick one when they sign up.
2. Optional, in **Admin → Access → Pre-approved emails**: paste the emails of people you've already accepted. They skip the waiting step.
3. Share the site link with members. Each new person signs up, confirms their email and then waits.
4. **Admin → People** shows who's waiting (admins also get an email, which you can switch off in Admin → Email). For each person, choose **Approve** and set:
   - **Participant** with their **batch**, or
   - **Team**, with a title such as "Mentor, scholarships". Team members can post News and see the Team page.
5. Approved people get an email and can sign in.

That's it. The rest of this README is for when something goes wrong, and for developers.

---

## Part 2. Daily use (for admins)

- **Overview:**
  - Pending approvals, open reports and member counts.
  - Today's Gmail, Gemini and storage use against the free limits.
- **People:**
  - Approve or decline sign-ups.
  - Change roles, team titles and batches.
  - Download a CSV of members.
- **Access:**
  - Turn approval on or off.
  - Manage the pre-approved emails and the batches.
- **Email:**
  - Gmail status and a test send.
  - The daily limit, part of which is kept free for sign-up codes so nobody gets stuck.
  - Digest day (weekly digests go out on that day), instant-email switches, sign-up alerts and the monthly nudge.
  - The last daily run, a preview of today's run, and the email log (which never stores addresses).
- **AI:**
  - On/off, model, daily caps and per-person limits.
  - Feature switches and editable prompts.
  - A test button and the call log.
- **Content:** search and delete projects, opportunities, news posts and tracker entries; re-run matching; handle reported projects.
- **Team page** (team and admins):
  - Scholarship summary, with filters and CSV.
  - Volunteers, with filters and CSV.
  - Wins to announce on News.
  - Quiet members to check in with.

**Privacy rules the app enforces on the server** (see `/privacy`):
- WhatsApp numbers and contact emails are shown only after a Connect request is accepted.
- Rejected scholarships are team-only unless the member chooses otherwise.
- Names, emails, phones and universities are never sent to the AI.

---

## Part 3. Troubleshooting

| What you see | What it means | Fix |
|---|---|---|
| Vercel logs show **`SSL alert number 80`**, `MongoServerSelectionError` or `ECONNREFUSED`, and every page errors | Atlas is refusing the connection: almost always **Network Access** | Atlas → Security → Network Access → add `0.0.0.0/0`, wait a minute, then redeploy. Also check that the password inside `MONGODB_URI` is right and has no `< >`. |
| Sign-up says "We couldn't send the email" and Admin → Email shows **`Invalid login`** / `535-5.7.8` | Gmail refused the password | Use an **App Password** (Step 2), not the normal Gmail password. Paste it without spaces and redeploy. If you changed the Google password, make a new App Password. |
| Admin → AI → Test shows **404** / "model not found" | The **model id** is wrong or Google retired it | Copy the exact id from AI Studio and put it in Admin → AI → Model override (no redeploy) or `LLM_MODEL` (then redeploy). |
| AI calls show **429** / "Resource exhausted" | You hit Gemini's **rate limit** (per minute or per day) | Nothing breaks: the app waits 4 seconds, retries once, then uses basic matching. If it happens daily, lower Admin → AI → "AI calls per day", raise "Profiles per call", or enable billing. |
| AI calls show **400 or 403** / "API key not valid" | Wrong or deleted key | Create a new key in AI Studio, update `LLM_API_KEY` and redeploy. |
| Pushes to GitHub don't deploy, or Vercel says the deployment was **blocked** | Vercel Hobby only deploys commits authored by the connected GitHub account | Make the repository public, or commit as the same GitHub account that's linked to Vercel. |
| Login works but you're sent back to the login page | `NEXTAUTH_URL` doesn't match the address you're using, or it has a trailing `/` | Set it to the exact `https://…` address (no slash) and redeploy. |
| Digests never arrive | The daily job isn't running, or members turned digests off | Check `CRON_SECRET` and Vercel → Settings → Cron Jobs. Use Admin → Email → Preview. Digests skip people with nothing new. |
| "We've hit today's email limit" | The daily email cap was reached | It resets at midnight Pakistan time. Codes have their own reserve (Admin → Email). |
| The database is getting full | Atlas M0 has 512 MB | Admin → Overview shows usage. Old email and AI logs delete themselves; photos are 40 KB at most. |

---

## Part 4. For developers

**Stack:**
- Next.js 16 (App Router), React 19, TypeScript (strict), Tailwind CSS v4
- Motion, d3-force, SWR, sonner, zod
- next-auth v4 (Credentials)
- MongoDB Node driver v7
- nodemailer (Gmail SMTP)
- Gemini via `src/lib/llm.ts`

```bash
npm install
cp .env.example .env.local      # fill in; for local dev a local MongoDB works: MONGODB_URI=mongodb://127.0.0.1:27017
npm run dev                     # http://localhost:3000
npm run db:seed                 # optional: invented demo members/projects (refuses Atlas URIs)
npm run typecheck && npm test && npm run build
```

- Without Gmail settings, emails (including codes) are **printed to the server console** in development.
- Without `LLM_API_KEY`, matching uses the rule-based fallback (`src/lib/fallback-match.ts`).

**Where things are:**
- `src/lib`: all server logic.
  - `auth.ts`, `accounts.ts`, `codes.ts`: sign-up and log-in.
  - `visibility.ts`, `serialize.ts`: what each viewer may see.
  - `matching.ts`: chunked AI matching, about 40 profiles per call, 2 in parallel, 45 s budget.
  - `cron.ts`: the daily job.
  - `news.ts`, `proposals.ts`, `scholarships.ts`, `volunteers.ts`, `community-map.ts`.
- `src/app/api`: route handlers. Every handler calls `requireUser`, `requireTeam` or `requireAdmin` first.
- `tests/`: Vitest unit tests, covering the privacy rules, matching, the cron rules, news ordering, etc.
- `vercel.json`: the daily cron.

**Time:** dates are shown and compared in `APP_TIME_ZONE` (default Asia/Karachi). Date-only values (deadlines) are stored as UTC midnight of that day.
