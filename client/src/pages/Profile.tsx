import DashboardLayout from "@/components/DashboardLayout";
import { ErrorCard, LoadingCard, PageHeader, StatusPill } from "@/components/AklaUi";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { Camera, CheckCircle2, LoaderCircle, WalletCards } from "lucide-react";
import { ChangeEvent, ReactNode, useEffect, useState } from "react";
import { toast } from "sonner";

type FormState = {
  username: string; bio: string; fullName: string; dateOfBirth: string; country: string;
  walletAddress: string; x: string; telegram: string; discord: string; instagram: string; email: string;
};

const emptyForm: FormState = { username: "", bio: "", fullName: "", dateOfBirth: "", country: "", walletAddress: "", x: "", telegram: "", discord: "", instagram: "", email: "" };
const socialPlatforms = ["x", "telegram", "discord", "instagram", "email"] as const;

function socialLabel(platform: (typeof socialPlatforms)[number]) {
  if (platform === "x") return "X username";
  if (platform === "email") return "Email address";
  return `${platform[0].toUpperCase()}${platform.slice(1)} username`;
}

export default function Profile() {
  const summary = trpc.member.summary.useQuery();
  const utils = trpc.useUtils();
  const [form, setForm] = useState<FormState>(emptyForm);
  const save = trpc.member.profile.update.useMutation({
    onSuccess: () => { toast.success("Profile saved"); utils.member.summary.invalidate(); },
    onError: error => toast.error(error.message),
  });
  const upload = trpc.member.profile.uploadAvatar.useMutation({
    onSuccess: () => { toast.success("Profile image updated"); utils.member.summary.invalidate(); },
    onError: error => toast.error(error.message),
  });

  useEffect(() => {
    if (!summary.data) return;
    const social = new Map(summary.data.socials.map(item => [item.platform, item.handle]));
    setForm({
      username: summary.data.profile?.username ?? "", bio: summary.data.profile?.bio ?? "",
      fullName: summary.data.profile?.fullName ?? "", dateOfBirth: summary.data.profile?.dateOfBirth ?? "",
      country: summary.data.profile?.country ?? "", walletAddress: summary.data.wallet?.address ?? "",
      x: social.get("x") ?? "", telegram: social.get("telegram") ?? "",
      discord: social.get("discord") ?? "", instagram: social.get("instagram") ?? "", email: social.get("email") ?? "",
    });
  }, [summary.data]);

  if (summary.isLoading) return <DashboardLayout><LoadingCard label="Loading your identity…" /></DashboardLayout>;
  if (summary.error || !summary.data) return <DashboardLayout><ErrorCard message={summary.error?.message || "Your profile could not be loaded."} /></DashboardLayout>;

  const onAvatar = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!/image\/(png|jpeg|webp)/.test(file.type)) return toast.error("Choose a PNG, JPEG, or WebP image.");
    if (file.size > 2 * 1024 * 1024) return toast.error("Profile images must be 2 MB or less.");
    const reader = new FileReader();
    reader.onload = () => upload.mutate({ dataUrl: String(reader.result) });
    reader.readAsDataURL(file);
  };
  const set = (key: keyof FormState, value: string) => setForm(current => ({ ...current, [key]: value }));
  const socialByPlatform = new Map(summary.data.socials.map(account => [account.platform, account]));
  const profileNeedsSetup = !summary.data.profile?.profileComplete || !summary.data.wallet;

  return (
    <DashboardLayout>
      <PageHeader eyebrow="Profile & identity" title="Make your profile recognizable" description="Social identities can be manually entered today and are designed to support future OAuth or API verification without changing the quest system." />
      {profileNeedsSetup && <div className="mb-6 rounded-2xl border border-amber-200/15 bg-amber-200/[0.07] px-5 py-4 text-sm leading-6 text-amber-50">Your profile is not yet eligible for referral qualification. Add your full name, date of birth, country, and a valid ETH wallet, then save your details to complete this identity step.</div>}
      <form
        className="grid gap-6 xl:grid-cols-[.72fr_1.28fr]"
        onSubmit={event => {
          event.preventDefault();
          save.mutate({
            username: form.username, bio: form.bio || undefined, fullName: form.fullName || undefined,
            dateOfBirth: form.dateOfBirth || undefined, country: form.country || undefined,
            walletAddress: form.walletAddress || undefined,
            socialAccounts: { x: form.x || undefined, telegram: form.telegram || undefined, discord: form.discord || undefined, instagram: form.instagram || undefined, email: form.email || undefined },
          });
        }}
      >
        <aside className="panel-surface h-fit p-6">
          <p className="eyebrow">Public identity</p>
          <div className="mt-6 flex flex-col items-center text-center">
            <div className="relative">
              <Avatar className="h-28 w-28 border-2 border-violet-300/30">
                <AvatarImage src={summary.data.profile?.avatarUrl || undefined} />
                <AvatarFallback className="bg-violet-500/10 font-display text-3xl text-violet-200">{form.username.slice(0, 2).toUpperCase() || "A"}</AvatarFallback>
              </Avatar>
              <label className="absolute -bottom-1 -right-1 grid h-9 w-9 cursor-pointer place-items-center rounded-full bg-violet-500 text-white shadow-lg transition hover:bg-violet-400">
                <Camera className="h-4 w-4" /><input type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={onAvatar} />
              </label>
            </div>
            <h2 className="mt-4 font-display text-xl font-semibold text-white">{form.username || "Akla member"}</h2>
            <p className="mt-1 text-xs text-slate-500">PNG, JPEG, or WebP · 2 MB maximum</p>
            <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-violet-300/15 bg-violet-400/[0.07] px-3 py-1.5 text-xs text-violet-100"><span className="text-violet-200/70">UID</span><code className="font-mono font-medium">{summary.data.memberUid || "Generating…"}</code></div>
            {upload.isPending && <p className="mt-4 flex items-center gap-2 text-xs text-violet-200"><LoaderCircle className="h-3.5 w-3.5 animate-spin" />Uploading securely</p>}
          </div>
          <div className="mt-8 space-y-3">
            <div className="rounded-xl bg-white/[0.035] p-3"><p className="text-xs text-slate-500">Profile status</p><p className="mt-1 flex items-center gap-1.5 text-sm text-white">{summary.data.profile?.profileComplete ? <><CheckCircle2 className="h-4 w-4 text-emerald-300" />Complete</> : "Needs a few details"}</p></div>
            <div className="rounded-xl bg-white/[0.035] p-3"><p className="text-xs text-slate-500">Wallet status</p><p className="mt-1 flex items-center gap-1.5 text-sm text-white"><WalletCards className="h-4 w-4 text-amber-200" />{summary.data.wallet ? "Added" : "Not added"}</p></div>
          </div>
        </aside>
        <div className="space-y-6">
          <section className="panel-surface p-6">
            <h2 className="font-display text-xl font-semibold text-white">Your profile</h2>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <Field label="Username"><Input value={form.username} onChange={event => set("username", event.target.value)} required className="field-dark" /></Field>
              <Field label="Full name"><Input value={form.fullName} onChange={event => set("fullName", event.target.value)} className="field-dark" /></Field>
              <Field label="Date of birth"><Input type="date" value={form.dateOfBirth} onChange={event => set("dateOfBirth", event.target.value)} className="field-dark" /></Field>
              <Field label="Country code"><Input maxLength={2} placeholder="US" value={form.country} onChange={event => set("country", event.target.value.toUpperCase())} className="field-dark" /></Field>
              <Field label="Bio" className="sm:col-span-2"><Textarea value={form.bio} onChange={event => set("bio", event.target.value)} maxLength={280} className="field-dark min-h-24" /></Field>
            </div>
          </section>
          <section className="panel-surface p-6">
            <h2 className="font-display text-xl font-semibold text-white">Wallet & social identities</h2>
            <p className="mt-2 text-sm text-slate-400">Your Ethereum address is validated before it is saved. Social details are stored with their verification state.</p>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <Field label="ETH wallet" className="sm:col-span-2"><Input placeholder="0x…" value={form.walletAddress} onChange={event => set("walletAddress", event.target.value)} className="field-dark font-mono" /></Field>
              {socialPlatforms.map(platform => (
                <Field key={platform} label={socialLabel(platform)} badge={<StatusPill status={socialByPlatform.get(platform)?.verificationState || "unverified"} />}>
                  <Input type={platform === "email" ? "email" : "text"} value={form[platform]} onChange={event => set(platform, event.target.value)} className="field-dark" />
                </Field>
              ))}
            </div>
          </section>
          <div className="flex justify-end"><Button disabled={save.isPending} type="submit" className="bg-violet-500 text-white hover:bg-violet-400">{save.isPending ? "Saving…" : "Save changes"}</Button></div>
        </div>
      </form>
    </DashboardLayout>
  );
}

function Field({ label, children, className = "", badge }: { label: string; children: ReactNode; className?: string; badge?: ReactNode }) {
  return <label className={`block ${className}`}><span className="mb-2 flex items-center justify-between text-xs font-medium text-slate-400">{label}{badge}</span>{children}</label>;
}
