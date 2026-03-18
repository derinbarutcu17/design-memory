import { cn } from "@/lib/utils";

export function Surface({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      className={cn(
        "rounded-[28px] border border-white/10 bg-slate-950/70 p-6 shadow-[0_24px_80px_rgba(2,6,23,0.35)] backdrop-blur",
        className,
      )}
    >
      {children}
    </section>
  );
}

export function Pill({
  tone = "default",
  children,
}: {
  tone?: "default" | "high" | "medium" | "low" | "valid" | "intentional" | "ignore";
  children: React.ReactNode;
}) {
  const styles = {
    default: "border-white/10 bg-white/5 text-slate-200",
    high: "border-rose-400/30 bg-rose-500/10 text-rose-200",
    medium: "border-amber-400/30 bg-amber-500/10 text-amber-100",
    low: "border-sky-400/30 bg-sky-500/10 text-sky-100",
    valid: "border-emerald-400/30 bg-emerald-500/10 text-emerald-100",
    intentional: "border-violet-400/30 bg-violet-500/10 text-violet-100",
    ignore: "border-slate-400/30 bg-slate-500/10 text-slate-100",
  } as const;

  return (
    <span
      className={cn(
        "rounded-full border px-3 py-1 text-xs font-medium tracking-[0.18em] uppercase",
        styles[tone],
      )}
    >
      {children}
    </span>
  );
}

export function Stat({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className="rounded-3xl border border-white/8 bg-white/[0.03] p-4">
      <p className="text-xs uppercase tracking-[0.18em] text-slate-400">{label}</p>
      <p className="mt-3 text-3xl font-semibold text-white">{value}</p>
    </div>
  );
}
