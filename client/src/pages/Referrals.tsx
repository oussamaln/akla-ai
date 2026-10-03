import DashboardLayout from "@/components/DashboardLayout";
import {
  ErrorCard,
  formatPoints,
  LoadingCard,
  MetricCard,
  PageHeader,
} from "@/components/AklaUi";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import { Check, Copy, Network, Send } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export default function Referrals() {
  const summary = trpc.member.summary.useQuery();
  const utils = trpc.useUtils();
  const [referralCode, setReferralCode] = useState("");
  const [copied, setCopied] = useState(false);
  const attach = trpc.member.referrals.attach.useMutation({
    onSuccess: () => {
      toast.success(
        "Referral relationship linked. It will qualify after profile completion."
      );
      utils.member.summary.invalidate();
    },
    onError: error => toast.error(error.message),
  });

  if (summary.isLoading)
    return (
      <DashboardLayout>
        <LoadingCard label="Preparing your referral network…" />
      </DashboardLayout>
    );
  if (summary.error || !summary.data)
    return (
      <DashboardLayout>
        <ErrorCard
          message={
            summary.error?.message || "Referral details could not be loaded."
          }
        />
      </DashboardLayout>
    );

  const link = `${window.location.origin}/?ref=${summary.data.referral.code}`;
  const copy = async () => {
    await navigator.clipboard.writeText(link);
    setCopied(true);
    toast.success("Referral link copied");
    setTimeout(() => setCopied(false), 1600);
  };
  const share = async () => {
    if (navigator.share)
      await navigator.share({
        title: "Join Akla AI",
        text: "Build your Network Score with me on Akla AI.",
        url: link,
      });
    else await copy();
  };

  return (
    <DashboardLayout>
      <PageHeader
        eyebrow="Community referrals"
        title="Grow the network with intention"
        description="Referral rewards are earned only after a new member creates an account and completes their required profile. Every reward is recorded separately from quest points."
      />
      <div className="grid min-w-0 gap-4 md:grid-cols-3">
        <MetricCard
          label="Total referrals"
          value={String(summary.data.referral.total)}
          hint="Pending and qualified members"
          accent="blue"
        />
        <MetricCard
          label="Qualified referrals"
          value={String(summary.data.referral.qualified)}
          hint="Eligible for downstream rewards"
          accent="mint"
        />
        <MetricCard
          label="Referral points"
          value={formatPoints(summary.data.referral.points)}
          hint="Recorded as separate ledger events"
          accent="amber"
        />
      </div>
      {summary.data.referral.total === 0 && (
        <div className="mt-4 min-w-0 rounded-2xl border border-violet-300/15 bg-violet-400/[0.06] px-5 py-4 text-sm leading-6 text-violet-100">
          Your referral network is ready. Share the unique link below. Referral
          rewards begin only after a new member creates an account and completes
          the required profile.
        </div>
      )}
      <section className="mt-6 grid min-w-0 gap-6 xl:grid-cols-[1.15fr_.85fr]">
        <article className="panel-surface min-w-0 p-5 sm:p-6">
          <div className="flex min-w-0 items-start gap-4">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-violet-500/15 text-violet-200">
              <Network className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <p className="eyebrow">Your unique link</p>
              <h2 className="mt-2 font-display text-2xl font-semibold text-white">
                Bring in the right people
              </h2>
              <p className="mt-2 text-sm leading-6 text-slate-400">
                Share your link. Qualification comes after signup and profile
                completion, not on a click.
              </p>
            </div>
          </div>
          <div className="mt-7 flex min-w-0 flex-col gap-2 sm:flex-row">
            <code className="min-w-0 w-full max-w-full break-all rounded-xl border border-white/[0.08] bg-black/20 px-4 py-3 text-xs leading-5 text-violet-100 sm:flex-1 sm:truncate sm:text-sm">
              {link}
            </code>
            <Button
              onClick={copy}
              className="w-full shrink-0 bg-violet-500 text-white hover:bg-violet-400 sm:w-auto"
            >
              {copied ? (
                <Check className="mr-2 h-4 w-4" />
              ) : (
                <Copy className="mr-2 h-4 w-4" />
              )}
              {copied ? "Copied" : "Copy link"}
            </Button>
            <Button
              variant="outline"
              onClick={share}
              className="w-full shrink-0 border-white/10 text-slate-200 hover:bg-white/[0.06] sm:w-auto"
            >
              <Send className="mr-2 h-4 w-4" />
              Share
            </Button>
          </div>
          <div className="mt-7 grid gap-3 sm:grid-cols-3">
            <Tier
              label="Tier 1"
              percentage="15%"
              copy="Direct qualified referrals"
            />
            <Tier
              label="Tier 2"
              percentage="10%"
              copy="Their qualified referrals"
            />
            <Tier
              label="Tier 3"
              percentage="5%"
              copy="Extended network activity"
            />
          </div>
        </article>
        <article className="panel-surface min-w-0 p-5 sm:p-6">
          <p className="eyebrow">Add an inviter</p>
          <h2 className="mt-2 font-display text-2xl font-semibold text-white">
            Were you invited?
          </h2>
          <p className="mt-2 text-sm leading-6 text-slate-400">
            Enter an opaque Akla referral token once. Self-referrals and
            referral cycles are blocked on the server.
          </p>
          <form
            className="mt-6 space-y-3"
            onSubmit={event => {
              event.preventDefault();
              attach.mutate({ referralCode });
            }}
          >
            <Input
              value={referralCode}
              onChange={event => setReferralCode(event.target.value)}
              placeholder="akla_xxxxxxxxxxxxxxxx"
              className="min-w-0 border-white/10 bg-white/[0.035] text-white placeholder:text-slate-600"
            />
            <Button
              type="submit"
              disabled={!referralCode || attach.isPending}
              className="w-full bg-white text-[#111026] hover:bg-slate-200"
            >
              Link my referral
            </Button>
          </form>
        </article>
      </section>
    </DashboardLayout>
  );
}

function Tier({
  label,
  percentage,
  copy,
}: {
  label: string;
  percentage: string;
  copy: string;
}) {
  return (
    <div className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-4">
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <p className="mt-2 font-display text-3xl font-semibold text-amber-100">
        {percentage}
      </p>
      <p className="mt-2 text-xs leading-5 text-slate-500">{copy}</p>
    </div>
  );
}
