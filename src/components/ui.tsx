"use client";

import { forwardRef, useEffect, useId, useRef, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type TextareaHTMLAttributes } from "react";
import { AnimatePresence, motion } from "motion/react";
import { X } from "lucide-react";
import { getField } from "@/lib/taxonomy";
import { initials } from "@/lib/client";

export function cx(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(" ");
}

/* ---------------- Button ---------------- */

type BtnVariant = "primary" | "ghost" | "quiet" | "danger";
const btnBase =
  "inline-flex items-center justify-center gap-2 rounded-full font-medium transition-[background,color,box-shadow,transform] duration-150 active:scale-[0.97] disabled:opacity-50 disabled:pointer-events-none select-none";
const btnVariants: Record<BtnVariant, string> = {
  primary: "bg-brass text-brass-ink hover:shadow-[0_0_0_4px_var(--glow)]",
  ghost: "border border-line-strong text-star hover:bg-raised-2",
  quiet: "text-dim hover:text-star hover:bg-raised-2",
  danger: "bg-ember text-white hover:brightness-110",
};
const btnSizes = { sm: "h-8 px-3 text-sm", md: "h-10 px-4 text-sm", lg: "h-12 px-6 text-base" };

export const Button = forwardRef<
  HTMLButtonElement,
  ButtonHTMLAttributes<HTMLButtonElement> & { variant?: BtnVariant; size?: keyof typeof btnSizes; loading?: boolean }
>(function Button({ variant = "primary", size = "md", loading, className, children, disabled, ...rest }, ref) {
  return (
    <button ref={ref} className={cx(btnBase, btnVariants[variant], btnSizes[size], className)} disabled={disabled || loading} {...rest}>
      {loading && <span className="size-4 rounded-full border-2 border-current border-r-transparent animate-spin" aria-hidden />}
      {children}
    </button>
  );
});

export function LinkButton({
  href,
  children,
  variant = "ghost",
  size = "md",
  className,
  external,
}: {
  href: string;
  children: ReactNode;
  variant?: BtnVariant;
  size?: keyof typeof btnSizes;
  className?: string;
  external?: boolean;
}) {
  return (
    <a
      href={href}
      className={cx(btnBase, btnVariants[variant], btnSizes[size], className)}
      {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
    >
      {children}
    </a>
  );
}

/* ---------------- Surfaces ---------------- */

export function Panel({ className, children, as: As = "div" }: { className?: string; children: ReactNode; as?: "div" | "section" | "article" }) {
  return <As className={cx("rounded-[var(--radius-panel)] border border-line bg-raised/80 backdrop-blur-sm", className)}>{children}</As>;
}

export function PageHeader({ title, subtitle, action }: { title: ReactNode; subtitle?: ReactNode; action?: ReactNode }) {
  return (
    <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div className="max-w-2xl">
        <h1 className="font-display text-3xl font-semibold leading-tight sm:text-4xl">{title}</h1>
        {subtitle && <p className="mt-2 text-dim">{subtitle}</p>}
      </div>
      {action}
    </header>
  );
}

/* ---------------- Form controls ---------------- */

const fieldBase =
  "w-full rounded-[var(--radius-field)] border border-line-strong bg-night-2 px-3.5 text-star placeholder:text-faint transition-colors focus:border-brass focus:outline-none focus:ring-2 focus:ring-[var(--glow)]";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }>(function Input(
  { className, invalid, ...rest },
  ref,
) {
  return <input ref={ref} className={cx(fieldBase, "h-11", invalid && "border-ember", className)} {...rest} />;
});

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea(
  { className, ...rest },
  ref,
) {
  return <textarea ref={ref} className={cx(fieldBase, "min-h-28 py-3 leading-relaxed", className)} {...rest} />;
});

export function Label({ children, hint, htmlFor, className }: { children: ReactNode; hint?: ReactNode; htmlFor?: string; className?: string }) {
  return (
    <label htmlFor={htmlFor} className={cx("mb-1.5 flex items-baseline justify-between gap-3 text-sm font-medium text-star", className)}>
      <span>{children}</span>
      {hint && <span className="text-xs font-normal text-faint">{hint}</span>}
    </label>
  );
}

