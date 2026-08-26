import { and, desc, eq, gte, lte, sql } from "drizzle-orm";
import {
  adminAuditLogs,
  appSettings,
  dailyCheckins,
  multiplierLevels,
  multiplierUnlocks,
  officialSocialAccounts,
  pointTransactions,
  profiles,
  questCompletions,
  quests,
  rateLimitWindows,
  referrals,
  referralCodes,
  referralRewards,
  socialAccounts,
  wallets,
  weeklyCheckins,
  users,
} from "../drizzle/schema";
import {
  assertNotSelfReferral,
  canVerifyQuestCompletion,
  calculateFinalPoints,
  hasAlreadyClaimedUtcPeriod,
  isDuplicateIdempotencyKey,
  isProfileQualificationEligible,
  isValidEthereumAddress,
  MULTIPLIER_TIER_VALUES,
  REFERRAL_TIER_PERCENTAGES,
  utcDateKey,
  utcWeekKey,
  validateAvatarPayload,
  shouldAwardWeeklyCheckin,
  wouldCreateReferralCycle,
} from "../shared/rewards";
import { randomBytes } from "node:crypto";
import { getDb } from "./db";
import { storagePut } from "./storage";

const DEFAULT_MULTIPLIERS = [
  { code: "base", label: "Base", rank: 1, multiplier: "1.00", thresholdPoints: 0 },
  { code: "tier-1", label: "Tier 1", rank: 2, multiplier: "1.20", thresholdPoints: 2500 },
  { code: "tier-2", label: "Tier 2", rank: 3, multiplier: "1.50", thresholdPoints: 7500 },
  { code: "tier-3", label: "Tier 3", rank: 4, multiplier: "2.00", thresholdPoints: 20000 },
] as const;

const DEFAULT_SETTINGS = {
  dailyCheckinBasePoints: 200,
  weeklyCheckinBasePoints: 400,
  weeklyCheckinDaysRequired: 5,
  referralTierPercentages: REFERRAL_TIER_PERCENTAGES,
  referralRewardsQualifyForMultiplier: true,
  readTheDocsUrl: "",
} as const;

type DefaultQuest = {
  slug: string;
  title: string;
  description: string;
  category: "social" | "presence" | "passage";
  questType: "standard" | "premium";
  verificationType: "manual" | "system" | "onchain";
  basePoints: number;
  isPremium: boolean;
  ctaLabel: string;
  platform?: string;
  active?: boolean;
};

const DEFAULT_QUESTS: DefaultQuest[] = [
  { slug: "complete-profile", title: "Complete your profile", description: "Add your account details to unlock a more trusted network identity.", category: "presence" as const, questType: "standard" as const, verificationType: "system" as const, basePoints: 200, isPremium: false, ctaLabel: "Edit profile" },
  { slug: "set-up-wallet", title: "Set up your wallet", description: "Add a valid Ethereum wallet address to strengthen your network profile.", category: "presence" as const, questType: "standard" as const, verificationType: "system" as const, basePoints: 200, isPremium: false, ctaLabel: "Add wallet" },
  { slug: "follow-akla-x", title: "Follow Akla AI on X", description: "Connect your X identity and follow the official Akla AI account when configured.", category: "social" as const, questType: "standard" as const, verificationType: "manual" as const, platform: "x", basePoints: 200, isPremium: false, ctaLabel: "Verify participation" },
  { slug: "join-discord", title: "Join the Akla AI Discord", description: "Join the community server and submit your identity for review.", category: "social" as const, questType: "standard" as const, verificationType: "manual" as const, platform: "discord", basePoints: 200, isPremium: false, ctaLabel: "Verify participation" },
  { slug: "join-telegram", title: "Join the Akla AI Telegram", description: "Join the community channel and submit your identity for review.", category: "social" as const, questType: "standard" as const, verificationType: "manual" as const, platform: "telegram", basePoints: 200, isPremium: false, ctaLabel: "Verify participation" },
  { slug: "connect-email", title: "Connect your email", description: "Add a contact email to make your network identity easier to verify.", category: "social" as const, questType: "standard" as const, verificationType: "manual" as const, platform: "email", basePoints: 200, isPremium: false, ctaLabel: "Verify participation" },
  { slug: "bridge-pioneer", title: "Become a passage pioneer", description: "Complete future cross-chain or interoperability activity when the campaign becomes available.", category: "passage" as const, questType: "premium" as const, verificationType: "onchain" as const, basePoints: 1000, isPremium: true, active: false, ctaLabel: "Coming soon" },
] as const;

