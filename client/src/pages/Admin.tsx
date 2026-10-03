import DashboardLayout from "@/components/DashboardLayout";
import {
  ErrorCard,
  formatPoints,
  LoadingCard,
  MetricCard,
  PageHeader,
  SocialPlatform,
  SocialPlatformAvatar,
  StatusPill,
} from "@/components/AklaUi";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import {
  BadgeCheck,
  Check,
  Copy,
  ClipboardList,
  Database,
  Plus,
  Search,
  Settings2,
  Trash2,
  UserRound,
  UsersRound,
  WalletCards,
  X,
  Zap,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

const socialPlatforms: SocialPlatform[] = [
  "x",
  "telegram",
  "discord",
  "instagram",
];
type QuestForm = {
  id?: number;
  slug: string;
  title: string;
  description: string;
  category: "social" | "presence" | "passage";
  questType: "standard" | "premium" | "daily" | "weekly" | "manual";
  verificationType: "manual" | "oauth" | "api" | "onchain" | "system";
  platform: "" | SocialPlatform;
  basePoints: number;
  isPremium: boolean;
  active: boolean;
  ctaLabel: string;
  ctaUrl: string;
  completionLimit: number;
};
const blankQuest: QuestForm = {
  slug: "",
  title: "",
  description: "",
  category: "social",
  questType: "standard",
  verificationType: "manual",
  platform: "",
  basePoints: 200,
  isPremium: false,
  active: true,
  ctaLabel: "Start",
  ctaUrl: "",
  completionLimit: 1,
};

type Web3TaskForm = {
  id?: number;
  name: string;
  symbol: string;
  contractAddress: string;
  chainId: number;
  decimals: number;
  minimumBalance: string;
  rewardPoints: number;
  description: string;
  active: boolean;
};
const blankWeb3Task: Web3TaskForm = {
  name: "",
  symbol: "",
  contractAddress: "",
  chainId: 46630,
  decimals: 18,
  minimumBalance: "100",
  rewardPoints: 500,
  description: "Hold this token to complete a Proof of Passage task.",
  active: true,
};

function isSocialPlatform(
  value: string | null | undefined
): value is SocialPlatform {
  return Boolean(value && socialPlatforms.includes(value as SocialPlatform));
}

export default function Admin() {
  const { user, loading } = useAuth();
  const utils = trpc.useUtils();
  const [reviewSearch, setReviewSearch] = useState("");
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [form, setForm] = useState<QuestForm>(blankQuest);
  const [thresholds, setThresholds] = useState<number[]>([
    0, 2500, 7500, 20000,
  ]);
  const [socialForm, setSocialForm] = useState({
    platform: "x" as SocialPlatform,
    handle: "",
    url: "",
    active: true,
  });
  const [web3Form, setWeb3Form] = useState<Web3TaskForm>(blankWeb3Task);
  const overview = trpc.admin.overview.useQuery(undefined, {
    enabled: user?.role === "admin",
  });
  const reviewMembers = trpc.admin.questReview.members.useQuery(
    { search: reviewSearch || undefined },
    { enabled: user?.role === "admin" }
  );
  const detail = trpc.admin.users.detail.useQuery(
    { userId: selectedUserId ?? 1 },
    { enabled: selectedUserId !== null && user?.role === "admin" }
  );
  const quests = trpc.admin.quests.list.useQuery(undefined, {
    enabled: user?.role === "admin",
  });
  const multipliers = trpc.admin.multipliers.list.useQuery(undefined, {
    enabled: user?.role === "admin",
  });
  const settings = trpc.admin.settings.list.useQuery(undefined, {
    enabled: user?.role === "admin",
  });
  const socials = trpc.admin.socialAccounts.list.useQuery(undefined, {
    enabled: user?.role === "admin",
  });
  const web3Tasks = trpc.admin.web3.list.useQuery(undefined, {
    enabled: user?.role === "admin",
  });
  const web3History = trpc.admin.web3.history.useQuery(undefined, {
    enabled: user?.role === "admin",
  });

  useEffect(() => {
    if (multipliers.data)
      setThresholds(multipliers.data.map(item => item.thresholdPoints));
  }, [multipliers.data]);
  const review = trpc.admin.questReview.decide.useMutation({
    onSuccess: () => {
      toast.success("Review recorded");
      utils.admin.overview.invalidate();
      utils.admin.questReview.members.invalidate();
      if (selectedUserId)
        utils.admin.users.detail.invalidate({ userId: selectedUserId });
    },
    onError: error => toast.error(error.message),
  });
  const saveQuest = trpc.admin.quests.upsert.useMutation({
    onSuccess: () => {
      toast.success("Quest saved");
      setForm(blankQuest);
      utils.admin.quests.list.invalidate();
    },
    onError: error => toast.error(error.message),
  });
  const updateThresholds = trpc.admin.multipliers.updateThresholds.useMutation({
    onSuccess: () => {
      toast.success("Multiplier thresholds updated");
      utils.admin.multipliers.list.invalidate();
    },
    onError: error => toast.error(error.message),
  });
  const updateSetting = trpc.admin.settings.update.useMutation({
    onSuccess: () => {
      toast.success("Setting saved");
      utils.admin.settings.list.invalidate();
    },
    onError: error => toast.error(error.message),
  });
  const upsertSocial = trpc.admin.socialAccounts.upsert.useMutation({
    onSuccess: () => {
      toast.success("Official social account saved");
      utils.admin.socialAccounts.list.invalidate();
    },
    onError: error => toast.error(error.message),
  });
  const saveWeb3Task = trpc.admin.web3.upsert.useMutation({
    onSuccess: () => {
      toast.success(web3Form.id ? "Token task updated" : "Token task added");
      setWeb3Form(blankWeb3Task);
      utils.admin.web3.list.invalidate();
      utils.admin.web3.history.invalidate();
    },
    onError: error => toast.error(error.message),
  });
  const removeWeb3Task = trpc.admin.web3.remove.useMutation({
    onSuccess: () => {
      toast.success("Token task deleted");
      utils.admin.web3.list.invalidate();
    },
    onError: error => toast.error(error.message),
  });

  const settingValue = (key: string, fallback: number) =>
    Number(settings.data?.find(item => item.key === key)?.value ?? fallback);
  if (loading)
    return (
      <DashboardLayout>
        <LoadingCard />
      </DashboardLayout>
    );
  if (user?.role !== "admin")
    return (
      <DashboardLayout>
        <ErrorCard message="This console is restricted to Akla AI administrators." />
      </DashboardLayout>
    );
  if (overview.isLoading)
    return (
      <DashboardLayout>
        <LoadingCard label="Loading operational metrics…" />
      </DashboardLayout>
    );
  if (overview.error || !overview.data)
    return (
      <DashboardLayout>
        <ErrorCard
          message={overview.error?.message || "Admin data could not be loaded."}
        />
      </DashboardLayout>
    );
  const metric = overview.data.metrics;

  return (
    <DashboardLayout>
      <PageHeader
        eyebrow="Admin console"
        title="Operate the rewards network"
        description="Find a member by UID or username, review their complete quest record, and configure the social participation layer from one operational workspace."
      />
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <MetricCard
          label="Total users"
          value={formatPoints(metric.totalUsers)}
          hint="Accounts in the rewards network"
        />
        <MetricCard
          label="Active today"
          value={formatPoints(metric.activeToday)}
          hint="Signed in since UTC day start"
          accent="mint"
        />
        <MetricCard
          label="Points distributed"
          value={formatPoints(metric.pointsDistributed)}
          hint="Immutable ledger total"
          accent="amber"
        />
        <MetricCard
          label="Qualified referrals"
          value={formatPoints(metric.qualifiedReferrals)}
          hint="Completed profile qualification"
          accent="blue"
        />
        <MetricCard
          label="Quest completions"
          value={formatPoints(metric.questCompletions)}
          hint="Verified reward events"
        />
        <MetricCard
          label="Average reward"
          value={formatPoints(metric.averageScore)}
          hint="Average points per ledger entry"
          accent="mint"
        />
      </section>

      <section className="mt-6 grid gap-6 xl:grid-cols-[.72fr_1.28fr]">
        <MemberReviewRoster
          search={reviewSearch}
          onSearch={setReviewSearch}
          members={reviewMembers.data ?? []}
          loading={reviewMembers.isLoading}
          selectedUserId={selectedUserId}
          onSelect={setSelectedUserId}
        />
        <MemberReviewDetail
          detail={detail.data}
          loading={detail.isLoading}
          onDecide={(completionId, approved) =>
            review.mutate({ completionId, approved })
          }
          isDeciding={review.isPending}
        />
      </section>

      <section className="mt-6 grid gap-6 xl:grid-cols-[1.2fr_.8fr]">
        <QuestManager
          form={form}
          onFormChange={setForm}
          quests={quests.data ?? []}
          saving={saveQuest.isPending}
          onSave={() =>
            saveQuest.mutate({
              ...form,
              platform: form.platform || undefined,
              ctaLabel: form.ctaLabel || undefined,
              ctaUrl: form.ctaUrl || undefined,
            })
          }
        />
        <div className="space-y-6">
          <article className="panel-surface p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="eyebrow">Multiplier tiers</p>
                <h2 className="mt-2 font-display text-2xl font-semibold text-white">
                  Highest tier wins
                </h2>
                <p className="mt-2 text-sm leading-6 text-slate-400">
                  Only thresholds are configurable. Future qualifying rewards
                  use the highest unlocked tier.
                </p>
              </div>
              <Settings2 className="h-5 w-5 text-amber-200" />
            </div>
            <div className="mt-5 space-y-3">
              {["1.0×", "1.2×", "1.5×", "2.0×"].map((label, index) => (
                <label key={label} className="flex items-center gap-3">
                  <span className="w-11 font-display text-lg font-semibold text-amber-100">
                    {label}
                  </span>
                  <Input
                    type="number"
                    min="0"
                    value={thresholds[index] ?? 0}
                    onChange={event =>
                      setThresholds(current =>
                        current.map((item, position) =>
                          position === index ? Number(event.target.value) : item
                        )
                      )
                    }
                    className="field-dark"
                  />
                  <span className="text-xs text-slate-500">points</span>
                </label>
              ))}
            </div>
            <Button
              onClick={() =>
                updateThresholds.mutate(
                  thresholds.map((thresholdPoints, index) => ({
                    rank: index + 1,
                    thresholdPoints,
                  }))
                )
              }
              className="mt-5 w-full bg-white text-[#111026] hover:bg-slate-200"
            >
              Save thresholds
            </Button>
          </article>
          <article className="panel-surface p-6">
            <p className="eyebrow">Check-in economy</p>
            <h2 className="mt-2 font-display text-2xl font-semibold text-white">
              Rewards configuration
            </h2>
            <div className="mt-5 grid gap-3">
              <ConfigNumber
                label="Daily base points"
                value={settingValue("dailyCheckinBasePoints", 200)}
                onSave={value =>
                  updateSetting.mutate({ key: "dailyCheckinBasePoints", value })
                }
              />
              <ConfigNumber
                label="Weekly base points"
                value={settingValue("weeklyCheckinBasePoints", 400)}
                onSave={value =>
                  updateSetting.mutate({
                    key: "weeklyCheckinBasePoints",
                    value,
                  })
                }
              />
              <ConfigNumber
                label="Daily check-ins per week"
                value={settingValue("weeklyCheckinDaysRequired", 5)}
                onSave={value =>
                  updateSetting.mutate({
                    key: "weeklyCheckinDaysRequired",
                    value,
                  })
                }
              />
            </div>
          </article>
        </div>
      </section>

      <section className="mt-6 grid gap-6 xl:grid-cols-[.85fr_1.15fr]">
        <article className="panel-surface p-6">
          <p className="eyebrow">Official social accounts</p>
          <h2 className="mt-2 font-display text-2xl font-semibold text-white">
            Quest destinations
          </h2>
          <div className="mt-5 space-y-2">
            {socials.data?.map(account => (
              <div
                key={account.platform}
                className="flex items-center justify-between rounded-xl bg-white/[0.035] px-3 py-2.5"
              >
                <div className="flex items-center gap-3">
                  {isSocialPlatform(account.platform) ? (
                    <SocialPlatformAvatar
                      platform={account.platform}
                      size="sm"
                    />
                  ) : null}
                  <span className="text-sm text-slate-200">
                    {account.handle}
                  </span>
                </div>
                <span
                  className={`h-2 w-2 rounded-full ${account.active ? "bg-emerald-300" : "bg-slate-600"}`}
                />
              </div>
            ))}
          </div>
          <div className="mt-5 grid gap-3">
            <label>
              <span className="admin-label">Platform</span>
              <select
                value={socialForm.platform}
                onChange={event =>
                  setSocialForm(current => ({
                    ...current,
                    platform: event.target.value as SocialPlatform,
                  }))
                }
                className="field-dark flex h-10 w-full rounded-md px-3 text-sm"
              >
                {socialPlatforms.map(platform => (
                  <option key={platform} value={platform}>
                    {platform === "x"
                      ? "X"
                      : `${platform[0].toUpperCase()}${platform.slice(1)}`}
                  </option>
                ))}
              </select>
            </label>
            <AdminInput
              label="Official handle"
              value={socialForm.handle}
              onChange={value =>
                setSocialForm(current => ({ ...current, handle: value }))
              }
            />
            <AdminInput
              label="Destination URL"
              value={socialForm.url}
              onChange={value =>
                setSocialForm(current => ({ ...current, url: value }))
              }
            />
            <Button
              onClick={() =>
                upsertSocial.mutate({
                  ...socialForm,
                  url: socialForm.url || undefined,
                })
              }
              disabled={!socialForm.handle || upsertSocial.isPending}
              className="bg-violet-500 text-white hover:bg-violet-400"
            >
              Save official account
            </Button>
          </div>
        </article>
        <article className="panel-surface p-6">
          <div className="flex items-start gap-3">
            <ClipboardList className="mt-1 h-5 w-5 text-violet-200" />
            <div>
              <p className="eyebrow">Review policy</p>
              <h2 className="mt-2 font-display text-2xl font-semibold text-white">
                Member-first verification
              </h2>
              <p className="mt-2 max-w-xl text-sm leading-6 text-slate-400">
                Search by UID or username, select a member, then review every
                pending proof alongside every configured task. Each decision is
                recorded in the immutable rewards flow.
              </p>
            </div>
          </div>
          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            <Policy label="UID search" copy="Immutable member identifier" />
            <Policy label="Full history" copy="Submitted and unstarted tasks" />
            <Policy
              label="Per-task review"
              copy="Approve or reject only pending proof"
            />
          </div>
        </article>
      </section>
      <Web3TaskManager
        form={web3Form}
        onFormChange={setWeb3Form}
        tasks={web3Tasks.data ?? []}
        history={web3History.data ?? []}
        saving={saveWeb3Task.isPending}
        deleting={removeWeb3Task.isPending}
        onSave={() => saveWeb3Task.mutate(web3Form)}
        onEdit={task => setWeb3Form(task)}
        onToggle={task =>
          saveWeb3Task.mutate({ ...task, active: !task.active })
        }
        onDelete={id => {
          if (
            window.confirm(
              "Delete this token task? Historical tasks cannot be deleted; disable them instead."
            )
          )
            removeWeb3Task.mutate({ id });
        }}
      />
    </DashboardLayout>
  );
}

function Web3TaskManager({
  form,
  onFormChange,
  tasks,
  history,
  saving,
  deleting,
  onSave,
  onEdit,
  onToggle,
  onDelete,
}: {
  form: Web3TaskForm;
  onFormChange: React.Dispatch<React.SetStateAction<Web3TaskForm>>;
  tasks: Array<{
    task: Omit<Web3TaskForm, "id"> & { id: number };
    quest: { title: string; active: boolean };
  }>;
  history: Array<{
    id: number;
    userId: number;
    username: string | null;
    name: string | null;
    taskName: string;
    walletAddress: string;
    contractAddress: string;
    verifiedBalance: string;
    requiredBalance: string;
    status: string;
    createdAt: Date;
  }>;
  saving: boolean;
  deleting: boolean;
  onSave: () => void;
  onEdit: (task: Web3TaskForm) => void;
  onToggle: (task: Web3TaskForm) => void;
  onDelete: (id: number) => void;
}) {
  const setField = <K extends keyof Web3TaskForm>(
    key: K,
    value: Web3TaskForm[K]
  ) => onFormChange(current => ({ ...current, [key]: value }));
  const valid = Boolean(
    form.name &&
      form.symbol &&
      form.contractAddress &&
      form.minimumBalance &&
      form.description &&
      form.rewardPoints >= 200
  );
  const copyAddress = async (address: string) => {
    await navigator.clipboard.writeText(address);
    toast.success("Address copied");
  };
  return (
    <section className="mt-6 space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="eyebrow">Proof of Passage</p>
          <h2 className="mt-2 font-display text-3xl font-semibold text-white">
            Token tasks
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
            Configure multiple Robinhood Chain Testnet token-holder tasks. Keep
            historical tasks disabled instead of deleting their audit trail.
          </p>
        </div>
        <span className="inline-flex w-fit items-center gap-2 rounded-full border border-violet-300/15 bg-violet-300/[0.06] px-3 py-2 text-xs text-violet-100">
          <Database className="h-3.5 w-3.5" /> {tasks.length} configured
        </span>
      </div>
      <div className="grid gap-6 xl:grid-cols-[.85fr_1.15fr]">
        <article className="panel-surface p-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="eyebrow">{form.id ? "Edit task" : "Add task"}</p>
              <h3 className="mt-2 font-display text-2xl font-semibold text-white">
                {form.id ? "Update passage rules" : "Create a passage rule"}
              </h3>
            </div>
            <Zap className="h-5 w-5 text-amber-200" />
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <AdminInput
              label="Token name"
              value={form.name}
              onChange={value => setField("name", value)}
            />
            <AdminInput
              label="Token symbol"
              value={form.symbol}
              onChange={value => setField("symbol", value.toUpperCase())}
            />
            <div className="sm:col-span-2">
              <AdminInput
                label="Contract address"
                value={form.contractAddress}
                onChange={value => setField("contractAddress", value)}
              />
            </div>
            <AdminInput
              label="Network"
              value="Robinhood Chain Testnet"
              onChange={() => undefined}
            />
            <AdminInput
              label="Chain ID"
              value={String(form.chainId)}
              onChange={value => setField("chainId", Number(value) || 0)}
              type="number"
            />
            <AdminInput
              label="Decimals"
              value={String(form.decimals)}
              onChange={value => setField("decimals", Number(value) || 0)}
              type="number"
            />
            <AdminInput
              label="Minimum balance"
              value={form.minimumBalance}
              onChange={value => setField("minimumBalance", value)}
            />
            <AdminInput
              label="Reward points"
              value={String(form.rewardPoints)}
              onChange={value => setField("rewardPoints", Number(value) || 0)}
              type="number"
            />
            <label className="sm:col-span-2">
              <span className="admin-label">Description</span>
              <Textarea
                value={form.description}
                onChange={event => setField("description", event.target.value)}
                className="field-dark min-h-24"
              />
            </label>
            <label className="flex items-center gap-3 text-sm text-slate-300 sm:col-span-2">
              <input
                type="checkbox"
                checked={form.active}
                onChange={event => setField("active", event.target.checked)}
                className="h-4 w-4 accent-violet-500"
              />{" "}
              Active task shown to members
            </label>
          </div>
          <div className="mt-5 flex flex-col gap-2 sm:flex-row">
            <Button
              onClick={onSave}
              disabled={!valid || saving}
              className="bg-violet-500 text-white hover:bg-violet-400"
            >
              <Plus className="mr-2 h-4 w-4" />
              {saving ? "Saving…" : form.id ? "Save changes" : "Add token task"}
            </Button>
            {form.id && (
              <Button
                variant="outline"
                onClick={() => onFormChange(blankWeb3Task)}
                className="border-white/10 text-slate-200 hover:bg-white/[0.06]"
              >
                Cancel edit
              </Button>
            )}
          </div>
        </article>
        <div className="space-y-3">
          {tasks.length ? (
            tasks.map(({ task, quest }) => (
              <article key={task.id} className="panel-surface min-w-0 p-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-display text-xl font-semibold text-white">
                        {task.name}{" "}
                        <span className="text-violet-200">({task.symbol})</span>
                      </h3>
                      <span
                        className={`rounded-full px-2 py-1 text-[10px] font-semibold uppercase tracking-[.14em] ${task.active && quest.active ? "bg-emerald-300/10 text-emerald-100" : "bg-white/[0.06] text-slate-500"}`}
                      >
                        {task.active && quest.active ? "Active" : "Disabled"}
                      </span>
                    </div>
                    <p className="mt-2 text-sm leading-6 text-slate-400">
                      {task.description}
                    </p>
                  </div>
                  <span className="shrink-0 rounded-full bg-amber-300/10 px-2.5 py-1.5 text-xs font-semibold text-amber-100">
                    +{formatPoints(task.rewardPoints)} pts
                  </span>
                </div>
                <div className="mt-4 grid gap-2 sm:grid-cols-3">
                  <InfoChip
                    label="Minimum"
                    value={`${task.minimumBalance} ${task.symbol}`}
                  />
                  <InfoChip label="Network" value={`Chain ${task.chainId}`} />
                  <div className="min-w-0 rounded-xl bg-white/[0.035] p-3">
                    <p className="text-[10px] uppercase tracking-[.14em] text-slate-500">
                      Contract
                    </p>
                    <div className="mt-1 flex min-w-0 items-center gap-2">
                      <span className="truncate font-mono text-xs text-slate-200">
                        {shortAddress(task.contractAddress)}
                      </span>
                      <button
                        type="button"
                        aria-label="Copy contract address"
                        onClick={() => copyAddress(task.contractAddress)}
                        className="shrink-0 text-slate-500 hover:text-white"
                      >
                        <Copy className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onEdit(task)}
                    className="border-white/10 text-slate-200 hover:bg-white/[0.06]"
                  >
                    Edit
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onToggle(task)}
                    disabled={saving}
                    className="border-white/10 text-slate-200 hover:bg-white/[0.06]"
                  >
                    {task.active ? "Disable" : "Enable"}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onDelete(task.id)}
                    disabled={deleting}
                    className="border-rose-300/15 text-rose-100 hover:bg-rose-300/10"
                  >
                    <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                    Delete
                  </Button>
                </div>
              </article>
            ))
          ) : (
            <article className="panel-surface flex min-h-64 items-center justify-center p-8 text-center">
              <div>
                <Database className="mx-auto h-8 w-8 text-violet-200" />
                <h3 className="mt-4 font-display text-xl font-semibold text-white">
                  No token tasks yet
                </h3>
                <p className="mt-2 max-w-sm text-sm leading-6 text-slate-500">
                  Add the first contract above. It will become an active member
                  quest only when enabled.
                </p>
              </div>
            </article>
          )}
        </div>
      </div>
      <article className="panel-surface overflow-hidden">
        <div className="border-b border-white/[0.07] p-6">
          <p className="eyebrow">Audit trail</p>
          <h3 className="mt-2 font-display text-2xl font-semibold text-white">
            Verification history
          </h3>
          <p className="mt-2 text-sm leading-6 text-slate-400">
            Successful and failed balance checks are recorded separately from
            rewards.
          </p>
        </div>
        <div className="divide-y divide-white/[0.06]">
          {history.length ? (
            history.map(entry => (
              <div
                key={entry.id}
                className="grid gap-3 p-5 md:grid-cols-[1fr_1.2fr_1fr_auto] md:items-center"
              >
                <div>
                  <p className="text-sm font-medium text-white">
                    {entry.username || entry.name || `User ${entry.userId}`}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    {entry.taskName}
                  </p>
                </div>
                <div className="min-w-0">
                  <p className="truncate font-mono text-xs text-slate-300">
                    {shortAddress(entry.walletAddress)}{" "}
                    <button
                      type="button"
                      aria-label="Copy wallet address"
                      onClick={() => copyAddress(entry.walletAddress)}
                      className="ml-1 inline-flex align-middle text-slate-500 hover:text-white"
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </button>
                  </p>
                  <p className="mt-1 truncate font-mono text-[11px] text-slate-600">
                    {shortAddress(entry.contractAddress)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-400">
                    {entry.verifiedBalance} / {entry.requiredBalance}
                  </p>
                  <p className="mt-1 text-[11px] text-slate-600">
                    {new Date(entry.createdAt).toLocaleString()}
                  </p>
                </div>
                <span
                  className={`w-fit rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[.14em] ${entry.status === "verified" ? "bg-emerald-300/10 text-emerald-100" : "bg-amber-300/10 text-amber-100"}`}
                >
                  {entry.status === "not_eligible" ? "Failed" : entry.status}
                </span>
              </div>
            ))
          ) : (
            <p className="p-6 text-sm text-slate-500">
              No verification attempts yet.
            </p>
          )}
        </div>
      </article>
    </section>
  );
}

function InfoChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-xl bg-white/[0.035] p-3">
      <p className="text-[10px] uppercase tracking-[.14em] text-slate-500">
        {label}
      </p>
      <p className="mt-1 truncate text-xs text-slate-200">{value}</p>
    </div>
  );
}
function shortAddress(address: string) {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

function MemberReviewRoster({
  search,
  onSearch,
  members,
  loading,
  selectedUserId,
  onSelect,
}: {
  search: string;
  onSearch: (value: string) => void;
  members: Array<{
    id: number;
    memberUid: string | null;
    name: string | null;
    username: string | null;
    pendingSubmissions: number;
    totalSubmissions: number;
  }>;
  loading: boolean;
  selectedUserId: number | null;
  onSelect: (id: number) => void;
}) {
  return (
    <article className="panel-surface overflow-hidden">
      <div className="border-b border-white/[0.07] p-6">
        <p className="eyebrow">Verification queue</p>
        <h2 className="mt-2 font-display text-2xl font-semibold text-white">
          Manual proof review
        </h2>
        <p className="mt-2 text-sm leading-6 text-slate-400">
          Choose a username to open that member’s complete submissions and
          tasks.
        </p>
        <label className="relative mt-5 block">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          <Input
            value={search}
            onChange={event => onSearch(event.target.value)}
            placeholder="Search UID or username"
            className="field-dark pl-10"
            aria-label="Search members by UID or username"
          />
        </label>
      </div>
      <div className="max-h-[620px] divide-y divide-white/[0.06] overflow-y-auto">
        {loading ? (
          <p className="p-6 text-sm text-slate-500">Finding members…</p>
        ) : members.length ? (
          members.map(member => (
            <button
              type="button"
              key={member.id}
              onClick={() => onSelect(member.id)}
              className={`flex w-full items-center gap-3 px-6 py-4 text-left transition ${selectedUserId === member.id ? "bg-violet-500/10" : "hover:bg-white/[0.025]"}`}
            >
              <span className="grid h-9 w-9 place-items-center rounded-full bg-white/[0.06] text-sm font-semibold text-violet-100">
                {(member.username || member.name || "M")
                  .slice(0, 1)
                  .toUpperCase()}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-white">
                  {member.username || member.name || `Member ${member.id}`}
                </span>
                <span className="mt-1 block font-mono text-[11px] text-slate-500">
                  {member.memberUid || "UID generating…"}
                </span>
              </span>
              <span className="text-right">
                <span
                  className={`inline-flex min-w-6 justify-center rounded-full px-2 py-1 text-[11px] font-semibold ${member.pendingSubmissions ? "bg-amber-300/10 text-amber-100" : "bg-white/[0.06] text-slate-500"}`}
                >
                  {member.pendingSubmissions}
                </span>
                <span className="mt-1 block text-[10px] uppercase tracking-[.12em] text-slate-500">
                  pending
                </span>
              </span>
            </button>
          ))
        ) : (
          <div className="p-8 text-center">
            <p className="text-sm text-slate-400">
              No members match that search.
            </p>
            <p className="mt-1 text-xs text-slate-600">
              Try a UID such as UID-AB12CD34EF56 or a username.
            </p>
          </div>
        )}
      </div>
    </article>
  );
}

function MemberReviewDetail({
  detail,
  loading,
  onDecide,
  isDeciding,
}: {
  detail: any;
  loading: boolean;
  onDecide: (completionId: number, approved: boolean) => void;
  isDeciding: boolean;
}) {
  if (!detail && !loading)
    return (
      <article className="panel-surface flex min-h-80 items-center justify-center p-8 text-center">
        <div>
          <UserRound className="mx-auto h-8 w-8 text-violet-300" />
          <h2 className="mt-4 font-display text-xl font-semibold text-white">
            Select a member
          </h2>
          <p className="mt-2 max-w-sm text-sm leading-6 text-slate-400">
            Their UID, identity, submitted proof, and every quest task will
            appear here.
          </p>
        </div>
      </article>
    );
  if (loading) return <LoadingCard label="Loading member review record…" />;
  const memberName =
    detail.profile?.username || detail.user.name || `Member ${detail.user.id}`;
  return (
    <article className="panel-surface overflow-hidden">
      <div className="border-b border-white/[0.07] p-6">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
          <div className="flex items-center gap-3">
            <span className="grid h-11 w-11 place-items-center rounded-full bg-violet-500/15 font-display text-lg text-violet-100">
              {memberName.slice(0, 1).toUpperCase()}
            </span>
            <div>
              <p className="eyebrow">Selected member</p>
              <h2 className="mt-1 font-display text-2xl font-semibold text-white">
                {memberName}
              </h2>
              <p className="mt-1 font-mono text-xs text-violet-200">
                {detail.user.memberUid || "UID generating…"}
              </p>
            </div>
          </div>
          <span className="rounded-full bg-emerald-300/10 px-3 py-1.5 text-xs font-medium text-emerald-100">
            {detail.user.role}
          </span>
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <MiniInfo
            label="Wallet"
            value={
              detail.wallet?.address
                ? `${detail.wallet.address.slice(0, 6)}…${detail.wallet.address.slice(-4)}`
                : "Not added"
            }
            icon={<WalletCards className="h-4 w-4" />}
          />
          <MiniInfo
            label="Multiplier"
            value={`${Number(detail.multiplier.multiplier).toFixed(1)}×`}
            icon={<BadgeCheck className="h-4 w-4" />}
          />
          <MiniInfo
            label="Social identities"
            value={`${detail.socials.length} connected`}
            icon={<UsersRound className="h-4 w-4" />}
          />
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {detail.socials.map((account: any) =>
            isSocialPlatform(account.platform) ? (
              <span
                key={account.id}
                className="rounded-full bg-white/[0.05] px-2.5 py-1"
              >
                <SocialPlatformAvatar
                  platform={account.platform}
                  size="sm"
                  showLabel
                />
              </span>
            ) : null
          )}
        </div>
      </div>
      <div className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="eyebrow">All quest tasks</p>
            <h3 className="mt-1 font-display text-xl font-semibold text-white">
              Submissions and current status
            </h3>
          </div>
          <span className="text-sm text-slate-500">
            {detail.questHistory.length} tasks
          </span>
        </div>
        <div className="mt-5 divide-y divide-white/[0.06]">
          {detail.questHistory.map(({ quest, submissions }: any) => (
            <div key={quest.id} className="py-4">
              <div className="flex min-w-0 items-center gap-3">
                {isSocialPlatform(quest.platform) ? (
                  <SocialPlatformAvatar platform={quest.platform} />
                ) : (
                  <span className="grid h-9 w-9 place-items-center rounded-full bg-violet-500/10 text-violet-200">
                    <ClipboardList className="h-4 w-4" />
                  </span>
                )}
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-white">
                    {quest.title}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    {submissions.length
                      ? `${submissions.length} submission${submissions.length === 1 ? "" : "s"} recorded`
                      : "Not submitted"}
                  </p>
                </div>
              </div>
              {submissions.length ? (
                <div className="mt-3 space-y-2 pl-0 sm:pl-12">
                  {submissions.map((submission: any) => {
                    const proof = submission.verificationData as {
                      platform?: string;
                      handle?: string;
                    } | null;
                    return (
                      <div
                        key={submission.id}
                        className="flex flex-col gap-2 rounded-xl bg-white/[0.035] px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div>
                          <p className="text-xs text-slate-500">
                            Submitted{" "}
                            {new Date(submission.completedAt).toLocaleString()}
                          </p>
                          {proof?.handle && (
                            <p className="mt-1 text-xs font-medium text-violet-200">
                              {proof.platform === "x"
                                ? "X"
                                : proof.platform
                                  ? `${proof.platform[0].toUpperCase()}${proof.platform.slice(1)}`
                                  : "Identity"}
                              : {proof.handle}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <StatusPill status={submission.status} />
                          {submission.status === "pending" && (
                            <>
                              <Button
                                size="sm"
                                aria-label={`Approve ${quest.title} submission`}
                                disabled={isDeciding}
                                onClick={() => onDecide(submission.id, true)}
                                className="bg-emerald-400/15 text-emerald-100 hover:bg-emerald-400/25"
                              >
                                <Check className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                aria-label={`Reject ${quest.title} submission`}
                                disabled={isDeciding}
                                onClick={() => onDecide(submission.id, false)}
                                className="border-rose-400/15 text-rose-200 hover:bg-rose-400/10"
                              >
                                <X className="h-3.5 w-3.5" />
                              </Button>
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="mt-3 pl-0 sm:pl-12">
                  <span className="rounded-full bg-white/[0.06] px-2.5 py-1 text-[11px] text-slate-500">
                    unstarted
                  </span>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </article>
  );
}

function QuestManager({
  form,
  onFormChange,
  quests,
  saving,
  onSave,
}: {
  form: QuestForm;
  onFormChange: (next: QuestForm) => void;
  quests: any[];
  saving: boolean;
  onSave: () => void;
}) {
  const set = <K extends keyof QuestForm>(key: K, value: QuestForm[K]) =>
    onFormChange({ ...form, [key]: value });
  return (
    <article className="panel-surface p-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
        <div>
          <p className="eyebrow">Quest manager</p>
          <h2 className="mt-2 font-display text-2xl font-semibold text-white">
            Create and revise quests
          </h2>
          <p className="mt-2 text-sm leading-6 text-slate-400">
            Use a platform identity for social quests so reviewers and members
            immediately recognize the required destination.
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => onFormChange(blankQuest)}
          className="border-white/10 text-slate-200 hover:bg-white/[0.06]"
        >
          New quest
        </Button>
      </div>
      <form
        className="mt-6 grid gap-3 sm:grid-cols-2"
        onSubmit={event => {
          event.preventDefault();
          onSave();
        }}
      >
        <AdminInput
          label="Title"
          value={form.title}
          onChange={value => set("title", value)}
        />
        <AdminInput
          label="Slug"
          value={form.slug}
          onChange={value =>
            set("slug", value.toLowerCase().replace(/[^a-z0-9-]/g, "-"))
          }
        />
        <label className="sm:col-span-2">
          <span className="admin-label">Description</span>
          <Textarea
            value={form.description}
            onChange={event => set("description", event.target.value)}
            className="field-dark min-h-20"
          />
        </label>
        <AdminSelect
          label="Category"
          value={form.category}
          onChange={value => set("category", value as QuestForm["category"])}
          options={["social", "presence", "passage"]}
        />
        <AdminSelect
          label="Verification"
          value={form.verificationType}
          onChange={value =>
            set("verificationType", value as QuestForm["verificationType"])
          }
          options={["manual", "oauth", "api", "onchain", "system"]}
        />
        <AdminSelect
          label="Quest type"
          value={form.questType}
          onChange={value => set("questType", value as QuestForm["questType"])}
          options={["standard", "premium", "daily", "weekly", "manual"]}
        />
        <AdminInput
          label="Base points"
          value={String(form.basePoints)}
          type="number"
          onChange={value => set("basePoints", Number(value) || 0)}
        />
        <div className="sm:col-span-2">
          <span className="admin-label">Social platform</span>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {socialPlatforms.map(platform => (
              <button
                type="button"
                key={platform}
                onClick={() => set("platform", platform)}
                aria-pressed={form.platform === platform}
                className={`flex min-h-16 items-center gap-2 rounded-xl border px-3 text-left transition ${form.platform === platform ? "border-violet-300/40 bg-violet-400/10" : "border-white/[0.07] bg-white/[0.02] hover:bg-white/[0.05]"}`}
              >
                <SocialPlatformAvatar platform={platform} />
                <span className="text-xs capitalize text-slate-200">
                  {platform === "x" ? "X" : platform}
                </span>
              </button>
            ))}
          </div>
          <p className="mt-2 text-xs text-slate-500">
            Choose a platform for social quests, or leave all choices unselected
            for presence and passage tasks.
          </p>
        </div>
        <AdminInput
          label="CTA label"
          value={form.ctaLabel}
          onChange={value => set("ctaLabel", value)}
        />
        <AdminInput
          label="Destination URL"
          value={form.ctaUrl}
          onChange={value => set("ctaUrl", value)}
        />
        <label className="flex items-center gap-2 text-sm text-slate-300">
          <input
            type="checkbox"
            checked={form.active}
            onChange={event => set("active", event.target.checked)}
          />
          Active
        </label>
        <label className="flex items-center gap-2 text-sm text-slate-300">
          <input
            type="checkbox"
            checked={form.isPremium}
            onChange={event => set("isPremium", event.target.checked)}
          />
          Premium quest
        </label>
        <div className="sm:col-span-2 flex justify-end">
          <Button
            type="submit"
            disabled={saving}
            className="bg-violet-500 text-white hover:bg-violet-400"
          >
            {form.id ? "Save quest" : "Create quest"}
          </Button>
        </div>
      </form>
      <div className="mt-7 divide-y divide-white/[0.06]">
        {quests.map(quest => (
          <button
            type="button"
            key={quest.id}
            onClick={() =>
              onFormChange({
                id: quest.id,
                slug: quest.slug,
                title: quest.title,
                description: quest.description,
                category: quest.category,
                questType: quest.questType,
                verificationType: quest.verificationType,
                platform: isSocialPlatform(quest.platform)
                  ? quest.platform
                  : "",
                basePoints: quest.basePoints,
                isPremium: quest.isPremium,
                active: quest.active,
                ctaLabel: quest.ctaLabel || "",
                ctaUrl: quest.ctaUrl || "",
                completionLimit: quest.completionLimit,
              })
            }
            className="flex w-full items-center gap-3 py-3 text-left transition hover:bg-white/[0.025]"
          >
            {isSocialPlatform(quest.platform) ? (
              <SocialPlatformAvatar platform={quest.platform} size="sm" />
            ) : (
              <span className="h-2.5 w-2.5 rounded-full bg-violet-300" />
            )}
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm text-slate-200">
                {quest.title}
              </span>
              <span className="mt-1 block text-xs text-slate-500">
                {quest.platform || quest.category}
              </span>
            </span>
            <span className="text-xs text-amber-100">
              {quest.basePoints} pts
            </span>
          </button>
        ))}
      </div>
    </article>
  );
}

function MiniInfo({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-xl bg-white/[0.035] p-3">
      <p className="flex items-center gap-1.5 text-xs text-slate-500">
        {icon}
        {label}
      </p>
      <p className="mt-1 truncate text-sm text-slate-100">{value}</p>
    </div>
  );
}
function Policy({ label, copy }: { label: string; copy: string }) {
  return (
    <div className="rounded-xl bg-white/[0.035] p-3">
      <p className="text-sm font-medium text-violet-100">{label}</p>
      <p className="mt-1 text-xs leading-5 text-slate-500">{copy}</p>
    </div>
  );
}
function ConfigNumber({
  label,
  value,
  onSave,
}: {
  label: string;
  value: number;
  onSave: (value: number) => void;
}) {
  const [draft, setDraft] = useState(String(value));
  useEffect(() => setDraft(String(value)), [value]);
  return (
    <div>
      <label className="admin-label">{label}</label>
      <div className="flex gap-2">
        <Input
          type="number"
          min="0"
          value={draft}
          onChange={event => setDraft(event.target.value)}
          className="field-dark"
        />
        <Button
          type="button"
          size="sm"
          onClick={() => onSave(Number(draft))}
          className="bg-violet-500 text-white hover:bg-violet-400"
        >
          Save
        </Button>
      </div>
    </div>
  );
}
function AdminInput({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
}) {
  return (
    <label>
      <span className="admin-label">{label}</span>
      <Input
        type={type}
        value={value}
        onChange={event => onChange(event.target.value)}
        className="field-dark"
      />
    </label>
  );
}
function AdminSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: readonly string[];
}) {
  return (
    <label>
      <span className="admin-label">{label}</span>
      <select
        value={value}
        onChange={event => onChange(event.target.value)}
        className="field-dark flex h-10 w-full rounded-md px-3 text-sm"
      >
        {options.map(option => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}