export function Toggle({ checked, onChange, label, description }: { checked: boolean; onChange: (v: boolean) => void; label: ReactNode; description?: ReactNode }) {
  const id = useId();
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <label htmlFor={id} className="text-sm font-medium">
          {label}
        </label>
        {description && <p className="mt-0.5 text-sm text-dim">{description}</p>}
      </div>
      <button
        id={id}
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={cx("relative h-7 w-12 shrink-0 rounded-full border transition-colors", checked ? "border-brass bg-brass" : "border-line-strong bg-night-2")}
      >
        <motion.span
          animate={{ x: checked ? 20 : 0 }}
          transition={{ type: "spring", stiffness: 500, damping: 30 }}
          className={cx("absolute left-[2px] top-[2px] rounded-full shadow", checked ? "bg-brass-ink" : "bg-dim")}
          style={{ width: 22, height: 22 }}
        />
      </button>
    </div>
  );
}

/* ---------------- Chips ---------------- */

export function FieldChip({
  slug,
  selected,
  onClick,
  size = "md",
  ghost,
}: {
  slug: string;
  selected?: boolean;
  onClick?: () => void;
  size?: "sm" | "md";
  ghost?: boolean;
}) {
  const f = getField(slug);
  const cls = cx(
    "inline-flex items-center gap-1.5 rounded-full border whitespace-nowrap transition-colors",
    size === "sm" ? "h-6 px-2 text-xs" : "h-8 px-3 text-sm",
    ghost && "border-dashed",
  );
  const style = selected || !onClick
    ? { borderColor: `${f.color}66`, background: `${f.color}1f`, color: "var(--star)" }
    : { borderColor: "var(--line-strong)", color: "var(--dim)" };
  const inner = (
    <>
      <span aria-hidden>{f.emoji}</span>
      {f.label}
    </>
  );
  if (!onClick) return <span className={cls} style={style}>{inner}</span>;
  return (
    <motion.button
      type="button"
      whileTap={{ scale: 0.92 }}
      animate={{ scale: selected ? [1, 1.08, 1] : 1 }}
      transition={{ duration: 0.25 }}
      onClick={onClick}
      aria-pressed={selected}
      className={cx(cls, "hover:text-star")}
      style={style}
    >
      {inner}
    </motion.button>
  );
}

export function Tag({ children, tone = "neutral", className }: { children: ReactNode; tone?: "neutral" | "brass" | "aurora" | "ember" | "violet"; className?: string }) {
  const tones = {
    neutral: "border-line-strong text-dim",
    brass: "border-brass/40 bg-brass/10 text-brass",
    aurora: "border-aurora/40 bg-aurora/10 text-aurora",
    ember: "border-ember/40 bg-ember/10 text-ember",
    violet: "border-violet/40 bg-violet/10 text-violet",
  };
  return <span className={cx("inline-flex h-6 items-center gap-1 rounded-full border px-2.5 text-xs whitespace-nowrap", tones[tone], className)}>{children}</span>;
}