type PointAward = {
  userId: number;
  source: "quest" | "daily_checkin" | "weekly_checkin" | "referral_reward" | "admin_adjustment" | "campaign";
  sourceId: string;
  basePoints: number;
  idempotencyKey: string;
  qualifiesForMultiplier?: boolean;
  propagateReferralRewards?: boolean;
};

function requireDatabase<T>(db: T | null): T {
  if (!db) throw new Error("Database is unavailable. Please try again shortly.");
  return db;
}

function startOfUtcDay(date = new Date()) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function previousUtcDateKey(date = new Date()) {
  const prior = new Date(date);
  prior.setUTCDate(prior.getUTCDate() - 1);
  return utcDateKey(prior);
}

export function makeReferralCode() {
  return `akla_${randomBytes(12).toString("base64url")}`;
}

export function isOpaqueReferralCode(code: string) {
  return /^akla_[A-Za-z0-9_-]{16}$/.test(code);
}

export async function ensureReferralCode(userId: number) {
  const db = requireDatabase(await getDb());
  const existing = await db.select().from(referralCodes).where(eq(referralCodes.userId, userId)).limit(1);
  if (existing[0]) return existing[0].code;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const code = makeReferralCode();
    try {
      await db.insert(referralCodes).values({ userId, code });
      return code;
    } catch {
      const raced = await db.select().from(referralCodes).where(eq(referralCodes.userId, userId)).limit(1);
      if (raced[0]) return raced[0].code;
    }
  }
  throw new Error("Unable to create a unique referral code. Please try again.");
}

export async function ensureDefaultConfiguration() {
  const db = requireDatabase(await getDb());
  for (const level of DEFAULT_MULTIPLIERS) {
    await db.insert(multiplierLevels).values(level).onDuplicateKeyUpdate({
      set: { label: level.label, rank: level.rank, multiplier: level.multiplier, thresholdPoints: level.thresholdPoints, active: true },
    });
  }
  for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) {
    await db.insert(appSettings).values({ key, value }).onDuplicateKeyUpdate({ set: { value } });
  }
  for (const quest of DEFAULT_QUESTS) {
    await db.insert(quests).values({ ...quest, active: quest.active ?? true, completionLimit: 1 }).onDuplicateKeyUpdate({
      set: {
        title: quest.title,
        description: quest.description,
        category: quest.category,
        questType: quest.questType,
        verificationType: quest.verificationType,
        platform: quest.platform ?? null,
        basePoints: quest.basePoints,
        isPremium: quest.isPremium,
        active: quest.active ?? true,
        ctaLabel: quest.ctaLabel,
      },
    });
  }
}

export async function enforceRateLimit(userId: number, action: string, limit: number, windowMs: number) {
  const db = requireDatabase(await getDb());
  const now = new Date();
  const windowStart = new Date(Math.floor(now.getTime() / windowMs) * windowMs);
  const current = await db
    .select()
    .from(rateLimitWindows)
    .where(and(eq(rateLimitWindows.userId, userId), eq(rateLimitWindows.action, action), eq(rateLimitWindows.windowStart, windowStart)))
    .limit(1);
  if (!current[0]) {
    await db.insert(rateLimitWindows).values({ userId, action, windowStart, requestCount: 1 });
    return;
  }
  if (current[0].requestCount >= limit) {
    throw new Error("Too many requests. Please wait before trying again.");
  }
  await db
    .update(rateLimitWindows)
    .set({ requestCount: current[0].requestCount + 1 })
    .where(eq(rateLimitWindows.id, current[0].id));
}

export async function ensureProfile(userId: number, displayName?: string | null) {
  const db = requireDatabase(await getDb());
  const existing = await db.select().from(profiles).where(eq(profiles.userId, userId)).limit(1);
  if (existing[0]) return existing[0];
  const base = (displayName || "member").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 28) || "member";
  await db.insert(profiles).values({ userId, username: `${base}-${userId}`, profileComplete: false });
  const created = await db.select().from(profiles).where(eq(profiles.userId, userId)).limit(1);
  return created[0]!;
}

