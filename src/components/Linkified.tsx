import { Fragment } from "react";

const URL_RE = /(https?:\/\/[^\s<>"']+[^\s<>"'.,;:!?)\]])/g;

/** Plain text with http(s) links turned into anchors. React escapes the rest, so it's safe. */
export function Linkified({ text, className }: { text: string; className?: string }) {
  const parts = text.split(URL_RE);
  return (
    <p className={className}>
      {parts.map((p, i) =>
        i % 2 === 1 ? (
          <a key={i} href={p} target="_blank" rel="noopener noreferrer nofollow" className="break-all text-brass underline underline-offset-2">
            {p}
          </a>
        ) : (
          <Fragment key={i}>{p}</Fragment>
        ),
      )}
    </p>
  );
}
