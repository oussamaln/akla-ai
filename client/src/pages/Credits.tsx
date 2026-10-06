import DashboardLayout from "@/components/DashboardLayout";
import { ErrorCard, LoadingCard, PageHeader } from "@/components/AklaUi";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import { CheckCircle2, Coins, ExternalLink, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export default function Credits() {
  const balance = trpc.member.credits.balance.useQuery();
  const packages = trpc.member.credits.packages.useQuery();
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [txHash, setTxHash] = useState("");
  const verify = trpc.member.credits.verifyPurchase.useMutation({
    onSuccess: data => {
      toast.success(`${data.credited} AI Credits added`);
      setTxHash("");
      balance.refetch();
    },
    onError: error => toast.error(error.message),
  });
  if (balance.isLoading || packages.isLoading)
    return (
      <DashboardLayout>
        <LoadingCard label="Loading AI Credit economy…" />
      </DashboardLayout>
    );
  if (balance.error || packages.error)
    return (
      <DashboardLayout>
        <ErrorCard
          message={
            balance.error?.message ??
            packages.error?.message ??
            "Credits unavailable."
          }
        />
      </DashboardLayout>
    );
  const selected = (packages.data ?? []).find(pkg => pkg.id === selectedId);
  return (
    <DashboardLayout>
      <PageHeader
        eyebrow="AI Credit economy"
        title="Fuel useful conversations"
        description="AI Credits pay for agent usage. They are separate from Akla website points and separate from any project token."
      />
      <div className="grid gap-4 md:grid-cols-3">
        <Metric
          label="Current balance"
          value={`${balance.data ?? 0} Credits`}
          accent="violet"
        />
        <Metric label="Message cost" value="Configurable" accent="amber" />
        <Metric label="Network" value="Testnet only" accent="mint" />
      </div>
      <div className="mt-6 grid gap-6 xl:grid-cols-[1.15fr_.85fr]">
        <section className="panel-surface p-6">
          <div className="flex items-start gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-2xl bg-amber-300/10 text-amber-100">
              <Coins className="h-5 w-5" />
            </span>
            <div>
              <p className="eyebrow">Credit packages</p>
              <h2 className="mt-2 font-display text-2xl font-semibold text-white">
                Choose a testnet package
              </h2>
            </div>
          </div>
          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            {(packages.data ?? []).map(pkg => (
              <button
                type="button"
                key={pkg.id}
                onClick={() => setSelectedId(pkg.id)}
                className={`rounded-2xl border p-4 text-left transition ${selectedId === pkg.id ? "border-violet-300/30 bg-violet-300/[0.08]" : "border-white/[0.07] bg-white/[0.025] hover:bg-white/[0.05]"}`}
              >
                <p className="text-sm font-semibold text-white">{pkg.name}</p>
                <p className="mt-2 font-display text-2xl font-semibold text-amber-100">
                  {pkg.credits}
                </p>
                <p className="mt-1 text-xs text-slate-500">AI Credits</p>
                <p className="mt-4 break-all font-mono text-[11px] text-slate-500">
                  {pkg.priceWei} wei
                </p>
              </button>
            ))}
          </div>
          {!packages.data?.length && (
            <div className="mt-5 rounded-2xl border border-white/[0.07] p-5 text-sm leading-6 text-slate-500">
              No active packages have been configured by an administrator yet.
            </div>
          )}
        </section>
        <section className="panel-surface p-6">
          <p className="eyebrow">Verify a purchase</p>
          <h2 className="mt-2 font-display text-2xl font-semibold text-white">
            Add Credits after settlement
          </h2>
          <p className="mt-2 text-sm leading-6 text-slate-400">
            Send the exact selected amount from your verified wallet to the
            server-configured treasury on Robinhood Chain Testnet, then paste
            the transaction hash. The backend verifies chain, sender, recipient,
            value, receipt status, and duplicate crediting.
          </p>
          <div className="mt-6 space-y-3">
            <Input
              value={txHash}
              onChange={e => setTxHash(e.target.value)}
              placeholder="0x transaction hash"
              className="field-dark font-mono text-xs"
            />
            <Button
              onClick={() =>
                selected && verify.mutate({ packageId: selected.id, txHash })
              }
              disabled={!selected || txHash.length !== 66 || verify.isPending}
              className="w-full bg-violet-500 text-white hover:bg-violet-400"
            >
              {verify.isPending
                ? "Verifying on-chain…"
                : selected
                  ? `Verify ${selected.credits} Credits`
                  : "Select a package"}
            </Button>
          </div>
          <div className="mt-6 space-y-3 rounded-2xl border border-amber-300/15 bg-amber-300/[0.06] p-4 text-xs leading-5 text-amber-100">
            <p className="flex items-center gap-2 font-semibold">
              <ShieldCheck className="h-4 w-4" />
              Robinhood Chain Testnet only
            </p>
            <p>
              Testnet ETH has no real monetary value. No mainnet payments are
              supported.
            </p>
            <p>
              Purchases remain unavailable until the Admin Console configures a
              treasury address and package prices.
            </p>
          </div>
        </section>
      </div>
    </DashboardLayout>
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