export async function getActiveMultiplier(userId: number) {
  const db = requireDatabase(await getDb());
  const unlocked = await db
    .select({ multiplier: multiplierLevels.multiplier, rank: multiplierLevels.rank, label: multiplierLevels.label, unlockedAt: multiplierUnlocks.unlockedAt })
    .from(multiplierUnlocks)
    .innerJoin(multiplierLevels, eq(multiplierUnlocks.multiplierLevelId, multiplierLevels.id))
    .where(and(eq(multiplierUnlocks.userId, userId), eq(multiplierLevels.active, true)))
    .orderBy(desc(multiplierLevels.rank))
    .limit(1);
  return unlocked[0]
    ? { multiplier: Number(unlocked[0].multiplier), label: unlocked[0].label, unlockedAt: unlocked[0].unlockedAt }
    : { multiplier: 1, label: "Base", unlockedAt: null };
}

export async function getSetting<T>(key: string, fallback: T): Promise<T> {
  const db = requireDatabase(await getDb());
  const setting = await db.select().from(appSettings).where(eq(appSettings.key, key)).limit(1);
  return (setting[0]?.value as T | undefined) ?? fallback;
}

export async function awardPoints(input: PointAward) {
  const db = requireDatabase(await getDb());
  const existing = await db.select().from(pointTransactions).where(eq(pointTransactions.idempotencyKey, input.idempotencyKey)).limit(1);
  if (isDuplicateIdempotencyKey(existing.map(transaction => transaction.idempotencyKey), input.idempotencyKey)) return existing[0]!;

  const qualifiesForMultiplier = input.qualifiesForMultiplier ?? true;
  const active = await getActiveMultiplier(input.userId);
  const multiplier = qualifiesForMultiplier ? active.multiplier : 1;
  const finalPoints = calculateFinalPoints(input.basePoints, multiplier, qualifiesForMultiplier);
  await db.insert(pointTransactions).values({
    userId: input.userId,
    source: input.source,
    sourceId: input.sourceId,
    basePoints: input.basePoints,
    activeMultiplier: multiplier.toFixed(2),
    finalPoints,
    qualifiesForMultiplier,
    idempotencyKey: input.idempotencyKey,
  });
  const transaction = await db.select().from(pointTransactions).where(eq(pointTransactions.idempotencyKey, input.idempotencyKey)).limit(1);
  const created = transaction[0]!;
  if (input.propagateReferralRewards !== false && input.source !== "referral_reward") {
    await awardReferralRewards(input.userId, created.id, created.finalPoints);
  }
  await unlockEligibleMultipliers(input.userId);
  return created;
}

export async function unlockEligibleMultipliers(userId: number) {
  const db = requireDatabase(await getDb());
  const totals = await db
    .select({ total: sql<number>`coalesce(sum(${pointTransactions.finalPoints}), 0)` })
    .from(pointTransactions)
    .where(eq(pointTransactions.userId, userId));
  const totalPoints = Number(totals[0]?.total ?? 0);
  const levels = await db.select().from(multiplierLevels).where(and(eq(multiplierLevels.active, true), lte(multiplierLevels.thresholdPoints, totalPoints)));
  for (const level of levels) {
    await db.insert(multiplierUnlocks).values({ userId, multiplierLevelId: level.id, unlockSource: "network_score_threshold" }).onDuplicateKeyUpdate({
      set: { unlockSource: "network_score_threshold" },
    });
  }
}

async function awardReferralRewards(originUserId: number, downstreamTransactionId: number, downstreamPoints: number) {
  const db = requireDatabase(await getDb());
  const percentages = await getSetting("referralTierPercentages", REFERRAL_TIER_PERCENTAGES);
  const qualifiesForMultiplier = await getSetting("referralRewardsQualifyForMultiplier", true);
  let referredUserId = originUserId;
  for (let tier = 1; tier <= 3; tier += 1) {
    const relationship = await db
      .select()
      .from(referrals)
      .where(and(eq(referrals.referredUserId, referredUserId), eq(referrals.status, "qualified")))
      .limit(1);
    const referral = relationship[0];
    if (!referral) break;
    const percentage = percentages[tier as 1 | 2 | 3];
    const basePoints = Math.floor((downstreamPoints * percentage) / 100);
    if (basePoints > 0) {
      const transaction = await awardPoints({
        userId: referral.referrerUserId,
        source: "referral_reward",
        sourceId: `${referral.id}:${downstreamTransactionId}`,
        basePoints,
        qualifiesForMultiplier,
        idempotencyKey: `referral:${referral.id}:downstream:${downstreamTransactionId}`,
        propagateReferralRewards: false,
      });
      await db.insert(referralRewards).values({
        referralId: referral.id,
        downstreamTransactionId,
        rewardPercentage: percentage.toFixed(2),
        rewardPoints: transaction.finalPoints,
        pointTransactionId: transaction.id,
      }).onDuplicateKeyUpdate({ set: { rewardPoints: transaction.finalPoints, pointTransactionId: transaction.id } });
    }
    referredUserId = referral.referrerUserId;
  }
}