/** Free-text chips with an input to add more. */
export function ChipInput({
  values,
  onChange,
  suggestions = [],
  placeholder,
  max = 8,
}: {
  values: string[];
  onChange: (v: string[]) => void;
  suggestions?: string[];
  placeholder?: string;
  max?: number;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const add = (v: string) => {
    const t = v.trim();
    if (!t || values.some((x) => x.toLowerCase() === t.toLowerCase()) || values.length >= max) return;
    onChange([...values, t]);
  };
  const remaining = suggestions.filter((s) => !values.some((v) => v.toLowerCase() === s.toLowerCase()));
  return (
    <div>
      <div className="flex flex-wrap gap-2">
        <AnimatePresence initial={false}>
          {values.map((v) => (
            <motion.span
              key={v}
              layout
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              className="inline-flex h-8 items-center gap-1 rounded-full border border-brass/40 bg-brass/10 pl-3 pr-1 text-sm"
            >
              {v}
              <button type="button" aria-label={`Remove ${v}`} onClick={() => onChange(values.filter((x) => x !== v))} className="grid size-6 place-items-center rounded-full text-dim hover:bg-raised-2 hover:text-star">
                <X className="size-3.5" />
              </button>
            </motion.span>
          ))}
        </AnimatePresence>
        {values.length < max && (
          <input
            ref={ref}
            placeholder={placeholder || "Type and press Enter"}
            className="h-8 min-w-40 flex-1 bg-transparent px-1 text-sm placeholder:text-faint focus:outline-none"
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === ",") {
                e.preventDefault();
                add(e.currentTarget.value);
                e.currentTarget.value = "";
              } else if (e.key === "Backspace" && !e.currentTarget.value && values.length) {
                onChange(values.slice(0, -1));
              }
            }}
            onBlur={(e) => {
              if (e.currentTarget.value) {
                add(e.currentTarget.value);
                e.currentTarget.value = "";
              }
            }}
          />
        )}
      </div>
      {remaining.length > 0 && values.length < max && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {remaining.map((s) => (
            <button key={s} type="button" onClick={() => add(s)} className="h-7 rounded-full border border-dashed border-line-strong px-2.5 text-xs text-dim hover:border-brass/60 hover:text-star">
              + {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ---------------- Segmented tabs with a sliding indicator ---------------- */

export function Segmented<T extends string>({
  value,
  onChange,
  options,
  id,
  className,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: ReactNode; count?: number }[];
  id: string;
  className?: string;
}) {
  return (
    <div role="tablist" className={cx("inline-flex rounded-full border border-line bg-night-2 p-1", className)}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(o.value)}
            className={cx("relative h-8 rounded-full px-3.5 text-sm transition-colors", active ? "text-brass-ink" : "text-dim hover:text-star")}
          >
            {active && <motion.span layoutId={`seg-${id}`} className="absolute inset-0 rounded-full bg-brass" transition={{ type: "spring", stiffness: 400, damping: 32 }} />}
            <span className="relative flex items-center gap-1.5">
              {o.label}
              {o.count !== undefined && o.count > 0 && <span className={cx("tabular text-xs", active ? "opacity-70" : "text-faint")}>{o.count}</span>}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/* ---------------- Avatar ---------------- */

export function Avatar({ name, src, size = 36, ring }: { name: string; src?: string | null; size?: number; ring?: "brass" | "aurora" }) {
  const style = { width: size, height: size };
  const ringCls = ring === "brass" ? "ring-2 ring-brass ring-offset-2 ring-offset-night" : ring === "aurora" ? "ring-2 ring-aurora/70" : "ring-1 ring-line-strong";
  if (src)
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt="" referrerPolicy="no-referrer" style={style} className={cx("shrink-0 rounded-full object-cover", ringCls)} />;
  return (
    <span style={{ ...style, fontSize: size * 0.38 }} className={cx("grid shrink-0 place-items-center rounded-full bg-raised-2 font-medium text-dim", ringCls)} aria-hidden>
      {initials(name)}
    </span>
  );
}

/* ---------------- Modal / sheet ---------------- */

export function Modal({ open, onClose, title, children, wide }: { open: boolean; onClose: () => void; title: ReactNode; children: ReactNode; wide?: boolean }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);
  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <div className="absolute inset-0 bg-[#060a1c]/70 backdrop-blur-sm" onClick={onClose} aria-hidden />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={typeof title === "string" ? title : undefined}
            initial={{ y: 40, opacity: 0, scale: 0.98 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 30, opacity: 0, scale: 0.98 }}
            className={cx(
              "relative max-h-[92dvh] w-full overflow-y-auto rounded-t-[28px] border border-line-strong bg-raised p-6 shadow-2xl sm:rounded-[28px]",
              wide ? "sm:max-w-2xl" : "sm:max-w-lg",
            )}
          >
            <div className="mb-5 flex items-start justify-between gap-4">
              <h2 className="font-display text-xl font-semibold">{title}</h2>
              <button onClick={onClose} aria-label="Close" className="grid size-8 place-items-center rounded-full text-dim hover:bg-raised-2 hover:text-star">
                <X className="size-4" />
              </button>
            </div>
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cx("skeleton", className)} aria-hidden />;
}

export function EmptyState({ icon, title, children, action }: { icon: ReactNode; title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center rounded-[var(--radius-panel)] border border-dashed border-line-strong px-6 py-14 text-center">
      <div className="mb-4 text-brass">{icon}</div>
      <h3 className="font-display text-xl font-semibold">{title}</h3>
      {children && <p className="mt-2 max-w-sm text-dim">{children}</p>}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}

export function ErrorText({ children }: { children: ReactNode }) {
  if (!children) return null;
  return (
    <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} className="mt-1.5 text-sm text-ember" role="alert">
      {children}
    </motion.p>
  );
}
