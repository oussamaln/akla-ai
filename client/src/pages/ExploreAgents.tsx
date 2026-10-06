import DashboardLayout from "@/components/DashboardLayout";
import { ErrorCard, LoadingCard, PageHeader } from "@/components/AklaUi";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { ArrowUpRight, Bot, Compass, Plus } from "lucide-react";
import { Link } from "wouter";

export default function ExploreAgents() {
  const agents = trpc.member.agents.explore.useQuery({ sort: "active" });
  if (agents.isLoading)
    return (
      <DashboardLayout>
        <LoadingCard label="Finding launched agents…" />
      </DashboardLayout>
    );
  if (agents.error)
    return (
      <DashboardLayout>
        <ErrorCard message={agents.error.message} />
      </DashboardLayout>
    );
  const rows = agents.data ?? [];
  return (
    <DashboardLayout>
      <PageHeader
        eyebrow="Agent network"
        title="Explore agents"
        description="Discover launched community agents, inspect their project identity, and spend AI Credits only when you choose to start a conversation."
        action={
          <Link href="/create-agent">
            <Button className="bg-violet-500 text-white hover:bg-violet-400">
              <Plus className="mr-2 h-4 w-4" />
              Create agent
            </Button>
          </Link>
        }
      />
      <div className="mb-6 flex items-center gap-2 rounded-2xl border border-amber-300/15 bg-amber-300/[0.06] px-4 py-3 text-xs leading-5 text-amber-100">
        <Compass className="h-4 w-4 shrink-0" />
        Agent quality is based on real usage and feedback, not fabricated
        volume.
      </div>
      {rows.length ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {rows.map(({ agent, project, creator }) => (
            <Link
              key={agent.id}
              href={`/agents/${agent.slug}`}
              className="panel-surface group block p-5 transition hover:-translate-y-0.5 hover:border-violet-300/25"
            >
              <div className="flex items-start justify-between gap-3">
                <span className="grid h-11 w-11 place-items-center rounded-2xl bg-violet-500/15 text-violet-200">
                  <Bot className="h-5 w-5" />
                </span>
                <ArrowUpRight className="h-4 w-4 text-slate-600 transition group-hover:text-violet-200" />
              </div>
              <h2 className="mt-5 font-display text-xl font-semibold text-white">
                {agent.name}
              </h2>
              <p className="mt-1 text-xs text-violet-200">
                {creator?.username ? `@${creator.username}` : "Akla creator"} ·{" "}
                {project.symbol ? `$${project.symbol}` : "Project"}
              </p>
              <p className="mt-3 line-clamp-3 text-sm leading-6 text-slate-400">
                {agent.description}
              </p>
              <div className="mt-5 flex flex-wrap gap-2">
                <span className="rounded-full bg-white/[0.05] px-2.5 py-1 text-[10px] uppercase tracking-[.14em] text-slate-500">
                  {agent.personality}
                </span>
                <span className="rounded-full bg-white/[0.05] px-2.5 py-1 text-[10px] uppercase tracking-[.14em] text-slate-500">
                  {agent.responseStyle}
                </span>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <section className="panel-surface p-10 text-center">
          <Bot className="mx-auto h-10 w-10 text-violet-200" />
          <h2 className="mt-4 font-display text-2xl font-semibold text-white">
            No launched agents yet
          </h2>
          <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-400">
            Be the first creator to turn a project identity into a useful
            community agent.
          </p>
          <Link href="/create-agent">
            <Button className="mt-6 bg-violet-500 text-white hover:bg-violet-400">
              Open creator studio
            </Button>
          </Link>
        </section>
      )}
    </DashboardLayout>
  );
}