export async function recordDailyCheckin(userId: number) {
  const db = requireDatabase(await getDb());
  await enforceRateLimit(userId, "daily_checkin", 3, 60 * 60 * 1000);
  const today = utcDateKey();
  const existing = await db.select().from(dailyCheckins).where(and(eq(dailyCheckins.userId, userId), eq(dailyCheckins.utcDateKey, today))).limit(1);
  if (hasAlreadyClaimedUtcPeriod(existing.map(checkin => checkin.utcDateKey), today)) throw new Error("Today’s check-in has already been claimed.");

  const latest = await db.select().from(dailyCheckins).where(eq(dailyCheckins.userId, userId)).orderBy(desc(dailyCheckins.utcDateKey)).limit(1);
  const streak = latest[0]?.utcDateKey === previousUtcDateKey() ? latest[0].streak + 1 : 1;
  const bestStreak = Math.max(streak, latest[0]?.bestStreak ?? 0);
  await db.insert(dailyCheckins).values({ userId, utcDateKey: today, streak, bestStreak });
  const checkin = await db.select().from(dailyCheckins).where(and(eq(dailyCheckins.userId, userId), eq(dailyCheckins.utcDateKey, today))).limit(1);
  const basePoints = await getSetting("dailyCheckinBasePoints", 200);
  const transaction = await awardPoints({ userId, source: "daily_checkin", sourceId: String(checkin[0]!.id), basePoints, idempotencyKey: `daily:${userId}:${today}` });
  await db.update(dailyCheckins).set({ pointTransactionId: transaction.id }).where(eq(dailyCheckins.id, checkin[0]!.id));
  return { transaction, streak, bestStreak };
}

export async function recordWeeklyProgress(userId: number) {
  const db = requireDatabase(await getDb());
  const week = utcWeekKey();
  const setting = await getSetting("weeklyCheckinDaysRequired", 5);
  const weekStart = new Date(`${week}T00:00:00.000Z`);
  const uniqueDays = await db
    .select({ count: sql<number>`count(*)` })
    .from(dailyCheckins)
    .where(and(eq(dailyCheckins.userId, userId), gte(dailyCheckins.createdAt, weekStart)));
  const progressDays = Math.min(Number(uniqueDays[0]?.count ?? 0), setting);
  const existing = await db.select().from(weeklyCheckins).where(and(eq(weeklyCheckins.userId, userId), eq(weeklyCheckins.utcWeekKey, week))).limit(1);
  if (!existing[0]) await db.insert(weeklyCheckins).values({ userId, utcWeekKey: week, progressDays });
  else await db.update(weeklyCheckins).set({ progressDays }).where(eq(weeklyCheckins.id, existing[0].id));

  const current = existing[0] ?? (await db.select().from(weeklyCheckins).where(and(eq(weeklyCheckins.userId, userId), eq(weeklyCheckins.utcWeekKey, week))).limit(1))[0]!;
  if (!shouldAwardWeeklyCheckin(progressDays, setting, Boolean(current.completedAt))) return { progressDays, requiredDays: setting, transaction: null };
  const basePoints = await getSetting("weeklyCheckinBasePoints", 400);
  const transaction = await awardPoints({ userId, source: "weekly_checkin", sourceId: String(current.id), basePoints, idempotencyKey: `weekly:${userId}:${week}` });
  await db.update(weeklyCheckins).set({ completedAt: new Date(), pointTransactionId: transaction.id }).where(eq(weeklyCheckins.id, current.id));
  return { progressDays, requiredDays: setting, transaction };
}

