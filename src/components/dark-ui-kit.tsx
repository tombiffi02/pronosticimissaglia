import type { ReactNode } from "react";
import { DarkShell, HomePillNav } from "@/components/home-visuals";

export function Screen({
  title,
  subtitle,
  children,
  isAdmin = false,
}: {
  title: string;
  subtitle?: string | undefined;
  children: ReactNode;
  isAdmin?: boolean;
}) {
  return (
    <DarkShell footer={<HomePillNav isAdmin={isAdmin} />}>
      <h1 className="text-[24px] font-semibold text-white">{title}</h1>
      {subtitle ? <p className="mt-1 text-[12px] text-white/45">{subtitle}</p> : null}
      <div className="mt-6">{children}</div>
    </DarkShell>
  );
}

export function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <h2 className="mb-2 text-[10.5px] font-bold uppercase tracking-wide text-white/35">
      {children}
    </h2>
  );
}

export function Badge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "accent" | "warn";
}) {
  const tones = {
    neutral: "bg-white/10 text-white/60",
    accent: "bg-[rgba(59,140,255,0.18)] text-[#7fb2ff]",
    warn: "bg-[rgba(255,69,56,0.18)] text-[#e36668]",
  } as const;
  return (
    <span
      className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${tones[tone]}`}
    >
      {children}
    </span>
  );
}

export function Card({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-[15px] border border-white/12 bg-white/5 p-4 text-white backdrop-blur-[10px]">
      {children}
    </div>
  );
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="mb-4 block">
      <span className="mb-1 block text-[13px] font-medium text-white/80">{label}</span>
      {children}
    </label>
  );
}

export const inputClass =
  "w-full rounded-[10px] border border-white/15 bg-white/10 px-3 py-2 text-base text-white placeholder:text-white/35 outline-none focus:ring-2 focus:ring-[#3b8cff] [&>option]:bg-[#1a1a1a] [color-scheme:dark]";

export const buttonClass =
  "w-full rounded-[10px] bg-[#3b8cff] px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-[#2f78e0] disabled:opacity-50";

export const secondaryButtonClass =
  "w-full rounded-[10px] border border-white/15 bg-white/5 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-white/10";

export function Message({
  tone = "error",
  children,
}: {
  tone?: "error" | "success";
  children: ReactNode;
}) {
  if (!children) return null;
  return (
    <p className={`mb-4 text-sm ${tone === "error" ? "text-[#e36668]" : "text-[#66e37d]"}`}>
      {children}
    </p>
  );
}
