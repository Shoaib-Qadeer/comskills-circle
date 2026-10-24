"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Check, Link2 } from "lucide-react";
import { waShareLink } from "@/lib/phone";
import { cx } from "./ui";

/** WhatsApp's mark, drawn simply (no external image). */
export function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden fill="currentColor">
      <path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm0 18.2c-1.5 0-3-.4-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2Zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8s-.4-.1-.6.1-.7.8-.8 1-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.2-.4.2-.4.7-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.7 11.9 11.9 0 0 0 4.6 4c1.7.7 2.4.8 3.2.6.5 0 1.5-.6 1.7-1.2s.2-1.1.2-1.2-.2-.2-.4-.3Z" />
    </svg>
  );
}

/** WhatsApp share (a wa.me link with the text filled in) and copy-link. Free: no WhatsApp API involved. */
export function ShareButtons({ text, url, compact, className }: { text: string; url: string; compact?: boolean; className?: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success("Link copied");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Couldn't copy. Long-press the address bar instead.");
    }
  }
  return (
    <div className={cx("flex flex-wrap items-center gap-2", className)}>
      <a
        href={waShareLink(text)}
        target="_blank"
        rel="noopener noreferrer"
        className={cx(
          "inline-flex items-center gap-2 rounded-full bg-[#25D366] font-medium text-[#062b15] transition-[filter] hover:brightness-105",
          compact ? "h-10 px-3.5 text-sm sm:h-8 sm:px-3" : "h-11 px-4 text-sm sm:h-10",
        )}
      >
        <WhatsAppIcon className="size-4" /> {compact ? "Share" : "Share on WhatsApp"}
      </a>
      <button
        type="button"
        onClick={copy}
        className={cx("inline-flex items-center gap-2 rounded-full border border-line-strong text-sm hover:bg-raised-2", compact ? "h-10 px-3.5 sm:h-8 sm:px-3" : "h-11 px-4 sm:h-10")}
      >
        {copied ? <Check className="size-4 text-aurora" /> : <Link2 className="size-4" />} {copied ? "Copied" : "Copy link"}
      </button>
    </div>
  );
}

/** Absolute link to a page of this app (for sharing). */
export function absoluteUrl(path: string): string {
  if (typeof window === "undefined") return path;
  return `${window.location.origin}${path}`;
}
