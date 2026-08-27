import { AtSign, BadgeCheck, CircleAlert, Instagram, LoaderCircle, MessageCircleMore, Send } from "lucide-react";

export function PageHeader({ eyebrow, title, description, action }: { eyebrow: string; title: string; description: string; action?: React.ReactNode }) {
  return <header className="mb-8 flex flex-col justify-between gap-5 sm:flex-row sm:items-end"><div><p className="eyebrow">{eyebrow}</p><h1 className="mt-2 font-display text-3xl font-semibold tracking-[-0.045em] text-white sm:text-4xl">{title}</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-slate-400">{description}</p></div>{action}</header>;
}

export function MetricCard({ label, value, hint, accent = "violet" }: { label: string; value: string; hint: string; accent?: "violet" | "amber" | "mint" | "blue" }) {
  const accents = { violet: "bg-violet-400", amber: "bg-amber-300", mint: "bg-emerald-300", blue: "bg-sky-300" };
  return <article className="panel-surface relative overflow-hidden p-5"><span className={`absolute left-0 top-0 h-full w-1 ${accents[accent]}`} /><p className="text-xs font-medium uppercase tracking-[0.14em] text-slate-500">{label}</p><p className="mt-4 font-display text-3xl font-semibold tracking-[-0.05em] text-white">{value}</p><p className="mt-2 text-xs text-slate-500">{hint}</p></article>;
}

export function StatusPill({ status }: { status: "verified" | "manual" | "unverified" | "pending" | "rejected" }) {
  const styles = { verified: "bg-emerald-400/10 text-emerald-200", manual: "bg-sky-400/10 text-sky-200", unverified: "bg-white/[0.06] text-slate-400", pending: "bg-amber-300/10 text-amber-100", rejected: "bg-rose-400/10 text-rose-200" };
  const label = status === "manual" ? "entered" : status;
  return <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium capitalize ${styles[status]}`}>{status === "verified" && <BadgeCheck className="h-3.5 w-3.5" />}{label}</span>;
}

const platformMeta = {
  x: { label: "X", className: "bg-white/10 text-white", icon: <span className="text-sm font-bold">X</span> },
  telegram: { label: "Telegram", className: "bg-sky-400/15 text-sky-200", icon: <Send className="h-4 w-4" /> },
  discord: { label: "Discord", className: "bg-indigo-400/15 text-indigo-200", icon: <MessageCircleMore className="h-4 w-4" /> },
  instagram: { label: "Instagram", className: "bg-gradient-to-br from-amber-300/25 via-fuchsia-400/20 to-violet-400/25 text-fuchsia-100", icon: <Instagram className="h-4 w-4" /> },
  email: { label: "Email", className: "bg-emerald-400/15 text-emerald-200", icon: <AtSign className="h-4 w-4" /> },
} as const;

export type SocialPlatform = keyof typeof platformMeta;

export function SocialPlatformAvatar({ platform, size = "md", showLabel = false }: { platform: SocialPlatform; size?: "sm" | "md"; showLabel?: boolean }) {
  const meta = platformMeta[platform];
  const sizing = size === "sm" ? "h-7 w-7" : "h-9 w-9";
  return <span className="inline-flex items-center gap-2"><span role="img" aria-label={meta.label} title={meta.label} className={`grid ${sizing} shrink-0 place-items-center rounded-full ring-1 ring-white/10 ${meta.className}`}>{meta.icon}</span>{showLabel && <span className="text-sm text-slate-300">{meta.label}</span>}</span>;
}

export function LoadingCard({ label = "Preparing your rewards space…" }: { label?: string }) { return <div className="panel-surface flex min-h-64 items-center justify-center gap-3 text-sm text-slate-400"><LoaderCircle className="h-4 w-4 animate-spin text-violet-300" />{label}</div>; }

export function ErrorCard({ message }: { message: string }) { return <div className="panel-surface flex gap-3 border-rose-400/20 p-5 text-sm text-rose-200"><CircleAlert className="h-5 w-5 shrink-0" /><p>{message}</p></div>; }

export function formatPoints(value: number) { return new Intl.NumberFormat("en-US").format(value); }

export function shortAddress(value?: string | null) { return value ? `${value.slice(0, 6)}…${value.slice(-4)}` : "Not connected"; }
