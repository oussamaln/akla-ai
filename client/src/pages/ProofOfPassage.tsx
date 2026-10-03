import DashboardLayout from "@/components/DashboardLayout";
import {
  ErrorCard,
  formatPoints,
  LoadingCard,
  PageHeader,
} from "@/components/AklaUi";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import {
  CheckCircle2,
  ExternalLink,
  KeyRound,
  Link2,
  Loader2,
  ShieldCheck,
  WalletCards,
  Zap,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

type Eip1193Provider = {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
  on?: (event: string, listener: (...args: unknown[]) => void) => void;
  removeListener?: (
    event: string,
    listener: (...args: unknown[]) => void
  ) => void;
};
declare global {
  interface Window {
    ethereum?: Eip1193Provider;
  }
}

type PassageResult = {
  status: string;
  verifiedBalance?: string;
  requiredBalance?: string;
  transaction?: { finalPoints: number } | null;
};
function shortenAddress(address: string) {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}
function chainHex(chainId: number) {
  return `0x${chainId.toString(16)}`;
}

export default function ProofOfPassage() {
  const status = trpc.member.passage.status.useQuery();
  const utils = trpc.useUtils();
  const [connectedAddress, setConnectedAddress] = useState("");
  const [connectedChainId, setConnectedChainId] = useState<number | null>(null);
  const [walletStep, setWalletStep] = useState<
    "idle" | "connecting" | "signing"
  >("idle");
  const [results, setResults] = useState<Record<number, PassageResult>>({});
  const refreshOnNetworkReturn = useRef(false);
  const challenge = trpc.member.passage.challenge.useMutation();
  const verifyWallet = trpc.member.passage.verifyWallet.useMutation();
  const verifyToken = trpc.member.passage.verifyToken.useMutation({
    onSuccess: (data, variables) => {
      setResults(current => ({
        ...current,
        [variables.taskId]: data as PassageResult,
      }));
      if (data.status === "verified" || data.status === "completed") {
        toast.success(
          data.transaction
            ? `Proof verified: +${formatPoints(data.transaction.finalPoints)} points.`
            : "Proof already completed."
        );
        utils.member.summary.invalidate();
        utils.member.questBoard.invalidate();
      } else
        toast.message("Not eligible yet", {
          description: `Detected ${data.verifiedBalance}; required ${data.requiredBalance}.`,
        });
    },
    onError: error => toast.error(error.message),
  });

  const config = status.data?.config;
  const tasks = status.data?.tasks ?? [];
  const wallet = status.data?.wallet;
  const address = connectedAddress || wallet?.address || "";
  const walletVerified =
    wallet?.verificationState === "verified" &&
    (!connectedAddress ||
      wallet.address.toLowerCase() === connectedAddress.toLowerCase());
  const wrongNetwork = Boolean(
    address && connectedChainId !== null && connectedChainId !== config?.chainId
  );
  const busy =
    walletStep !== "idle" || challenge.isPending || verifyWallet.isPending;
  const activeTaskIds = useMemo(
    () => new Set(tasks.map(task => task.id)),
    [tasks]
  );

  useEffect(() => {
    const provider = window.ethereum;
    if (!provider?.on) return;
    const onAccountsChanged = (...args: unknown[]) => {
      const accounts = (args[0] as string[] | undefined) ?? [];
      refreshOnNetworkReturn.current = false;
      setConnectedAddress(accounts[0] ?? "");
      setConnectedChainId(null);
      setResults({});
      utils.member.passage.status.invalidate();
      toast.message(
        accounts[0] ? "Wallet account changed" : "Wallet disconnected"
      );
    };
    const onChainChanged = (...args: unknown[]) => {
      const nextChainId = Number.parseInt(String(args[0] ?? "0"), 16);
      refreshOnNetworkReturn.current = nextChainId === config?.chainId;
      setConnectedChainId(nextChainId);
      setResults({});
      utils.member.passage.status.invalidate();
      toast.message(
        nextChainId === config?.chainId
          ? "Robinhood Chain Testnet detected"
          : "Wrong network detected"
      );
    };
    provider.on("accountsChanged", onAccountsChanged);
    provider.on("chainChanged", onChainChanged);
    return () => {
      provider.removeListener?.("accountsChanged", onAccountsChanged);
      provider.removeListener?.("chainChanged", onChainChanged);
    };
  }, [config?.chainId, utils]);

  useEffect(() => {
    if (
      !refreshOnNetworkReturn.current ||
      !address ||
      !walletVerified ||
      wrongNetwork ||
      activeTaskIds.size === 0
    )
      return;
    refreshOnNetworkReturn.current = false;
    tasks.forEach(task => verifyToken.mutate({ taskId: task.id, address }));
  }, [
    activeTaskIds,
    address,
    tasks,
    verifyToken,
    walletVerified,
    wrongNetwork,
  ]);

  async function connectWallet() {
    if (!window.ethereum) {
      toast.error(
        "No EVM wallet detected. Install MetaMask, Robinhood Wallet, or another compatible wallet."
      );
      return;
    }
    try {
      setWalletStep("connecting");
      const accounts = (await window.ethereum.request({
        method: "eth_requestAccounts",
      })) as string[];
      const nextAddress = accounts[0];
      if (!nextAddress) throw new Error("No wallet account was selected.");
      const chain = Number.parseInt(
        String(await window.ethereum.request({ method: "eth_chainId" })),
        16
      );
      setConnectedAddress(nextAddress);
      setConnectedChainId(chain);
      setResults({});
      if (chain !== config?.chainId) {
        toast.warning(
          `Switch to ${config?.chainName ?? "Robinhood Chain Testnet"} before signing.`
        );
        return;
      }
      setWalletStep("signing");
      const proof = await challenge.mutateAsync({
        address: nextAddress,
        chainId: chain,
      });
      const signature = (await window.ethereum.request({
        method: "personal_sign",
        params: [proof.message, nextAddress],
      })) as string;
      await verifyWallet.mutateAsync({
        address: nextAddress,
        chainId: chain,
        nonce: proof.nonce,
        signature,
      });
      await utils.member.passage.status.invalidate();
      toast.success("Wallet ownership verified.");
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Wallet connection was cancelled."
      );
    } finally {
      setWalletStep("idle");
    }
  }

  async function switchNetwork() {
    if (!window.ethereum || !config) return;
    try {
      await window.ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: chainHex(config.chainId) }],
      });
      setConnectedChainId(config.chainId);
      setResults({});
      toast.success(
        `Switched to ${config.chainName}. Connect again to verify ownership.`
      );
    } catch (error) {
      if ((error as { code?: number }).code === 4902) {
        await window.ethereum.request({
          method: "wallet_addEthereumChain",
          params: [
            {
              chainId: chainHex(config.chainId),
              chainName: config.chainName,
              nativeCurrency: {
                name: "Ether",
                symbol: config.nativeSymbol,
                decimals: 18,
              },
              rpcUrls: [config.rpcUrl],
            },
          ],
        });
        setConnectedChainId(config.chainId);
      } else toast.error("The wallet could not switch networks.");
    }
  }

  function verifyTask(taskId: number) {
    if (!address) return toast.error("Connect and verify a wallet first.");
    if (wrongNetwork)
      return toast.error(
        `Switch to ${config?.chainName ?? "Robinhood Chain Testnet"} first.`
      );
    verifyToken.mutate({ taskId, address });
  }

  if (status.isLoading)
    return (
      <DashboardLayout>
        <LoadingCard label="Loading Proof of Passage…" />
      </DashboardLayout>
    );
  if (status.error || !status.data)
    return (
      <DashboardLayout>
        <ErrorCard
          message={
            status.error?.message || "Proof of Passage could not be loaded."
          }
        />
      </DashboardLayout>
    );

  return (
    <DashboardLayout>
      <PageHeader
        eyebrow="Web3 frontier"
        title="Proof of Passage"
        description="Prepare for future cross-chain and interoperability experiences."
        action={
          <span className="inline-flex items-center gap-2 rounded-full border border-amber-300/20 bg-amber-300/10 px-3 py-2 text-xs font-medium text-amber-100">
            <span className="h-2 w-2 rounded-full bg-amber-300 shadow-[0_0_12px_rgba(252,211,77,.65)]" />
            {config?.chainName}
          </span>
        }
      />
      <div className="grid gap-6 xl:grid-cols-[1.2fr_.8fr]">
        <section className="space-y-6">
          <article className="panel-surface overflow-hidden p-6 sm:p-8">
            <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="eyebrow">Web3 tasks</p>
                <h2 className="mt-2 font-display text-3xl font-semibold tracking-[-.04em] text-white">
                  Passage tasks
                </h2>
                <p className="mt-3 max-w-xl text-sm leading-6 text-slate-400">
                  Select an active token task below. Akla reads each ERC-20
                  balance directly from Robinhood Chain Testnet and uses the
                  existing quest ledger for points.
                </p>
              </div>
              <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-violet-400/10 text-violet-200">
                <Zap className="h-6 w-6" />
              </span>
            </div>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <Button
                onClick={connectWallet}
                disabled={busy}
                className="bg-violet-500 text-white hover:bg-violet-400"
              >
                <WalletCards className="mr-2 h-4 w-4" />
                {walletStep === "signing"
                  ? "Sign in your wallet…"
                  : address
                    ? "Verify wallet ownership"
                    : "Connect wallet"}
              </Button>
              {wrongNetwork && (
                <Button
                  onClick={switchNetwork}
                  disabled={busy}
                  variant="outline"
                  className="border-amber-300/20 text-amber-100 hover:bg-amber-300/10"
                >
                  Switch network
                </Button>
              )}
              {address && (
                <span className="inline-flex items-center rounded-full bg-emerald-300/10 px-3 py-2 text-xs font-medium text-emerald-100">
                  {walletVerified ? "Wallet verified" : "Wallet connected"} ·{" "}
                  {shortenAddress(address)}
                </span>
              )}
            </div>
            {wrongNetwork && (
              <div className="mt-4 rounded-2xl border border-rose-300/20 bg-rose-300/[0.06] p-4 text-sm text-rose-100">
                <strong>Wrong network.</strong> Please switch to{" "}
                {config?.chainName} to refresh eligibility.
              </div>
            )}
          </article>
          {tasks.length ? (
            tasks.map(task => (
              <TaskCard
                key={task.id}
                task={task}
                result={results[task.id]}
                verifying={
                  verifyToken.isPending &&
                  verifyToken.variables?.taskId === task.id
                }
                disabled={!walletVerified || wrongNetwork}
                onVerify={() => verifyTask(task.id)}
              />
            ))
          ) : (
            <article className="panel-surface p-6">
              <p className="eyebrow">No active tasks</p>
              <h2 className="mt-2 font-display text-2xl font-semibold text-white">
                Passage is being configured
              </h2>
              <p className="mt-2 text-sm leading-6 text-slate-400">
                An Akla administrator has not enabled a token-holder task yet.
                No placeholder contract is used.
              </p>
            </article>
          )}
          <div className="grid gap-4 sm:grid-cols-3">
            <Step
              icon={<Link2 className="h-4 w-4" />}
              title="Connect"
              copy="Choose any standard EVM wallet."
            />
            <Step
              icon={<KeyRound className="h-4 w-4" />}
              title="Prove ownership"
              copy="Sign a one-time expiring challenge."
            />
            <Step
              icon={<ShieldCheck className="h-4 w-4" />}
              title="Verify passage"
              copy="Read each token balance from chain."
            />
          </div>
        </section>
        <aside className="space-y-6">
          <article className="panel-surface p-6">
            <p className="eyebrow">Network briefing</p>
            <h2 className="mt-2 font-display text-2xl font-semibold text-white">
              A clean path to interoperability
            </h2>
            <p className="mt-3 text-sm leading-6 text-slate-400">
              Proof of Passage is testnet-only today. Each configured task keeps
              its own contract, minimum, decimals, reward, and history while
              sharing the existing Akla quest engine.
            </p>
            <div className="mt-6 space-y-3">
              <InfoRow
                label="Chain ID"
                value={String(config?.chainId ?? 46630)}
              />
              <InfoRow
                label="Native token"
                value={config?.nativeSymbol ?? "ETH"}
              />
              <InfoRow label="Active tasks" value={String(tasks.length)} />
            </div>
          </article>
          <article className="panel-surface p-6">
            <p className="eyebrow">Safety by default</p>
            <div className="mt-4 space-y-4">
              <Safety copy="No seed phrase or private key is requested." />
              <Safety copy="The server verifies signatures and reads balances." />
              <Safety copy="Website points remain the only reward in this testnet MVP." />
            </div>
            <a
              href="https://docs.robinhood.com/chain/"
              target="_blank"
              rel="noreferrer"
              className="mt-6 inline-flex items-center text-xs font-medium text-violet-200 hover:text-white"
            >
              Robinhood Chain docs{" "}
              <ExternalLink className="ml-1.5 h-3.5 w-3.5" />
            </a>
          </article>
        </aside>
      </div>
    </DashboardLayout>
  );
}

