import Link from "next/link";
import { CircleMark } from "@/components/bits";

export const metadata = { title: "Privacy" };

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-10">
      <h2 className="font-display text-2xl font-semibold">{title}</h2>
      <div className="mt-3 space-y-3 leading-relaxed text-dim [&_b]:text-star [&_li]:ml-5 [&_li]:list-disc [&_ul]:space-y-1.5">{children}</div>
    </section>
  );
}

export default function Privacy() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6 sm:py-12">
      <Link href="/" className="mb-10 inline-flex min-h-11 items-center gap-2.5">
        <CircleMark size={28} />
        <span className="font-display text-lg font-semibold">Comskills Circle</span>
      </Link>
      <h1 className="font-display text-4xl font-semibold">Privacy, in plain words</h1>
      <p className="mt-3 text-dim">
        Comskills Circle is the private platform of the Comskills Fellowship. This page explains what we keep, who can see it, and what you can change. Last updated: October 2026.
      </p>

      <Section title="Who can get in">
        <p>
          Only people the Comskills team approves. You sign up with your email and a password, confirm a 6-digit code we email you, and then wait for an admin to approve you. Until then you can&rsquo;t see anyone&rsquo;s profile.
        </p>
      </Section>

      <Section title="What other members can see">
        <ul>
          <li>
            <b>Your profile</b>: name, photo (if you add one), university, city, field of study, skills, experience, links you add, what you&rsquo;re looking for and whether you&rsquo;re open to volunteer. Every approved member can see it.
          </li>
          <li>
            <b>Your WhatsApp number and contact email are hidden.</b> Someone only sees them after they send you a Connect request and <b>you accept it</b>. You can say no, and they are not told why.
          </li>
          <li>
            <b>Your scholarship tracker</b>: entries you are applying to, have applied to or were accepted to show on your profile. <b>Rejections are visible only to the Comskills team</b> unless you choose to show them to everyone.
          </li>
          <li>Projects you propose or join, and posts you share.</li>
        </ul>
      </Section>

      <Section title="What the Comskills team can see">
        <p>
          Team members and admins can see everyone&rsquo;s tracker (including team-only rejections), the volunteer list and summary numbers, so they can support you. They don&rsquo;t see your contact details unless you accept their Connect request, like anyone else. Admins can also see your sign-up email to approve your account.
        </p>
      </Section>

      <Section title="How the AI is used">
        <p>
          We use Google&rsquo;s Gemini AI to read opportunity links, suggest fields for your profile, match projects and opportunities to members, and give &ldquo;how to approach this&rdquo; tips.
        </p>
        <ul>
          <li>
            <b>Your name, email, phone number and university are never sent to the AI.</b> Profiles are sent with code names (like &ldquo;u1&rdquo;), and links, emails and phone numbers are removed from the text first.
          </li>
          <li>
            We use Gemini&rsquo;s free tier. On the free tier, Google may use what we send to improve its products. That&rsquo;s why we strip out who you are first.
          </li>
          <li>If the AI is switched off or busy, the app still works with simpler, rule-based matching.</li>
        </ul>
      </Section>

      <Section title="Emails">
        <p>
          We send email from comskills.official@gmail.com: sign-up and password codes, your approval, and (if you keep them on) a weekly or daily digest and a few instant notifications. You can turn each kind off in <Link href="/settings" className="text-brass underline">Settings</Link>, or use the unsubscribe link at the bottom of any email. Codes and account emails always go out. Our email log records the kind of email and when, never your address.
        </p>
      </Section>

      <Section title="WhatsApp sharing">
        <p>
          The &ldquo;Share on WhatsApp&rdquo; buttons just open WhatsApp with a short message you can edit. Nothing is sent automatically, and we don&rsquo;t use any WhatsApp service.
        </p>
      </Section>

      <Section title="Where your data lives">
        <ul>
          <li>The app runs on Vercel and the data is stored in a MongoDB Atlas database. Both are run by their companies; we use their free plans.</li>
          <li>Passwords are stored scrambled (hashed), never as plain text. Photos are resized on your phone to 40 KB or less before upload.</li>
          <li>Accounts that never confirm their email are removed after 7 days.</li>
        </ul>
      </Section>

      <Section title="Your choices">
        <ul>
          <li>Edit or remove anything on your profile at any time.</li>
          <li>Hide or show rejections in your tracker, entry by entry.</li>
          <li>Turn emails off in Settings.</li>
          <li>
            <b>Delete your account</b> in Settings. This removes your profile, photo, tracker, matches, connect requests and reactions. Projects you proposed are removed too. Opportunities you shared and news you wrote stay for the community, without your name.
          </li>
        </ul>
      </Section>

      <Section title="Questions">
        <p>
          Write to <a href="mailto:comskills.official@gmail.com" className="text-brass underline">comskills.official@gmail.com</a>.
        </p>
      </Section>
    </div>
  );
}
