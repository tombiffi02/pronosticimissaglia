import type { ReactNode } from "react";

export function Screen({ title, subtitle, children }: { title: string; subtitle?: string | undefined; children: ReactNode }) {
  return (
    <div className="min-h-screen bg-background px-4 py-8">
      <div className="mx-auto w-full max-w-md">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">{title}</h1>
        {subtitle ? <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p> : null}
        <div className="mt-6">{children}</div>
      </div>
    </div>
  );
}

export function Card({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 text-card-foreground shadow-sm">{children}</div>
  );
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="mb-4 block">
      <span className="mb-1 block text-sm font-medium text-foreground">{label}</span>
      {children}
    </label>
  );
}

export const inputClass =
  "w-full rounded-md border border-input bg-background px-3 py-2 text-base text-foreground outline-none focus:ring-2 focus:ring-ring";

export const buttonClass =
  "w-full rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-60";

export const secondaryButtonClass =
  "w-full rounded-md border border-input bg-background px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-accent";

export function Message({ tone = "error", children }: { tone?: "error" | "success"; children: ReactNode }) {
  if (!children) return null;
  return (
    <p className={`mb-4 text-sm ${tone === "error" ? "text-destructive" : "text-foreground"}`}>{children}</p>
  );
}
