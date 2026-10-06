import DashboardLayout from "@/components/DashboardLayout";
import { ErrorCard, LoadingCard, PageHeader } from "@/components/AklaUi";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { Bot, Medal, Trophy } from "lucide-react";
import { Link } from "wouter";

export default function AgentArena() {
  const arena = trpc.member.agents.arena.useQuery();
  if (arena.isLoading)
    return (
      <DashboardLayout>
        <LoadingCard label="Calculating the Agent Arena…" />
      </DashboardLayout>
    );
  if (arena.error)
    return (
      <DashboardLayout>
        <ErrorCard message={arena.error.message} />
      </DashboardLayout>
    );
  const rows = arena.data ?? [];
  return (
    <DashboardLayout>
      <PageHeader
        eyebrow="Quality competition"
        title="Agent Arena"
        description="A platform metric built from feedback and unique users. It is not a financial indicator, and raw message count is never the only signal."
      />
      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        <Metric label="Quality feedback" value="Weighted" />
        <Metric label="Unique users" value="Included" />
        <Metric label="Creator reputation" value="Separate" />
      </div>
      {rows.length ? (
        <div className="space-y-3">
          {rows.map((row, index) => (
            <article
              key={row.agent.id}
              className="panel-surface flex flex-col gap-4 p-5 sm:flex-row sm:items-center"
            >
              <span
                className={`grid h-12 w-12 shrink-0 place-items-center rounded-2xl ${index === 0 ? "bg-amber-300/15 text-amber-100" : "bg-violet-500/15 text-violet-200"}`}
              >
                {index < 3 ? (
                  <Trophy className="h-5 w-5" />
                ) : (
                  <Medal className="h-5 w-5" />
                )}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold uppercase tracking-[.16em] text-slate-600">
                  #{index + 1}
                </p>
                <h2 className="mt-1 font-display text-xl font-semibold text-white">
                  {row.agent.name}
                </h2>
                <p className="mt-1 text-xs text-slate-500">
                  {row.project.symbol
                    ? `$${row.project.symbol}`
                    : row.project.name}{" "}
                  · {Number(row.messages)} unique users
                </p>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-right">
                  <p className="text-[10px] uppercase tracking-[.16em] text-slate-500">
                    Arena score
                  </p>
                  <p className="mt-1 font-display text-2xl font-semibold text-amber-100">
                    {row.score}
                  </p>
                </div>
                <Link href={`/agents/${row.agent.slug}`}>
                  <Button
                    variant="outline"
                    className="border-white/10 text-slate-200 hover:bg-white/[0.06]"
                  >
                    Open
                  </Button>
                </Link>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <section className="panel-surface p-10 text-center">
          <Bot className="mx-auto h-10 w-10 text-violet-200" />
          <h2 className="mt-4 font-display text-2xl font-semibold text-white">
            The arena opens with the first launched agent
          </h2>
          <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-400">
            Quality signals will appear once real users interact and leave
            feedback.
          </p>
          <Link href="/create-agent">
            <Button className="mt-6 bg-violet-500 text-white hover:bg-violet-400">
              Create an agent
            </Button>
          </Link>
        </section>
      )}
    </DashboardLayout>
  );
}
function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="panel-surface p-4">
      <p className="text-[10px] uppercase tracking-[.16em] text-slate-500">
        {label}
      </p>
      <p className="mt-2 font-display text-xl font-semibold text-white">
        {value}
      </p>
    </div>
  );
}