export async function updateMemberProfile(input: {
  userId: number;
  username: string;
  bio?: string;
  fullName?: string;
  dateOfBirth?: string;
  country?: string;
  walletAddress?: string;
  socialAccounts: Partial<Record<"x" | "telegram" | "discord" | "email", string>>;
}) {
  const db = requireDatabase(await getDb());
  const username = input.username.trim().toLowerCase();
  if (!/^[a-z0-9][a-z0-9-]{2,63}$/.test(username)) throw new Error("Username must be 3–64 lowercase letters, numbers, or hyphens.");
  if (input.walletAddress?.trim() && !isValidEthereumAddress(input.walletAddress.trim())) throw new Error("Enter a valid Ethereum wallet address.");
  const profileComplete = isProfileQualificationEligible({ username, fullName: input.fullName, dateOfBirth: input.dateOfBirth, country: input.country, walletAddress: input.walletAddress });
  await db.update(profiles).set({ username, bio: input.bio?.trim() || null, fullName: input.fullName?.trim() || null, dateOfBirth: input.dateOfBirth || null, country: input.country?.toUpperCase() || null, profileComplete }).where(eq(profiles.userId, input.userId));
  if (input.walletAddress?.trim()) {
    const address = input.walletAddress.trim();
    await db.insert(wallets).values({ userId: input.userId, address, normalizedAddress: address.toLowerCase() }).onDuplicateKeyUpdate({ set: { address, normalizedAddress: address.toLowerCase() } });
  }
  for (const [platform, rawHandle] of Object.entries(input.socialAccounts) as Array<["x" | "telegram" | "discord" | "email", string | undefined]>) {
    const handle = rawHandle?.trim();
    if (!handle) continue;
    await db.insert(socialAccounts).values({ userId: input.userId, platform, handle, verificationState: "manual" }).onDuplicateKeyUpdate({ set: { handle, verificationState: "manual" } });
  }
  await qualifyReferralForUser(input.userId);
}

export async function uploadProfileAvatar(userId: number, dataUrl: string) {
  const db = requireDatabase(await getDb());
  await enforceRateLimit(userId, "avatar_upload", 5, 60 * 60 * 1000);
  const { mimeType, bytes, extension } = validateAvatarPayload(dataUrl);
  const stored = await storagePut(`avatars/${userId}/profile.${extension}`, bytes, mimeType);
  await db.update(profiles).set({ avatarKey: stored.key, avatarUrl: stored.url }).where(eq(profiles.userId, userId));
  return stored;
}

export async function attachReferral(referredUserId: number, referralCode: string) {
  const db = requireDatabase(await getDb());
  const code = referralCode.trim();
  if (!isOpaqueReferralCode(code)) throw new Error("This referral link is invalid.");
  const referralCodeRecord = await db.select().from(referralCodes).where(eq(referralCodes.code, code)).limit(1);
  const referrerUserId = referralCodeRecord[0]?.userId;
  if (!referrerUserId) throw new Error("This referral link is invalid.");
  assertNotSelfReferral(referrerUserId, referredUserId);
  const existing = await db.select().from(referrals).where(eq(referrals.referredUserId, referredUserId)).limit(1);
  if (existing[0]) throw new Error("A referral relationship is already linked to this account.");

  let currentId: number | null = referrerUserId;
  for (let depth = 0; depth < 12 && currentId; depth += 1) {
    if (wouldCreateReferralCycle(referredUserId, [currentId])) throw new Error("Referral cycles are not allowed.");
    const parent = await db.select({ referrerUserId: referrals.referrerUserId }).from(referrals).where(eq(referrals.referredUserId, currentId)).limit(1);
    currentId = parent[0]?.referrerUserId ?? null;
  }
  await db.insert(referrals).values({ referrerUserId, referredUserId, referralCode: code, tier: 1, status: "pending" });
  await qualifyReferralForUser(referredUserId);
}

export async function qualifyReferralForUser(referredUserId: number) {
  const db = requireDatabase(await getDb());
  const relationship = await db.select().from(referrals).where(and(eq(referrals.referredUserId, referredUserId), eq(referrals.status, "pending"))).limit(1);
  if (!relationship[0]) return;
  const profile = await db.select().from(profiles).where(eq(profiles.userId, referredUserId)).limit(1);
  const wallet = await db.select().from(wallets).where(eq(wallets.userId, referredUserId)).limit(1);
  if (!profile[0]?.profileComplete || !wallet[0]) return;
  await db.update(referrals).set({ status: "qualified", qualifiedAt: new Date() }).where(eq(referrals.id, relationship[0].id));
}

