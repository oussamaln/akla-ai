import DashboardLayout from "@/components/DashboardLayout";
import { ErrorCard, LoadingCard, PageHeader } from "@/components/AklaUi";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { Bot, Check, Rocket, Sparkles } from "lucide-react";
import { useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import { toast } from "sonner";

const initialAgent = {
  name: "",
  description: "",
  personality: "Friendly",
  systemInstructions: "",
  goals: "Help users understand this project and explore crypto concepts.",
  allowedActions:
    "Explain the project\nAnswer questions\nHelp users navigate Akla",
  prohibitedActions:
    "Do not request private keys, seed phrases, passwords, or guaranteed returns.",
  responseStyle: "Friendly",
};

export default function CreateAgent() {
  const [, setLocation] = useLocation();
  const projects = trpc.member.projects.mine.useQuery();
  const utils = trpc.useUtils();
  const [projectForm, setProjectForm] = useState({
    name: "",
    symbol: "",
    description: "",
    tokenContractAddress: "",
  });
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(
    null
  );
  const [agentForm, setAgentForm] = useState(initialAgent);
  const [preview, setPreview] = useState(false);
  const [createdAgent, setCreatedAgent] = useState<{
    id: number;
    slug: string;
  } | null>(null);
  const createProject = trpc.member.projects.create.useMutation({
    onSuccess: data => {
      setSelectedProjectId(Number(data.id));
      toast.success("Project identity created");
      utils.member.projects.mine.invalidate();
    },
    onError: error => toast.error(error.message),
  });
  const createAgent = trpc.member.agents.create.useMutation({
    onSuccess: data => {
      toast.success("Agent draft created");
      setCreatedAgent({ id: Number(data.id), slug: data.slug });
      utils.member.agents.mine.invalidate();
    },
    onError: error => toast.error(error.message),
  });
  const launchAgent = trpc.member.agents.launch.useMutation({
    onSuccess: () => {
      toast.success("Agent launched");
      if (createdAgent) setLocation(`/agents/${createdAgent.slug}`);
      utils.member.agents.explore.invalidate();
      utils.member.agents.arena.invalidate();
    },
    onError: error => toast.error(error.message),
  });
  const rows = projects.data ?? [];
  const selectable = useMemo(() => rows.map(row => row.project), [rows]);
  const activeProjectId = selectedProjectId ?? selectable[0]?.id ?? null;
  const selectedProject =
    selectable.find(project => project.id === activeProjectId) ?? selectable[0];
  const form = activeProjectId
    ? { ...agentForm, projectId: activeProjectId }
    : null;
  if (projects.isLoading)
    return (
      <DashboardLayout>
        <LoadingCard label="Loading creator studio…" />
      </DashboardLayout>
    );
  if (projects.error)
    return (
      <DashboardLayout>
        <ErrorCard message={projects.error.message} />
      </DashboardLayout>
    );
  return (
    <DashboardLayout>
      <PageHeader
        eyebrow="Creator studio"
        title="Build a project people can talk to"
        description="Create the project identity first, then shape an AI agent around it. Creator instructions are sandboxed beneath Akla’s platform safety rules."
      />
      <div className="mb-6 flex flex-wrap gap-2">
        <span className="rounded-full bg-violet-500/15 px-3 py-1.5 text-xs font-semibold text-violet-100">
          1 · Project
        </span>
        <span
          className={`rounded-full px-3 py-1.5 text-xs font-semibold ${selectedProject ? "bg-violet-500/15 text-violet-100" : "bg-white/[0.05] text-slate-500"}`}
        >
          2 · Agent
        </span>
        <span className="rounded-full bg-white/[0.05] px-3 py-1.5 text-xs font-semibold text-slate-500">
          3 · Launch
        </span>
      </div>
      <div className="grid gap-6 xl:grid-cols-[.85fr_1.15fr]">
        <section className="space-y-6">
          <article className="panel-surface p-6">
            <div className="flex items-start gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-2xl bg-violet-500/15 text-violet-200">
                <Sparkles className="h-5 w-5" />
              </span>
              <div>
                <p className="eyebrow">Project identity</p>
                <h2 className="mt-2 font-display text-2xl font-semibold text-white">
                  Create project
                </h2>
              </div>
            </div>
            <div className="mt-5 grid gap-3">
              <Input
                placeholder="Project name"
                value={projectForm.name}
                onChange={e =>
                  setProjectForm({ ...projectForm, name: e.target.value })
                }
                className="field-dark"
              />
              <Input
                placeholder="Token symbol (optional)"
                value={projectForm.symbol}
                onChange={e =>
                  setProjectForm({
                    ...projectForm,
                    symbol: e.target.value.toUpperCase(),
                  })
                }
                className="field-dark"
              />
              <Textarea
                placeholder="What is this project about?"
                value={projectForm.description}
                onChange={e =>
                  setProjectForm({
                    ...projectForm,
                    description: e.target.value,
                  })
                }
                className="field-dark min-h-28"
              />
              <Input
                placeholder="Existing testnet token contract (optional)"
                value={projectForm.tokenContractAddress}
                onChange={e =>
                  setProjectForm({
                    ...projectForm,
                    tokenContractAddress: e.target.value,
                  })
                }
                className="field-dark"
              />
              <p className="text-xs leading-5 text-slate-500">
                Token deployment remains testnet-only. If you already deployed
                an audited ERC-20 on Robinhood Chain Testnet, attach its
                verified contract identity here.
              </p>
              <div className="rounded-xl border border-white/[0.06] bg-white/[0.025] p-3 text-xs leading-5 text-slate-400">
                <span className="font-semibold text-slate-200">
                  Ship checklist:
                </span>{" "}
                verify the token in{" "}
                <Link
                  href="/proof-of-passage"
                  className="text-violet-200 hover:text-white"
                >
                  Proof of Passage
                </Link>
                , then invite contributors through{" "}
                <Link
                  href="/referrals"
                  className="text-violet-200 hover:text-white"
                >
                  Referrals
                </Link>
                .
              </div>
              <Button
                onClick={() =>
                  createProject.mutate({
                    ...projectForm,
                    symbol: projectForm.symbol || undefined,
                    tokenContractAddress:
                      projectForm.tokenContractAddress || undefined,
                  })
                }
                disabled={
                  createProject.isPending ||
                  !projectForm.name ||
                  projectForm.description.length < 10
                }
                className="bg-violet-500 text-white hover:bg-violet-400"
              >
                {createProject.isPending ? "Creating…" : "Create project"}
              </Button>
            </div>
          </article>
          <article className="panel-surface p-6">
            <p className="eyebrow">Your projects</p>
            <h2 className="mt-2 font-display text-2xl font-semibold text-white">
              Choose a project
            </h2>
            <div className="mt-5 space-y-2">
              {selectable.length ? (
                selectable.map(project => (
                  <button
                    type="button"
                    key={project.id}
                    onClick={() => setSelectedProjectId(project.id)}
                    className={`flex w-full items-center justify-between rounded-xl border p-4 text-left transition ${selectedProject?.id === project.id ? "border-violet-300/30 bg-violet-300/[0.08]" : "border-white/[0.07] bg-white/[0.025] hover:bg-white/[0.05]"}`}
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold text-white">
                        {project.name}
                      </span>
                      <span className="mt-1 block truncate text-xs text-slate-500">
                        {project.symbol
                          ? `$${project.symbol}`
                          : "Project token not configured"}
                      </span>
                    </span>
                    {selectedProject?.id === project.id && (
                      <Check className="h-4 w-4 shrink-0 text-violet-200" />
                    )}
                  </button>
                ))
              ) : (
                <p className="text-sm leading-6 text-slate-500">
                  Create a project to unlock agent setup.
                </p>
              )}
            </div>
          </article>
        </section>
        <section className="panel-surface p-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="eyebrow">Agent configuration</p>
              <h2 className="mt-2 font-display text-2xl font-semibold text-white">
                Create your AI agent
              </h2>
              <p className="mt-2 text-sm leading-6 text-slate-400">
                {selectedProject
                  ? `Connected to ${selectedProject.name}.`
                  : "Select or create a project first."}
              </p>
            </div>
            <Bot className="h-6 w-6 text-fuchsia-200" />
          </div>
          {selectedProject && (
            <>
              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                <Input
                  placeholder="Agent name"
                  value={agentForm.name}
                  onChange={e =>
                    setAgentForm({ ...agentForm, name: e.target.value })
                  }
                  className="field-dark"
                />
                <select
                  value={agentForm.personality}
                  onChange={e =>
                    setAgentForm({ ...agentForm, personality: e.target.value })
                  }
                  className="field-dark flex h-10 w-full rounded-md px-3 text-sm"
                >
                  <option>Friendly</option>
                  <option>Analytical</option>
                  <option>Funny</option>
                  <option>Serious</option>
                  <option>Mysterious</option>
                  <option>Educational</option>
                  <option>Sarcastic</option>
                  <option>Custom</option>
                </select>
                <Textarea
                  placeholder="Description"
                  value={agentForm.description}
                  onChange={e =>
                    setAgentForm({ ...agentForm, description: e.target.value })
                  }
                  className="field-dark min-h-24 sm:col-span-2"
                />
                <Textarea
                  placeholder="System instructions (creator context)"
                  value={agentForm.systemInstructions}
                  onChange={e =>
                    setAgentForm({
                      ...agentForm,
                      systemInstructions: e.target.value,
                    })
                  }
                  className="field-dark min-h-24 sm:col-span-2"
                />
                <Textarea
                  placeholder="Goals"
                  value={agentForm.goals}
                  onChange={e =>
                    setAgentForm({ ...agentForm, goals: e.target.value })
                  }
                  className="field-dark min-h-20"
                />
                <Textarea
                  placeholder="Response style"
                  value={agentForm.responseStyle}
                  onChange={e =>
                    setAgentForm({
                      ...agentForm,
                      responseStyle: e.target.value,
                    })
                  }
                  className="field-dark min-h-20"
                />
                <Textarea
                  placeholder="Allowed actions"
                  value={agentForm.allowedActions}
                  onChange={e =>
                    setAgentForm({
                      ...agentForm,
                      allowedActions: e.target.value,
                    })
                  }
                  className="field-dark min-h-20"
                />
                <Textarea
                  placeholder="Prohibited actions"
                  value={agentForm.prohibitedActions}
                  onChange={e =>
                    setAgentForm({
                      ...agentForm,
                      prohibitedActions: e.target.value,
                    })
                  }
                  className="field-dark min-h-20"
                />
              </div>
              <div className="mt-6 flex flex-col gap-2 sm:flex-row">
                <Button
                  variant="outline"
                  onClick={() => setPreview(!preview)}
                  className="border-white/10 text-slate-200 hover:bg-white/[0.06]"
                >
                  {preview ? "Hide preview" : "Preview agent"}
                </Button>
                <Button
                  onClick={() => form && createAgent.mutate(form)}
                  disabled={
                    createAgent.isPending ||
                    !form?.name ||
                    (form?.description.length ?? 0) < 10
                  }
                  className="bg-violet-500 text-white hover:bg-violet-400"
                >
                  <Rocket className="mr-2 h-4 w-4" />
                  {createAgent.isPending ? "Creating…" : "Create agent"}
                </Button>
              </div>
              {preview && (
                <div className="mt-6 rounded-2xl border border-violet-300/20 bg-violet-300/[0.06] p-5">
                  <p className="eyebrow">Preview</p>
                  <h3 className="mt-2 font-display text-2xl font-semibold text-white">
                    {agentForm.name || "Unnamed agent"}
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-slate-300">
                    {agentForm.description ||
                      "Your agent description will appear here."}
                  </p>
                  <p className="mt-4 text-xs text-violet-100">
                    {agentForm.personality} · {agentForm.responseStyle}
                  </p>
                </div>
              )}
              {createdAgent && (
                <div className="mt-6 rounded-2xl border border-emerald-300/20 bg-emerald-300/[0.06] p-5">
                  <p className="eyebrow text-emerald-200">Draft ready</p>
                  <h3 className="mt-2 font-display text-xl font-semibold text-white">
                    Your agent is configured
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-slate-300">
                    Launch it when the project identity, safety boundaries, and
                    response style look right. Launched agents appear in Explore
                    and Agent Arena.
                  </p>
                  <Button
                    onClick={() =>
                      launchAgent.mutate({ agentId: createdAgent.id })
                    }
                    disabled={launchAgent.isPending}
                    className="mt-4 bg-emerald-400 text-[#081316] hover:bg-emerald-300"
                  >
                    {launchAgent.isPending ? "Launching…" : "Launch agent"}
                  </Button>
                </div>
              )}
            </>
          )}
        </section>
      </div>
    </DashboardLayout>
  );
}
