import DashboardLayout from "@/components/DashboardLayout";
import { ErrorCard, formatPoints, LoadingCard, PageHeader } from "@/components/AklaUi";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { Crown, Medal, Trophy } from "lucide-react";
import { useState } from "react";

const scopes = ["global", "weekly", "monthly", "referral"] as const;
export default function Leaderboard() {
  const [scope, setScope] = useState<(typeof scopes)[number]>("global");
  const [page, setPage] = useState(0);
  const board = trpc.member.leaderboards.list.useQuery({ scope, page, pageSize: 20 });
  if (board.isLoading) return <DashboardLayout><LoadingCard label="Ranking the network…" /></DashboardLayout>;
  if (board.error || !board.data) return <DashboardLayout><ErrorCard message={board.error?.message || "The leaderboard could not be loaded."} /></DashboardLayout>;
  return <DashboardLayout><PageHeader eyebrow="Leaderboard" title="See the network in motion" description="Compare verified score, never raw account information. Your entry is highlighted whenever it appears in the selected ranking." />
    <div className="mb-6 flex flex-wrap gap-2">{scopes.map(item => <button key={item} onClick={() => { setScope(item); setPage(0); }} className={`rounded-full px-4 py-2 text-sm font-medium capitalize transition ${scope === item ? "bg-violet-500 text-white shadow-lg shadow-violet-500/20" : "bg-white/[0.04] text-slate-400 hover:bg-white/[0.08] hover:text-white"}`}>{item}</button>)}</div>
    <section className="panel-surface overflow-hidden"><div className="grid grid-cols-[44px_minmax(150px,1fr)_minmax(85px,.5fr)_66px] gap-3 border-b border-white/[0.07] px-5 py-4 text-[10px] font-semibold uppercase tracking-[.14em] text-slate-500 sm:grid-cols-[60px_minmax(220px,1fr)_minmax(120px,.6fr)_110px]"><span>Rank</span><span>Member</span><span>Network score</span><span>Multiplier</span></div>{board.data.length === 0 ? <div className="px-5 py-20 text-center text-sm text-slate-500">No qualifying activity has been recorded for this view yet.</div> : board.data.map(entry => <div key={entry.userId} className={`grid grid-cols-[44px_minmax(150px,1fr)_minmax(85px,.5fr)_66px] items-center gap-3 border-b border-white/[0.05] px-5 py-4 last:border-b-0 sm:grid-cols-[60px_minmax(220px,1fr)_minmax(120px,.6fr)_110px] ${entry.isCurrentUser ? "bg-violet-500/[0.09]" : ""}`}><div className="font-display text-lg font-semibold text-slate-300">{entry.rank <= 3 ? <span className="inline-flex items-center gap-1 text-amber-200">{entry.rank === 1 ? <Crown className="h-4 w-4" /> : <Medal className="h-4 w-4" />}{entry.rank}</span> : entry.rank}</div><div className="flex min-w-0 items-center gap-3"><Avatar className="h-9 w-9 border border-white/10 bg-violet-500/10"><AvatarFallback className="bg-transparent text-xs text-violet-200">{entry.username.slice(0, 2).toUpperCase()}</AvatarFallback></Avatar><span className="truncate text-sm font-medium text-white">{entry.username}{entry.isCurrentUser && <span className="ml-2 text-xs font-normal text-violet-200">You</span>}</span></div><span className="text-sm font-semibold text-white">{formatPoints(entry.networkScore)}</span><span className="font-display text-base font-semibold text-amber-100">{entry.multiplier.toFixed(1)}×</span></div>)}</section>
    <div className="mt-5 flex items-center justify-between"><p className="text-xs text-slate-500">Pagination keeps rankings efficient as the network grows.</p><div className="flex gap-2"><Button size="sm" variant="outline" disabled={page === 0} onClick={() => setPage(value => Math.max(0, value - 1))} className="border-white/10 text-slate-300 hover:bg-white/[0.06]">Previous</Button><Button size="sm" variant="outline" disabled={board.data.length < 20} onClick={() => setPage(value => value + 1)} className="border-white/10 text-slate-300 hover:bg-white/[0.06]">Next</Button></div></div>
  </DashboardLayout>;
}
