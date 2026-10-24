// Plain, mobile-friendly email templates (HTML + text). Pure functions: easy to test, no I/O.

export type Rendered = { subject: string; html: string; text: string };

export function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

type Block =
  | { p: string }
  | { quote: string }
  | { code: string }
  | { list: { title: string; detail?: string; url?: string }[]; heading?: string };

export type EmailContent = {
  subject: string;
  preheader?: string;
  heading: string;
  blocks: Block[];
  cta?: { label: string; url: string };
  /** One line: why the person got this email. */
  reason: string;
  unsubscribeUrl?: string;
};

const C = { bg: "#f3f4fa", card: "#ffffff", ink: "#141a33", dim: "#4f577a", faint: "#7b83a6", brass: "#b7860b", line: "#e3e5f0" };

export function renderEmail(c: EmailContent): Rendered {
  const blocksHtml = c.blocks
    .map((b) => {
      if ("p" in b) return `<p style="margin:0 0 14px;font-size:15px;line-height:1.55;color:${C.ink}">${escapeHtml(b.p)}</p>`;
      if ("quote" in b)
        return `<p style="margin:0 0 14px;padding:10px 14px;border-left:3px solid ${C.brass};background:${C.bg};font-size:15px;line-height:1.5;color:${C.dim};font-style:italic">${escapeHtml(b.quote)}</p>`;
      if ("code" in b)
        return `<p style="margin:6px 0 18px;font-size:32px;letter-spacing:8px;font-weight:700;color:${C.ink};font-family:ui-monospace,Menlo,Consolas,monospace">${escapeHtml(b.code)}</p>`;
      const items = b.list
        .map(
          (i) =>
            `<li style="margin:0 0 10px;font-size:15px;line-height:1.45;color:${C.ink}">${
              i.url ? `<a href="${escapeHtml(i.url)}" style="color:${C.ink};font-weight:600;text-decoration:underline">${escapeHtml(i.title)}</a>` : `<strong>${escapeHtml(i.title)}</strong>`
            }${i.detail ? `<br><span style="color:${C.dim};font-size:14px">${escapeHtml(i.detail)}</span>` : ""}</li>`,
        )
        .join("");
      return `${b.heading ? `<p style="margin:18px 0 8px;font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;color:${C.faint}">${escapeHtml(b.heading)}</p>` : ""}<ul style="margin:0 0 8px;padding-left:18px">${items}</ul>`;
    })
    .join("");
  const cta = c.cta
    ? `<p style="margin:22px 0 6px"><a href="${escapeHtml(c.cta.url)}" style="display:inline-block;background:${C.brass};color:#ffffff;text-decoration:none;font-weight:600;font-size:15px;padding:12px 20px;border-radius:999px">${escapeHtml(c.cta.label)}</a></p>`
    : "";
  const unsub = c.unsubscribeUrl
    ? ` <a href="${escapeHtml(c.unsubscribeUrl)}" style="color:${C.faint};text-decoration:underline">Change or stop these emails</a>.`
    : "";
  const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(c.subject)}</title></head>
