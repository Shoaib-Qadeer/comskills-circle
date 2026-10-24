// WhatsApp share texts: short (title, one line, link). Client-safe.

function firstLine(s: string, max = 140): string {
  return (s.split(/(?<=[.!?])\s/)[0] || s).replace(/\s+/g, " ").trim().slice(0, max);
}

export function proposalShareText(p: { title: string; problem: string }, url: string): string {
  return `🤝 ${p.title}\n${firstLine(p.problem)}\nJoin the team on Comskills Circle: ${url}`;
}

export function opportunityShareText(o: { title: string; organization: string | null; deadline: string | null }, url: string): string {
  const meta = [o.organization, o.deadline ? `deadline ${o.deadline}` : null].filter(Boolean).join(", ");
  return `🎯 ${o.title}${meta ? ` (${meta})` : ""}\n${url}`;
}

export function announcementShareText(a: { title: string; body: string }, url: string): string {
  return `📣 ${a.title}\n${firstLine(a.body)}\n${url}`;
}

export function winShareText(name: string, programme: string, university: string | null, url: string): string {
  return `🎉 Congratulations to ${name}, accepted to ${programme}${university ? ` at ${university}` : ""}!\n${url}`;
}
