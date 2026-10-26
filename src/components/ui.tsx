import Link from "next/link";
import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";
import { formatEuro } from "@/domain/money";

export type ButtonTone = "primary" | "quiet" | "danger";

export function buttonClass(tone: ButtonTone = "primary"): string {
  const tones: Record<ButtonTone, string> = {
    primary: "bg-pine text-paper hover:bg-pine-deep",
    quiet: "border border-line bg-card text-ink hover:border-ink",
    danger: "border border-clay bg-card text-clay hover:bg-clay/10",
  };
  return `inline-flex min-h-11 items-center justify-center rounded-full px-4 text-sm font-medium transition disabled:opacity-60 ${tones[tone]}`;
}

export const inputClass = "min-h-11 w-full rounded-xl border border-line bg-white px-3 text-base text-ink";
export const textLinkClass = "inline-flex min-h-11 items-center text-sm font-medium text-pine";

export function LinkButton({ href, children, tone = "primary" }: { href: string; children: ReactNode; tone?: ButtonTone }) {
  return (
    <Link href={href} className={buttonClass(tone)}>
      {children}
    </Link>
  );
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="grid gap-1 text-sm">
      <span className="font-medium">{label}</span>
      {children}
      {hint ? <span className="text-xs leading-relaxed text-muted">{hint}</span> : null}
    </label>
  );
}

export function TextInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={inputClass} />;
}

export function SelectInput(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={inputClass} />;
}

export function TextArea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={`${inputClass} min-h-28 py-3`} />;
}

export function Check({ name, label, defaultChecked, hint }: { name: string; label: string; defaultChecked?: boolean; hint?: string }) {
  return (
    <label className="flex min-h-11 items-start gap-3 py-2 text-sm">
      <input type="checkbox" name={name} defaultChecked={defaultChecked} className="mt-0.5 size-5 accent-pine" />
      <span>
        <span className="font-medium">{label}</span>
        {hint ? <span className="mt-1 block text-xs leading-relaxed text-muted">{hint}</span> : null}
      </span>
    </label>
  );
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-2xl border border-line bg-card p-4 ${className}`}>{children}</div>;
}

export function PageHeader({ title, lede, action }: { title: string; lede?: string; action?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div className="max-w-2xl">
        <h1 className="text-3xl leading-tight text-ink md:text-4xl">{title}</h1>
        {lede ? <p className="mt-2 text-sm leading-relaxed text-muted">{lede}</p> : null}
      </div>
      {action}
    </div>
  );
}

export function Section({ title, children, action }: { title: string; children: ReactNode; action?: ReactNode }) {
  return (
    <section className="mt-8">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
        <h2 className="text-2xl">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

export function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <Card>
      <p className="text-xs font-medium tracking-wide text-muted uppercase">{label}</p>
      <p className="mt-2 font-mono text-lg tabular-nums md:text-xl">{value}</p>
      {hint ? <p className="mt-1 text-xs leading-relaxed text-muted">{hint}</p> : null}
    </Card>
  );
}

const pillTones: Record<string, string> = {
  open: "bg-pine/10 text-pine",
  issued: "bg-pine/10 text-pine",
  overdue: "bg-clay/15 text-clay",
  paid: "bg-moss/15 text-moss",
  done: "bg-moss/15 text-moss",
  draft: "bg-amber/15 text-amber",
  partial: "bg-amber/15 text-amber",
  doing: "bg-amber/15 text-amber",
  void: "bg-ink/10 text-muted",
  skipped: "bg-ink/10 text-muted",
  approved: "bg-moss/15 text-moss",
  requested: "bg-amber/15 text-amber",
  rejected: "bg-ink/10 text-muted",
  watch: "bg-amber/15 text-amber",
  stop: "bg-clay/15 text-clay",
  regular: "bg-pine/10 text-pine",
  midijob: "bg-amber/15 text-amber",
  minijob: "bg-ink/10 text-ink",
  exempt: "bg-ink/10 text-muted",
};

export function Pill({ tone, children }: { tone: string; children: ReactNode }) {
  return <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${pillTones[tone] ?? pillTones.open}`}>{children}</span>;
}

export function Money({ cents }: { cents: number }) {
  return <span className={`font-mono tabular-nums ${cents < 0 ? "text-clay" : ""}`}>{formatEuro(cents)}</span>;
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="rounded-2xl border border-dashed border-line px-4 py-8 text-center text-sm text-muted">{children}</p>;
}

export function Disclaimer({ children }: { children?: ReactNode }) {
  return (
    <p className="text-xs leading-relaxed text-muted">
      {children ?? "Planning figures only. This is not a tax assessment, a payroll calculation, or a filing."}
    </p>
  );
}
