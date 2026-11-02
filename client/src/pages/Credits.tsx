import DashboardLayout from "@/components/DashboardLayout";
import { ErrorCard, LoadingCard, PageHeader } from "@/components/AklaUi";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import {
  ArrowRight,
  CheckCircle2,
  ExternalLink,
  ShieldCheck,
  WalletCards,
} from "lucide-react";
import { Link } from "wouter";
import {
  AI_MESSAGE_TOKEN_COST,
  PROJECT_TOKEN_ADDRESS,
  PROJECT_TOKEN_BUY_URL,
  PROJECT_TOKEN_CHAIN_ID,
} from "../../../shared/projectToken";

export default function Credits() {
  const config = trpc.member.tokenPayments.config.useQuery();
  if (config.isLoading)
    return (
      <DashboardLayout>
        <LoadingCard label="Loading project-token access…" />
      </DashboardLayout>
    );
  if (config.error)
    return (
      <DashboardLayout>
        <ErrorCard message={config.error.message} />
      </DashboardLayout>
    );
  return (
    <DashboardLayout>
      <PageHeader
        eyebrow="Project-token access"
        title="Own the token. Unlock the conversation."
        description="Akla AI uses the project token as the economic basis for AI access. Website Points and referrals remain separate from on-chain token payments."
      />
      <div className="grid gap-4 md:grid-cols-3">
        <Metric
          label="Per AI message"
          value={`${config.data?.messageCost ?? AI_MESSAGE_TOKEN_COST} tokens`}
          accent="amber"
        />
        <Metric label="Network" value="Robinhood Testnet" accent="mint" />
        <Metric label="Payment" value="Verified on-chain" accent="violet" />
      </div>
      <div className="mt-6 grid gap-6 xl:grid-cols-[1.05fr_.95fr]">
        <section className="panel-surface p-6">
          <div className="flex items-start gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-2xl bg-amber-300/10 text-amber-100">
              <WalletCards className="h-5 w-5" />
            </span>
            <div>
              <p className="eyebrow">The access loop</p>
              <h2 className="mt-2 font-display text-2xl font-semibold text-white">
                From token holder to AI access
              </h2>
            </div>
          </div>
          <div className="mt-6 space-y-3">
            <Step
              number="01"
              title="Buy Project Token"
              copy="Use the official testnet DApp. The purchase button always opens the configured buy page."
              done={false}
            />
            <Step
              number="02"
              title="Connect and verify your wallet"
              copy="Sign the Proof of Passage message on Robinhood Chain Testnet."
              done={false}
            />
            <Step
              number="03"
              title="Complete Proof of Passage"
              copy="The backend checks your real token balance and records the verification history."
              done={false}
            />
            <Step
              number="04"
              title="Pay per AI message"
              copy={`Each message transfers exactly ${config.data?.messageCost ?? AI_MESSAGE_TOKEN_COST} project tokens to the configured treasury, then the backend verifies it before the AI responds.`}
              done={false}
            />
          </div>
        </section>
        <section className="panel-surface p-6">
          <p className="eyebrow">Testnet token</p>
          <h2 className="mt-2 font-display text-2xl font-semibold text-white">
            Get ready to chat
          </h2>
          <p className="mt-2 text-sm leading-6 text-slate-400">
            No free AI response is issued after the payment requirement is
            exhausted. If a wallet cannot cover the next message, chat stays
            blocked and this purchase CTA remains the recovery path.
          </p>
          <a
            href={PROJECT_TOKEN_BUY_URL}
            target="_blank"
            rel="noreferrer"
            className="mt-6 block"
          >
            <Button className="w-full bg-amber-300 text-slate-950 hover:bg-amber-200">
              <ExternalLink className="mr-2 h-4 w-4" />
              Buy Project Token
            </Button>
          </a>
          <Link
            href="/proof-of-passage"
            className="mt-3 flex items-center justify-center gap-2 text-sm font-semibold text-violet-200 hover:text-white"
          >
            Open Proof of Passage <ArrowRight className="h-4 w-4" />
          </Link>
          <div className="mt-6 rounded-2xl border border-emerald-300/15 bg-emerald-300/[0.05] p-4 text-xs leading-5 text-emerald-100">
            <p className="flex items-center gap-2 font-semibold">
              <ShieldCheck className="h-4 w-4" />
              Secure payment boundary
            </p>
            <p className="mt-2">
              The server verifies chain, token contract, sender, treasury, exact
              amount, decimals, receipt status, transfer event, and transaction
              uniqueness. Testnet tokens have no real monetary value.
            </p>
          </div>
          <p className="mt-5 break-all text-[11px] leading-5 text-slate-600">
            Contract: {PROJECT_TOKEN_ADDRESS} · Chain ID:{" "}
            {PROJECT_TOKEN_CHAIN_ID}
          </p>
        </section>
      </div>
    </DashboardLayout>
  );
}

function Step({
  number,
  title,
  copy,
}: {
  number: string;
  title: string;
  copy: string;
  done: boolean;
}) {
  return (
    <div className="flex gap-3 rounded-2xl border border-white/[0.07] bg-white/[0.025] p-4">
      <span className="font-mono text-xs text-violet-200">{number}</span>
      <div>
        <p className="font-semibold text-white">{title}</p>
        <p className="mt-1 text-sm leading-6 text-slate-400">{copy}</p>
      </div>
      <CheckCircle2 className="ml-auto mt-0.5 h-4 w-4 shrink-0 text-slate-700" />
    </div>
  );
}
function Metric({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent: string;
}) {
  return (
    <div
      className={`panel-surface border-l-2 ${accent === "amber" ? "border-l-amber-300" : accent === "mint" ? "border-l-emerald-300" : "border-l-violet-300"} p-5`}
    >
      <p className="text-[10px] uppercase tracking-[.16em] text-slate-500">
        {label}
      </p>
      <p className="mt-2 font-display text-2xl font-semibold text-white">
        {value}
      </p>
    </div>
  );
}