export async function getMemberSummary(userId: number) {
  const db = requireDatabase(await getDb());
  await ensureDefaultConfiguration();
  const [profile] = await db.select().from(profiles).where(eq(profiles.userId, userId)).limit(1);
  const [wallet] = await db.select().from(wallets).where(eq(wallets.userId, userId)).limit(1);
  const socials = await db.select().from(socialAccounts).where(eq(socialAccounts.userId, userId));
  const totals = await db.select({ total: sql<number>`coalesce(sum(${pointTransactions.finalPoints}), 0)` }).from(pointTransactions).where(eq(pointTransactions.userId, userId));
  const today = startOfUtcDay();
  const todayTotals = await db.select({ total: sql<number>`coalesce(sum(${pointTransactions.finalPoints}), 0)` }).from(pointTransactions).where(and(eq(pointTransactions.userId, userId), gte(pointTransactions.createdAt, today)));
  const activeMultiplier = await getActiveMultiplier(userId);
  const latestCheckin = await db.select().from(dailyCheckins).where(eq(dailyCheckins.userId, userId)).orderBy(desc(dailyCheckins.createdAt)).limit(1);
  const week = await db.select().from(weeklyCheckins).where(and(eq(weeklyCheckins.userId, userId), eq(weeklyCheckins.utcWeekKey, utcWeekKey()))).limit(1);
  const settings = await getSetting("weeklyCheckinDaysRequired", 5);
  const referralRows = await db.select({ status: referrals.status, count: sql<number>`count(*)` }).from(referrals).where(eq(referrals.referrerUserId, userId)).groupBy(referrals.status);
  const referralPoints = await db.select({ total: sql<number>`coalesce(sum(${pointTransactions.finalPoints}), 0)` }).from(pointTransactions).where(and(eq(pointTransactions.userId, userId), eq(pointTransactions.source, "referral_reward")));
  const referralMetrics = referralRows.reduce((acc, row) => ({ ...acc, [row.status]: Number(row.count) }), {} as Record<string, number>);
  return {
    profile,
    wallet,
    socials,
    networkScore: Number(totals[0]?.total ?? 0),
    totalPoints: Number(totals[0]?.total ?? 0),
    todayEarnings: Number(todayTotals[0]?.total ?? 0),
    activeMultiplier,
    dailyCheckin: latestCheckin[0] ?? null,
    weeklyProgress: { completedDays: week[0]?.progressDays ?? 0, requiredDays: settings, completed: Boolean(week[0]?.completedAt) },
    referral: { total: (referralMetrics.pending ?? 0) + (referralMetrics.qualified ?? 0), qualified: referralMetrics.qualified ?? 0, points: Number(referralPoints[0]?.total ?? 0), code: await ensureReferralCode(userId) },
  };
}

export async function getQuestBoard(userId: number) {
  const db = requireDatabase(await getDb());
  await ensureDefaultConfiguration();
  const activeQuests = await db.select().from(quests).where(eq(quests.active, true)).orderBy(quests.category, quests.createdAt);
  const completions = await db.select().from(questCompletions).where(eq(questCompletions.userId, userId));
  const officialAccounts = await db.select().from(officialSocialAccounts).where(eq(officialSocialAccounts.active, true));
  const completionByQuest = new Map(completions.map(completion => [completion.questId, completion]));
  const officialByPlatform = new Map(officialAccounts.map(account => [account.platform, account]));
  return activeQuests.map(quest => {
    const official = quest.platform ? officialByPlatform.get(quest.platform as "x" | "telegram" | "discord" | "email") : undefined;
    return { ...quest, ctaUrl: quest.ctaUrl ?? official?.url ?? null, completion: completionByQuest.get(quest.id) ?? null };
  });
}