<body style="margin:0;padding:0;background:${C.bg};font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif">
<span style="display:none;max-height:0;overflow:hidden;opacity:0">${escapeHtml(c.preheader || c.heading)}</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.bg}"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px">
<tr><td style="padding:0 4px 14px;font-size:15px;font-weight:700;color:${C.ink}"><span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${C.brass};margin-right:8px;vertical-align:middle"></span>Comskills Circle</td></tr>
<tr><td style="background:${C.card};border:1px solid ${C.line};border-radius:18px;padding:24px 22px">
<h1 style="margin:0 0 14px;font-size:21px;line-height:1.3;color:${C.ink}">${escapeHtml(c.heading)}</h1>
${blocksHtml}${cta}
</td></tr>
<tr><td style="padding:14px 6px;font-size:12px;line-height:1.5;color:${C.faint}">${escapeHtml(c.reason)}${unsub}</td></tr>
</table></td></tr></table></body></html>`;

  const textBlocks = c.blocks
    .map((b) => {
      if ("p" in b) return b.p;
      if ("quote" in b) return `> ${b.quote}`;
      if ("code" in b) return `    ${b.code}`;
      return `${b.heading ? `${b.heading.toUpperCase()}\n` : ""}${b.list.map((i) => `- ${i.title}${i.detail ? ` (${i.detail})` : ""}${i.url ? `\n  ${i.url}` : ""}`).join("\n")}`;
    })
    .join("\n\n");
  const text = `${c.heading}\n\n${textBlocks}${c.cta ? `\n\n${c.cta.label}: ${c.cta.url}` : ""}\n\n--\n${c.reason}${c.unsubscribeUrl ? `\nChange or stop these emails: ${c.unsubscribeUrl}` : ""}\n`;
  return { subject: c.subject, html, text };
}

/* ---------------- the emails ---------------- */

export function codeEmail(code: string, purpose: "verify" | "reset"): Rendered {
  return renderEmail({
    subject: `Your Comskills Circle code: ${code}`,
    preheader: `Your code is ${code}. It works for 15 minutes.`,
    heading: purpose === "verify" ? "Confirm your email" : "Reset your password",
    blocks: [
      { p: purpose === "verify" ? "Enter this code to confirm your email for Comskills Circle:" : "Enter this code to choose a new password:" },
      { code },
      { p: "It works for 15 minutes, once. If you didn't ask for it, you can ignore this email; nothing will change." },
    ],
    reason: "You got this because someone entered this email address on Comskills Circle.",
  });
}

export function approvedEmail(name: string, url: string): Rendered {
  return renderEmail({
    subject: "You're in! Welcome to Comskills Circle",
    heading: `Welcome, ${firstWord(name)}!`,
    blocks: [
      { p: "The Comskills team approved your account. Take two minutes to set up your profile, then see the projects looking for people like you." },
    ],
    cta: { label: "Set up my profile", url },
    reason: "You got this because you signed up for Comskills Circle.",
  });
}

export function signupAlertEmail(p: { name: string; batch: string | null; saysTeam: boolean; url: string }): Rendered {
  const hint = [p.batch ? `Says batch: ${p.batch}` : null, p.saysTeam ? "Says they're on the Comskills team" : null].filter(Boolean).join(". ");
  return renderEmail({
    subject: `New sign-up waiting: ${p.name}`,
    heading: `${p.name} is waiting for approval`,
    blocks: [{ p: "They confirmed their email and can't see anything until an admin approves them." }, ...(hint ? [{ p: `${hint}.` }] : [])],
    cta: { label: "Review in Admin", url: p.url },
    reason: "You got this because you're an admin of Comskills Circle. You can turn these alerts off in Admin → Email.",
  });
}

export function notificationEmail(p: {
  subject: string;
  heading: string;
  lines: string[];
  quote?: string | null;
  cta: { label: string; url: string };
  reason: string;
  unsubscribeUrl: string;
}): Rendered {
  return renderEmail({
    subject: p.subject,
    heading: p.heading,
    blocks: [...p.lines.map((l) => ({ p: l })), ...(p.quote ? [{ quote: p.quote }] : [])],
    cta: p.cta,
    reason: p.reason,
    unsubscribeUrl: p.unsubscribeUrl,
  });
}

export type DigestSection = { heading: string; items: { title: string; detail?: string; url?: string }[] };

export function digestEmail(p: { name: string; frequency: "weekly" | "daily"; sections: DigestSection[]; url: string; unsubscribeUrl: string }): Rendered {
  const total = p.sections.reduce((n, s) => n + s.items.length, 0);
  return renderEmail({
    subject: p.frequency === "weekly" ? `Your week in Comskills Circle (${total} update${total === 1 ? "" : "s"})` : `Today in Comskills Circle (${total} update${total === 1 ? "" : "s"})`,
    heading: `Hi ${firstWord(p.name)}, here's what's new`,
    blocks: p.sections.map((s) => ({ heading: s.heading, list: s.items })),
    cta: { label: "Open Comskills Circle", url: p.url },
    reason: `You got this ${p.frequency} summary because you're a Comskills Circle member.`,
    unsubscribeUrl: p.unsubscribeUrl,
  });
}

export function nudgeEmail(p: { name: string; url: string; unsubscribeUrl: string }): Rendered {
  return renderEmail({
    subject: "A quick update for the Comskills team?",
    heading: `Hi ${firstWord(p.name)}, how are your applications going?`,
    blocks: [
      { p: "Once a month we ask members to update their scholarship tracker and profile. It takes a minute and helps the team support you (and celebrate your wins)." },
    ],
    cta: { label: "Update my tracker", url: p.url },
    reason: "You got this monthly reminder because you're a Comskills Circle member.",
    unsubscribeUrl: p.unsubscribeUrl,
  });
}

export function testEmail(url: string): Rendered {
  return renderEmail({
    subject: "Comskills Circle test email",
    heading: "Email is working",
    blocks: [{ p: "This is a test from Admin → Email. If you can read this, Gmail sending is set up correctly." }],
    cta: { label: "Open Admin", url },
    reason: "You got this because an admin pressed “Send a test email”.",
  });
}

function firstWord(name: string): string {
  return name.trim().split(/\s+/)[0] || name;
}
