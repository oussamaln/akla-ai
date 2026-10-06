import DashboardLayout from "@/components/DashboardLayout";
import { ErrorCard, LoadingCard } from "@/components/AklaUi";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/_core/hooks/useAuth";
import { startLogin } from "@/const";
import { trpc } from "@/lib/trpc";
import { ArrowLeft, Bot, Check, Coins, Send, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { Link, useRoute } from "wouter";
import { toast } from "sonner";

type ChatMessage = { role: "user" | "assistant"; content: string };

export default function AgentPage() {
  const [, params] = useRoute("/agents/:slug");
  const slug = params?.slug ?? "";
  const { user } = useAuth();
  const agent = trpc.member.agents.public.useQuery(
    { slug },
    { enabled: Boolean(slug) }
  );
  const balance = trpc.member.credits.balance.useQuery(undefined, {
    enabled: Boolean(user),
  });
  const utils = trpc.useUtils();
  const [conversationId] = useState(() => crypto.randomUUID());
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [rated, setRated] = useState(false);
  const chat = trpc.member.agents.chat.useMutation({
    onSuccess: data => {
      setMessages(current => [
        ...current,
        { role: "assistant", content: data.reply },
      ]);
      setMessage("");
      utils.member.credits.balance.invalidate();
    },
    onError: error => toast.error(error.message),
  });
  const feedback = trpc.member.agents.feedback.useMutation({
    onSuccess: () => {
      setRated(true);
      toast.success("Thanks for helping improve this agent.");
    },
    onError: error => toast.error(error.message),
  });
  const Shell = user ? DashboardLayout : PublicShell;
  if (agent.isLoading)
    return (
      <Shell>
        <LoadingCard label="Loading agent profile…" />
      </Shell>
    );
  if (agent.error || !agent.data)
    return (
      <Shell>
        <ErrorCard message={agent.error?.message ?? "Agent unavailable."} />
      </Shell>
    );
  const { agent: profile, project, creator, stats } = agent.data;
  const send = () => {
    if (!message.trim() || chat.isPending) return;
    if (!user) {
      startLogin();
      return;
    }
    setMessages(current => [
      ...current,
      { role: "user", content: message.trim() },
    ]);
    chat.mutate({
      agentId: profile.id,
      conversationId,
      message: message.trim(),
    });
  };
  return (
    <Shell>
      <Link href="/explore">
        <span className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-white">
          <ArrowLeft className="h-4 w-4" />
          Back to Explore
        </span>
      </Link>
      <div className="mt-5 grid gap-6 xl:grid-cols-[.75fr_1.25fr]">
        <section className="space-y-4">
          <article className="panel-surface p-6">
            <div className="flex items-start gap-4">
              <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-violet-500/15 text-violet-200">
                <Bot className="h-7 w-7" />
              </span>
              <div className="min-w-0">
                <p className="eyebrow">Launched agent</p>
                <h1 className="mt-2 font-display text-3xl font-semibold text-white">
                  {profile.name}
                </h1>
                <p className="mt-1 text-sm text-violet-200">
                  {creator?.username ? `@${creator.username}` : "Akla creator"}
                </p>
              </div>
            </div>
            <p className="mt-6 text-sm leading-7 text-slate-300">
              {profile.description}
            </p>
            <div className="mt-6 space-y-3">
              <Info
                label="Project"
                value={`${project.name}${project.symbol ? ` · $${project.symbol}` : ""}`}
              />
              <Info
                label="Contract"
                value={
                  project.tokenContractAddress
                    ? `${project.tokenContractAddress.slice(0, 6)}…${project.tokenContractAddress.slice(-4)}`
                    : "Not configured"
                }
              />
              <Info label="Personality" value={profile.personality} />
              <Info
                label="Community usage"
                value={`${stats.messages} messages recorded`}
              />
            </div>
          </article>
          <article className="panel-surface p-5">
            <div className="flex items-start gap-3">
              <ShieldCheck className="mt-0.5 h-5 w-5 text-emerald-200" />
              <p className="text-sm leading-6 text-slate-400">
                Creator instructions are combined with Akla platform rules. This
                agent will never request private keys, seed phrases, passwords,
                or guaranteed returns.
              </p>
            </div>
          </article>
        </section>
        <section className="panel-surface flex min-h-[620px] min-w-0 flex-col p-5 sm:p-6">
          <div className="flex flex-col gap-3 border-b border-white/[0.07] pb-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="eyebrow">Chat with agent</p>
              <h2 className="mt-2 font-display text-2xl font-semibold text-white">
                Ask {profile.name}
              </h2>
            </div>
            {user ? (
              <span className="inline-flex w-fit items-center gap-2 rounded-full bg-amber-300/10 px-3 py-1.5 text-xs font-semibold text-amber-100">
                <Coins className="h-3.5 w-3.5" />
                {balance.data ?? 0} Credits · 1 / message
              </span>
            ) : (
              <Button
                onClick={() => startLogin()}
                className="bg-violet-500 text-white hover:bg-violet-400"
              >
                Sign in to chat
              </Button>
            )}
          </div>
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto py-5">
            {messages.length ? (
              messages.map((item, index) => (
                <div
                  key={`${item.role}-${index}`}
                  className={`flex ${item.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[88%] rounded-2xl px-4 py-3 text-sm leading-6 ${item.role === "user" ? "bg-violet-500 text-white" : "bg-white/[0.05] text-slate-200"}`}
                  >
                    {item.content}
                  </div>
                </div>
              ))
            ) : (
              <div className="grid h-full min-h-64 place-items-center text-center">
                <div>
                  <Bot className="mx-auto h-10 w-10 text-violet-200" />
                  <p className="mt-4 font-display text-xl font-semibold text-white">
                    Start a useful conversation
                  </p>
                  <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-slate-500">
                    Ask about the project, token identity, or the community
                    problem this agent is built to solve.
                  </p>
                </div>
              </div>
            )}
          </div>
          <div className="border-t border-white/[0.07] pt-4">
            <Textarea
              value={message}
              onChange={e => setMessage(e.target.value)}
              onKeyDown={e => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
              placeholder="Type your message…"
              className="field-dark min-h-24"
              maxLength={2000}
            />
            <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <span className="text-xs text-slate-600">
                Enter to send · Shift+Enter for a new line
              </span>
              <Button
                onClick={send}
                disabled={
                  !user ||
                  !message.trim() ||
                  chat.isPending ||
                  (balance.data ?? 0) < 1
                }
                className="bg-violet-500 text-white hover:bg-violet-400"
              >
                <Send className="mr-2 h-4 w-4" />
                {chat.isPending ? "Thinking…" : "Send message"}
              </Button>
            </div>
            {messages.some(item => item.role === "assistant") && (
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <span className="mr-1 text-xs text-slate-500">
                  How was this agent?
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={rated}
                  onClick={() =>
                    feedback.mutate({
                      agentId: profile.id,
                      conversationId,
                      rating: 5,
                    })
                  }
                  className="border-white/10 text-slate-300 hover:bg-emerald-300/10"
                >
                  <Check className="mr-1 h-3.5 w-3.5" />
                  Helpful
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={rated}
                  onClick={() =>
                    feedback.mutate({
                      agentId: profile.id,
                      conversationId,
                      rating: 3,
                    })
                  }
                  className="border-white/10 text-slate-300 hover:bg-white/[0.06]"
                >
                  Average
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={rated}
                  onClick={() =>
                    feedback.mutate({
                      agentId: profile.id,
                      conversationId,
                      rating: 1,
                    })
                  }
                  className="border-white/10 text-slate-300 hover:bg-rose-300/10"
                >
                  Not useful
                </Button>
              </div>
            )}
          </div>
        </section>
      </div>
    </Shell>
  );
}

function PublicShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-[#0b0b1b] px-4 py-6 sm:px-7 lg:px-10 lg:py-9">
      <header className="mx-auto mb-8 flex max-w-7xl items-center justify-between">
        <Link
          href="/explore"
          className="font-display text-lg font-semibold tracking-[-0.04em] text-white"
        >
          Akla AI
        </Link>
        <Button
          onClick={() => startLogin()}
          variant="outline"
          className="border-white/10 text-slate-200 hover:bg-white/[0.06]"
        >
          Sign in
        </Button>
      </header>
      <div className="mx-auto max-w-7xl">{children}</div>
    </main>
  );
}
function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-xl bg-white/[0.035] px-3 py-2.5">
      <span className="text-xs text-slate-500">{label}</span>
      <span className="max-w-[65%] truncate text-right text-xs text-slate-200">
        {value}
      </span>
    </div>
  );
}