export async function claimQuest(userId: number, questId: number, idempotencyKey: string) {
  const db = requireDatabase(await getDb());
  await enforceRateLimit(userId, "quest_claim", 20, 60 * 60 * 1000);
  const questRows = await db.select().from(quests).where(and(eq(quests.id, questId), eq(quests.active, true))).limit(1);
  const quest = questRows[0];
  if (!quest) throw new Error("This quest is unavailable.");
  if (quest.startsAt && quest.startsAt > new Date()) throw new Error("This quest has not started yet.");
  if (quest.endsAt && quest.endsAt < new Date()) throw new Error("This quest has ended.");
  const previous = await db.select().from(questCompletions).where(and(eq(questCompletions.userId, userId), eq(questCompletions.questId, questId))).limit(1);
  if (previous[0] && quest.completionLimit <= 1) return { completion: previous[0], transaction: null };

  if (quest.verificationType === "system") {
    const profile = await ensureProfile(userId);
    const [wallet] = await db.select().from(wallets).where(eq(wallets.userId, userId)).limit(1);
    const eligible = quest.slug === "complete-profile" ? profile.profileComplete : quest.slug === "set-up-wallet" ? Boolean(wallet) : false;
    if (!eligible) throw new Error("Complete the required account step before claiming this quest.");
    await db.insert(questCompletions).values({ userId, questId, status: "verified", idempotencyKey, verifiedAt: new Date() });
    const completion = await db.select().from(questCompletions).where(eq(questCompletions.idempotencyKey, idempotencyKey)).limit(1);
    const transaction = await awardPoints({ userId, source: "quest", sourceId: String(completion[0]!.id), basePoints: quest.basePoints, idempotencyKey: `quest:${completion[0]!.id}` });
    return { completion: completion[0]!, transaction };
  }

  await db.insert(questCompletions).values({ userId, questId, status: "pending", idempotencyKey });
  const completion = await db.select().from(questCompletions).where(eq(questCompletions.idempotencyKey, idempotencyKey)).limit(1);
  return { completion: completion[0]!, transaction: null };
}

export async function verifyQuestCompletion(adminUserId: number, completionId: number, approved: boolean) {
  const db = requireDatabase(await getDb());
  const completionRows = await db.select().from(questCompletions).where(eq(questCompletions.id, completionId)).limit(1);
  const completion = completionRows[0];
  if (!completion || !canVerifyQuestCompletion(completion.status)) throw new Error("This quest completion is not awaiting review.");
  const questRows = await db.select().from(quests).where(eq(quests.id, completion.questId)).limit(1);
  const quest = questRows[0];
  if (!quest) throw new Error("The related quest no longer exists.");
  if (!approved) {
    await db.update(questCompletions).set({ status: "rejected", verifiedAt: new Date(), verifiedByUserId: adminUserId }).where(eq(questCompletions.id, completionId));
    return { approved: false, transaction: null };
  }
  await db.update(questCompletions).set({ status: "verified", verifiedAt: new Date(), verifiedByUserId: adminUserId }).where(eq(questCompletions.id, completionId));
  const transaction = await awardPoints({ userId: completion.userId, source: "quest", sourceId: String(completion.id), basePoints: quest.basePoints, idempotencyKey: `quest:${completion.id}` });
  return { approved: true, transaction };
}

export async function getLeaderboard(input: { scope: "global" | "weekly" | "monthly" | "referral"; page: number; pageSize: number; currentUserId: number }) {
  const db = requireDatabase(await getDb());
  const page = Math.max(0, input.page);
  const pageSize = Math.min(Math.max(1, input.pageSize), 50);
  const now = new Date();
  const startOfWeek = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - ((now.getUTCDay() + 6) % 7)));
  const startOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const condition = input.scope === "weekly"
    ? gte(pointTransactions.createdAt, startOfWeek)
    : input.scope === "monthly"
      ? gte(pointTransactions.createdAt, startOfMonth)
      : input.scope === "referral"
        ? eq(pointTransactions.source, "referral_reward")
        : sql`1 = 1`;
  const score = sql<number>`coalesce(sum(${pointTransactions.finalPoints}), 0)`;
  const entries = await db
    .select({ userId: profiles.userId, username: profiles.username, avatarUrl: profiles.avatarUrl, networkScore: score })
    .from(pointTransactions)
    .innerJoin(profiles, eq(pointTransactions.userId, profiles.userId))
    .where(condition)
    .groupBy(profiles.userId, profiles.username, profiles.avatarUrl)
    .orderBy(desc(score), profiles.username)
    .limit(pageSize)
    .offset(page * pageSize);
  const multiplierEntries = await Promise.all(entries.map(entry => getActiveMultiplier(entry.userId)));
  return entries.map((entry, index) => ({
    rank: page * pageSize + index + 1,
    userId: entry.userId,
    username: entry.username,
    avatarUrl: entry.avatarUrl,
    networkScore: Number(entry.networkScore),
    multiplier: multiplierEntries[index]!.multiplier,
    isCurrentUser: entry.userId === input.currentUserId,
  }));
}