function TaskCard({
  task,
  result,
  verifying,
  disabled,
  onVerify,
}: {
  task: {
    id: number;
    name: string;
    symbol: string;
    contractAddress: string;
    minimumBalance: string;
    rewardPoints: number;
    description: string;
    active: boolean;
  };
  result?: PassageResult;
  verifying: boolean;
  disabled: boolean;
  onVerify: () => void;
}) {
  return (
    <article className="panel-surface p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="eyebrow">Token task</p>
          <h2 className="mt-2 font-display text-2xl font-semibold text-white">
            Hold {task.symbol}
          </h2>
          <p className="mt-2 max-w-xl text-sm leading-6 text-slate-400">
            {task.description}
          </p>
        </div>
        <span className="rounded-full bg-violet-300/10 px-3 py-1.5 text-xs font-semibold text-violet-100">
          +{formatPoints(task.rewardPoints)} pts
        </span>
      </div>
      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <Metric label="Token" value={task.name} />
        <Metric
          label="Minimum"
          value={`${task.minimumBalance} ${task.symbol}`}
        />
        <Metric
          label="Contract"
          value={`${task.contractAddress.slice(0, 6)}…${task.contractAddress.slice(-4)}`}
        />
      </div>
      <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center">
        <Button
          onClick={onVerify}
          disabled={disabled || verifying}
          className="bg-white text-[#111026] hover:bg-slate-200"
        >
          {verifying ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <CheckCircle2 className="mr-2 h-4 w-4" />
          )}
          {result?.status === "completed" || result?.status === "verified"
            ? "Verified"
            : "Verify balance"}
        </Button>
        {disabled && (
          <span className="text-xs text-slate-500">
            Connect and verify your wallet on Robinhood Chain Testnet first.
          </span>
        )}
      </div>
      {result && (
        <div
          className={`mt-5 rounded-2xl border p-4 ${result.status === "not_eligible" ? "border-amber-300/20 bg-amber-300/[0.06]" : "border-emerald-300/20 bg-emerald-300/[0.06]"}`}
        >
          <p className="text-sm font-semibold text-white">
            {result.status === "not_eligible"
              ? "Not eligible yet"
              : "Passage verified"}
          </p>
          <p className="mt-1 text-xs leading-5 text-slate-400">
            Detected {result.verifiedBalance ?? "a previous verified balance"}{" "}
            {task.symbol}; required{" "}
            {result.requiredBalance ?? task.minimumBalance} {task.symbol}.
          </p>
        </div>
      )}
    </article>
  );
}
function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-white/[0.035] p-3">
      <p className="text-[10px] uppercase tracking-[.16em] text-slate-500">
        {label}
      </p>
      <p className="mt-1 truncate text-sm font-medium text-slate-100">
        {value}
      </p>
    </div>
  );
}
function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-b border-white/[0.06] pb-3 text-xs last:border-b-0 last:pb-0">
      <span className="text-slate-500">{label}</span>
      <span className="font-mono text-slate-200">{value}</span>
    </div>
  );
}
function Step({
  icon,
  title,
  copy,
}: {
  icon: React.ReactNode;
  title: string;
  copy: string;
}) {
  return (
    <div className="panel-surface p-4">
      <span className="grid h-9 w-9 place-items-center rounded-xl bg-violet-400/10 text-violet-200">
        {icon}
      </span>
      <p className="mt-4 text-sm font-medium text-white">{title}</p>
      <p className="mt-1 text-xs leading-5 text-slate-500">{copy}</p>
    </div>
  );
}
function Safety({ copy }: { copy: string }) {
  return (
    <div className="flex items-start gap-3 text-xs leading-5 text-slate-400">
      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" />
      {copy}
    </div>
  );
}
