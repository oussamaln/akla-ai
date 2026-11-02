import DashboardLayout from "@/components/DashboardLayout";
import { ErrorCard, LoadingCard } from "@/components/AklaUi";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/_core/hooks/useAuth";
import { startLogin } from "@/const";
import { trpc } from "@/lib/trpc";
import { encodeFunctionData, parseUnits } from "viem";
import {
  ArrowLeft,
  Bot,
  Check,
  ExternalLink,
  Send,
  ShieldCheck,
  WalletCards,
} from "lucide-react";
import { useState } from "react";
import { Link, useRoute } from "wouter";
import { toast } from "sonner";
import {
  AI_MESSAGE_TOKEN_COST,
  PROJECT_TOKEN_BUY_URL,
  PROJECT_TOKEN_CHAIN_ID,
} from "../../../shared/projectToken";

type ChatMessage = { role: "user" | "assistant"; content: string };

const TOKEN_TRANSFER_ABI = [
  {
    type: "function",
    name: "transfer",
    stateMutability: "nonpayable",
    inputs: [
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ type: "bool" }],
  },
] as const;

export default function AgentPage() {
  const [, params] = useRoute("/agents/:slug");
  const slug = params?.slug ?? "";
  const { user } = useAuth();
  const agent = trpc.member.agents.public.useQuery(
    { slug },
    { enabled: Boolean(slug) }
  );
  const config = trpc.member.tokenPayments.config.useQuery(undefined, {
    enabled: Boolean(user),
  });
  const utils = trpc.useUtils();
  const [conversationId] = useState(() => crypto.randomUUID());
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [rated, setRated] = useState(false);
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [paymentState, setPaymentState] = useState<
    "idle" | "awaiting" | "submitted" | "verifying" | "failed"
  >("idle");
  const eligibility = trpc.member.tokenPayments.eligibility.useQuery(
    {
      agentId: agent.data?.agent.id ?? 1,
      walletAddress: walletAddress ?? undefined,
    },
    { enabled: Boolean(user && agent.data?.agent.id && walletAddress) }
  );
  const balance = trpc.member.tokenPayments.balance.useQuery(
    {
      walletAddress:
        walletAddress ?? "0x0000000000000000000000000000000000000000",
    },
    { enabled: Boolean(user && walletAddress) }
  );
  const verifyPayment = trpc.member.tokenPayments.verify.useMutation();
  const chat = trpc.member.agents.chat.useMutation({
    onSuccess: data => {
      setMessages(current => [
        ...current,
        { role: "assistant", content: data.reply },
      ]);
      setMessage("");
      setPaymentState("idle");
    },
    onError: error => {
      setPaymentState("failed");
      toast.error(error.message);
    },
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
  const connectWallet = async () => {
    if (!window.ethereum)
      throw new Error("Install or unlock a wallet to continue.");
    const accounts = (await window.ethereum.request({
      method: "eth_requestAccounts",
    })) as string[];
    const address = accounts[0];
    if (!address) throw new Error("Connect a wallet before continuing.");
    await window.ethereum.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: `0x${PROJECT_TOKEN_CHAIN_ID.toString(16)}` }],
    });
    setWalletAddress(address);
    await eligibility.refetch();
    return address;
  };

  const send = async () => {
    if (!message.trim() || chat.isPending || verifyPayment.isPending) return;
    if (!user) {
      startLogin();
      return;
    }
    if (!config.data?.configured || !config.data.treasuryAddress) {
      toast.error(
        "Token payments are not configured yet. Please contact the administrator."
      );
      return;
    }
    try {
      setPaymentState("awaiting");
      const address = walletAddress ?? (await connectWallet());
      const currentEligibility =
        await utils.member.tokenPayments.eligibility.fetch({
          agentId: profile.id,
          walletAddress: address,
        });
      if (!currentEligibility.eligible) {
        setPaymentState("failed");
        toast.error(currentEligibility.reason);
        return;
      }
      const currentBalance = await utils.member.tokenPayments.balance.fetch({
        walletAddress: address,
      });
      if (!currentBalance.sufficient) {
        setPaymentState("failed");
        toast.error(
          `You need ${config.data.messageCost ?? AI_MESSAGE_TOKEN_COST} Project Tokens to continue.`
        );
        return;
      }
      if (config.data.decimals === null) {
        throw new Error(
          "The project-token decimals are unavailable right now."
        );
      }
      const amount = parseUnits(
        String(config.data.messageCost ?? AI_MESSAGE_TOKEN_COST),
        config.data.decimals
      );
      const data = encodeFunctionData({
        abi: TOKEN_TRANSFER_ABI,
        functionName: "transfer",
        args: [config.data.treasuryAddress as `0x${string}`, amount],
      });
      const txHash = (await window.ethereum!.request({
        method: "eth_sendTransaction",
        params: [{ from: address, to: config.data.tokenAddress, data }],
      })) as string;
      setPaymentState("submitted");
      const payment = await verifyPayment.mutateAsync({
        agentId: profile.id,
        walletAddress: address,
        chainId: PROJECT_TOKEN_CHAIN_ID,
        txHash,
      });
      setPaymentState("verifying");
      const text = message.trim();
      setMessages(current => [...current, { role: "user", content: text }]);
      chat.mutate({
        agentId: profile.id,
        conversationId,
        message: text,
        paymentId: payment.id,
      });
    } catch (error) {
      setPaymentState("failed");
      toast.error(
        error instanceof Error ? error.message : "Payment was not completed."
      );
    }
  };

  const paymentLabel =
    paymentState === "awaiting"
      ? "Awaiting wallet approval…"
      : paymentState === "submitted"
        ? "Waiting for confirmation…"
        : paymentState === "verifying"
          ? "Payment verified · thinking…"
          : chat.isPending
            ? "Thinking…"
            : `Pay ${config.data?.messageCost ?? AI_MESSAGE_TOKEN_COST} tokens & send`;

  return (
    <Shell>
      <Link href="/explore">
        <span className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-white">
          <ArrowLeft className="h-4 w-4" /> Back to Explore
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
              <p className="eyebrow">Paid chat · testnet</p>
              <h2 className="mt-2 font-display text-2xl font-semibold text-white">
                Ask {profile.name}
              </h2>
            </div>
            {user ? (
              <span className="inline-flex w-fit items-center gap-2 rounded-full bg-amber-300/10 px-3 py-1.5 text-xs font-semibold text-amber-100">
                <WalletCards className="h-3.5 w-3.5" />{" "}
                {config.data?.messageCost ?? AI_MESSAGE_TOKEN_COST} Project
                Tokens / message
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
          {user && (
            <div className="mt-4 rounded-2xl border border-amber-200/10 bg-amber-200/[0.05] p-4 text-sm text-slate-300">
              <p className="font-semibold text-amber-100">
                Every message costs{" "}
                {config.data?.messageCost ?? AI_MESSAGE_TOKEN_COST} Project
                Tokens.
              </p>
              <p className="mt-1 leading-6">
                Connect the wallet used for Proof of Passage, then approve the
                exact token transfer. The backend verifies the transaction
                before the agent responds.
              </p>
              {!config.data?.configured && (
                <p className="mt-2 text-rose-200">
                  Token payments are waiting for the administrator to configure
                  the treasury.
                </p>
              )}
              {walletAddress && !eligibility.data?.eligible && (
                <p className="mt-2 text-amber-100">
                  {eligibility.data?.reason ??
                    "Complete Proof of Passage before chatting."}
                </p>
              )}
              {walletAddress && balance.data?.balance !== null && (
                <p className="mt-2 text-slate-400">
                  Verified balance: {balance.data?.balance ?? "—"} Project
                  Tokens
                </p>
              )}
              {walletAddress && balance.data && !balance.data.sufficient && (
                <p className="mt-2 text-rose-200">
                  You need {config.data?.messageCost ?? AI_MESSAGE_TOKEN_COST}{" "}
                  Project Tokens to continue.
                </p>
              )}
              <div className="mt-3 flex flex-wrap gap-2">
                <a
                  href={PROJECT_TOKEN_BUY_URL}
                  target="_blank"
                  rel="noreferrer"
                >
                  <Button
                    size="sm"
                    className="bg-amber-300 text-slate-950 hover:bg-amber-200"
                  >
                    <ExternalLink className="mr-2 h-3.5 w-3.5" />
                    Buy Project Token
                  </Button>
                </a>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    connectWallet().catch(error => toast.error(error.message))
                  }
                  className="border-white/10 text-slate-200 hover:bg-white/[0.06]"
                >
                  Refresh Balance / wallet
                </Button>
              </div>
            </div>
          )}
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
                    Own the project token, complete Proof of Passage, and pay
                    per verified message.
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
                  void send();
                }
              }}
              placeholder="Type your message…"
              className="field-dark min-h-24"
              maxLength={2000}
            />
            <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <span className="text-xs text-slate-500">
                {config.data?.messageCost ?? AI_MESSAGE_TOKEN_COST} Project
                Tokens · Enter to send · Shift+Enter for a new line
              </span>
              <Button
                onClick={() => void send()}
                disabled={
                  !user ||
                  !message.trim() ||
                  chat.isPending ||
                  verifyPayment.isPending
                }
                className="bg-violet-500 text-white hover:bg-violet-400"
              >
                <Send className="mr-2 h-4 w-4" />
                {paymentLabel}
              </Button>
            </div>
            {paymentState === "failed" && (
              <p className="mt-3 text-xs text-rose-200">
                Payment was not verified. No AI response was generated.
              </p>
            )}
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