export async function getAdminOverview() {
  const db = requireDatabase(await getDb());
  const [userCount] = await db.select({ value: sql<number>`count(*)` }).from(users);
  const [activeToday] = await db.select({ value: sql<number>`count(*)` }).from(users).where(gte(users.lastSignedIn, startOfUtcDay()));
  const [pointsDistributed] = await db.select({ value: sql<number>`coalesce(sum(${pointTransactions.finalPoints}), 0)` }).from(pointTransactions);
  const [qualifiedReferrals] = await db.select({ value: sql<number>`count(*)` }).from(referrals).where(eq(referrals.status, "qualified"));
  const [questCompletionCount] = await db.select({ value: sql<number>`count(*)` }).from(questCompletions).where(eq(questCompletions.status, "verified"));
  const [averageScore] = await db.select({ value: sql<number>`coalesce(avg(${pointTransactions.finalPoints}), 0)` }).from(pointTransactions);
  const reviewQueue = await db
    .select({ id: questCompletions.id, username: profiles.username, questTitle: quests.title, completedAt: questCompletions.completedAt })
    .from(questCompletions)
    .innerJoin(profiles, eq(questCompletions.userId, profiles.userId))
    .innerJoin(quests, eq(questCompletions.questId, quests.id))
    .where(eq(questCompletions.status, "pending"))
    .orderBy(desc(questCompletions.completedAt))
    .limit(20);
  return {
    metrics: {
      totalUsers: Number(userCount?.value ?? 0),
      activeToday: Number(activeToday?.value ?? 0),
      pointsDistributed: Number(pointsDistributed?.value ?? 0),
      qualifiedReferrals: Number(qualifiedReferrals?.value ?? 0),
      questCompletions: Number(questCompletionCount?.value ?? 0),
      averageScore: Math.round(Number(averageScore?.value ?? 0)),
    },
    reviewQueue,
  };
}

export async function recordAdminAudit(input: { adminUserId: number; action: string; targetType: string; targetId?: string; metadata?: Record<string, unknown> }) {
  const db = requireDatabase(await getDb());
  await db.insert(adminAuditLogs).values({
    adminUserId: input.adminUserId,
    action: input.action,
    targetType: input.targetType,
    targetId: input.targetId,
    metadata: input.metadata,
  });
}

export async function getAdminUsers(input: { search?: string; page: number; pageSize: number }) {
  const db = requireDatabase(await getDb());
  const page = Math.max(0, input.page);
  const pageSize = Math.min(Math.max(1, input.pageSize), 50);
  const records = await db
    .select({ id: users.id, name: users.name, email: users.email, role: users.role, lastSignedIn: users.lastSignedIn, username: profiles.username, profileComplete: profiles.profileComplete })
    .from(users)
    .leftJoin(profiles, eq(users.id, profiles.userId))
    .orderBy(desc(users.lastSignedIn))
    .limit(pageSize)
    .offset(page * pageSize);
  const query = input.search?.trim().toLowerCase();
  return query ? records.filter(record => `${record.name ?? ""} ${record.email ?? ""} ${record.username ?? ""}`.toLowerCase().includes(query)) : records;
}

export async function getUserPointHistory(userId: number) {
  const db = requireDatabase(await getDb());
  return db.select().from(pointTransactions).where(eq(pointTransactions.userId, userId)).orderBy(desc(pointTransactions.createdAt)).limit(100);
}

export async function getReferralTree(referrerUserId: number) {
  const db = requireDatabase(await getDb());
  return db
    .select({ id: referrals.id, referredUserId: referrals.referredUserId, tier: referrals.tier, status: referrals.status, qualifiedAt: referrals.qualifiedAt, username: profiles.username })
    .from(referrals)
    .leftJoin(profiles, eq(referrals.referredUserId, profiles.userId))
    .where(eq(referrals.referrerUserId, referrerUserId))
    .orderBy(desc(referrals.createdAt));
}

export async function getAdminUserDetail(userId: number) {
  const db = requireDatabase(await getDb());
  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!user) throw new Error("Member not found.");
  const [profile] = await db.select().from(profiles).where(eq(profiles.userId, userId)).limit(1);
  const [wallet] = await db.select().from(wallets).where(eq(wallets.userId, userId)).limit(1);
  const socials = await db.select().from(socialAccounts).where(eq(socialAccounts.userId, userId));
  const multiplier = await getActiveMultiplier(userId);
  const points = await getUserPointHistory(userId);
  const referrals = await getReferralTree(userId);
  return { user, profile, wallet, socials, multiplier, points, referrals };
}
