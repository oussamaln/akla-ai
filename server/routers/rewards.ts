import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { appSettings, campaigns, multiplierLevels, officialSocialAccounts, quests } from "../../drizzle/schema";
import { MULTIPLIER_TIER_VALUES, STANDARD_QUEST_MINIMUM, validateQuestReward } from "../../shared/rewards";
import { getDb } from "../db";
import {
  attachReferral,
  enforceRateLimit,
  ensureDefaultConfiguration,
  ensureProfile,
  getAdminOverview,
  getAdminUserDetail,
  getAdminUsers,
  getLeaderboard,
  getMemberSummary,
  getQuestBoard,
  getSetting,
  getReferralTree,
  getUserPointHistory,
  recordAdminAudit,
  recordDailyCheckin,
  recordWeeklyProgress,
  claimQuest,
  updateMemberProfile,
  uploadProfileAvatar,
  verifyQuestCompletion,
} from "../rewards";
import { adminProcedure, protectedProcedure, router } from "../_core/trpc";

const socialInput = z.object({
  x: z.string().max(320).optional(),
  telegram: z.string().max(320).optional(),
  discord: z.string().max(320).optional(),
  email: z.string().email().max(320).optional(),
});

const questInput = z.object({
  id: z.number().int().positive().optional(),
  slug: z.string().trim().min(3).max(96).regex(/^[a-z0-9-]+$/),
  title: z.string().trim().min(3).max(160),
  description: z.string().trim().min(10).max(3000),
  category: z.enum(["social", "presence", "passage"]),
  questType: z.enum(["standard", "premium", "daily", "weekly", "manual"]),
  verificationType: z.enum(["manual", "oauth", "api", "onchain", "system"]),
  platform: z.string().trim().max(64).optional(),
  basePoints: z.number().int().positive(),
  isPremium: z.boolean(),
  active: z.boolean(),
  ctaLabel: z.string().trim().max(80).optional(),
  ctaUrl: z.string().url().max(2048).optional(),
  completionLimit: z.number().int().min(1).max(100).default(1),
  instructions: z.array(z.string().trim().max(500)).max(12).optional(),
  startsAt: z.date().optional(),
  endsAt: z.date().optional(),
});

export const memberRouter = router({
  summary: protectedProcedure.query(async ({ ctx }) => {
    await ensureProfile(ctx.user.id, ctx.user.name);
    return getMemberSummary(ctx.user.id);
  }),
  questBoard: protectedProcedure.query(async ({ ctx }) => {
    await ensureProfile(ctx.user.id, ctx.user.name);
    return getQuestBoard(ctx.user.id);
  }),
  configuration: protectedProcedure.query(async () => ({
    readTheDocsUrl: await getSetting("readTheDocsUrl", ""),
  })),
  profile: router({
    update: protectedProcedure.input(z.object({
      username: z.string().trim().min(3).max(64),
      bio: z.string().trim().max(280).optional(),
      fullName: z.string().trim().max(160).optional(),
      dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      country: z.string().trim().length(2).optional(),
      walletAddress: z.string().trim().optional(),
      socialAccounts: socialInput,
    })).mutation(async ({ ctx, input }) => {
      await ensureProfile(ctx.user.id, ctx.user.name);
      await enforceRateLimit(ctx.user.id, "profile_update", 10, 60 * 60 * 1000);
      await updateMemberProfile({ userId: ctx.user.id, ...input });
      return getMemberSummary(ctx.user.id);
    }),
    uploadAvatar: protectedProcedure.input(z.object({ dataUrl: z.string().max(3_000_000) })).mutation(async ({ ctx, input }) => {
      await ensureProfile(ctx.user.id, ctx.user.name);
      return uploadProfileAvatar(ctx.user.id, input.dataUrl);
    }),
  }),
  quests: router({
    claim: protectedProcedure.input(z.object({ questId: z.number().int().positive(), idempotencyKey: z.string().uuid() })).mutation(async ({ ctx, input }) => {
      return claimQuest(ctx.user.id, input.questId, input.idempotencyKey);
    }),
    checkIn: protectedProcedure.mutation(async ({ ctx }) => {
      const daily = await recordDailyCheckin(ctx.user.id);
      const weekly = await recordWeeklyProgress(ctx.user.id);
      return { daily, weekly };
    }),
  }),
  referrals: router({
    attach: protectedProcedure.input(z.object({ referralCode: z.string().trim().min(4).max(32) })).mutation(async ({ ctx, input }) => {
      await enforceRateLimit(ctx.user.id, "attach_referral", 3, 24 * 60 * 60 * 1000);
      await attachReferral(ctx.user.id, input.referralCode);
      return getMemberSummary(ctx.user.id);
    }),
  }),
  leaderboards: router({
    list: protectedProcedure.input(z.object({ scope: z.enum(["global", "weekly", "monthly", "referral"]), page: z.number().int().min(0).default(0), pageSize: z.number().int().min(1).max(50).default(20) })).query(({ ctx, input }) => {
      return getLeaderboard({ ...input, currentUserId: ctx.user.id });
    }),
  }),
});

export const adminRouter = router({
  overview: adminProcedure.query(async () => {
    await ensureDefaultConfiguration();
    return getAdminOverview();
  }),
  users: router({
    list: adminProcedure.input(z.object({ search: z.string().max(160).optional(), page: z.number().int().min(0).default(0), pageSize: z.number().int().min(1).max(50).default(20) })).query(({ input }) => getAdminUsers(input)),
    detail: adminProcedure.input(z.object({ userId: z.number().int().positive() })).query(({ input }) => getAdminUserDetail(input.userId)),
    pointHistory: adminProcedure.input(z.object({ userId: z.number().int().positive() })).query(({ input }) => getUserPointHistory(input.userId)),
    referralTree: adminProcedure.input(z.object({ userId: z.number().int().positive() })).query(({ input }) => getReferralTree(input.userId)),
  }),
  questReview: router({
    decide: adminProcedure.input(z.object({ completionId: z.number().int().positive(), approved: z.boolean() })).mutation(async ({ ctx, input }) => {
      await enforceRateLimit(ctx.user.id, "admin_quest_review", 60, 60 * 60 * 1000);
      const result = await verifyQuestCompletion(ctx.user.id, input.completionId, input.approved);
      await recordAdminAudit({ adminUserId: ctx.user.id, action: input.approved ? "quest_completion_approved" : "quest_completion_rejected", targetType: "quest_completion", targetId: String(input.completionId) });
      return result;
    }),
  }),
  quests: router({
    list: adminProcedure.query(async () => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      return db.select().from(quests).orderBy(quests.category, quests.title);
    }),
    upsert: adminProcedure.input(questInput).mutation(async ({ ctx, input }) => {
      validateQuestReward({ basePoints: input.basePoints, questType: input.questType, isPremium: input.isPremium });
      if (input.endsAt && input.startsAt && input.endsAt <= input.startsAt) throw new Error("Quest end time must be after the start time.");
      await enforceRateLimit(ctx.user.id, "admin_quest_config", 30, 60 * 60 * 1000);
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      const payload = { ...input, platform: input.platform || null, ctaLabel: input.ctaLabel || null, ctaUrl: input.ctaUrl || null, instructions: input.instructions ?? null };
      if (input.id) {
        await db.update(quests).set(payload).where(eq(quests.id, input.id));
        await recordAdminAudit({ adminUserId: ctx.user.id, action: "quest_updated", targetType: "quest", targetId: String(input.id) });
        return { id: input.id };
      }
      await db.insert(quests).values({ ...payload, createdByUserId: ctx.user.id });
      const created = await db.select({ id: quests.id }).from(quests).where(eq(quests.slug, input.slug)).limit(1);
      await recordAdminAudit({ adminUserId: ctx.user.id, action: "quest_created", targetType: "quest", targetId: String(created[0]?.id) });
      return { id: created[0]?.id };
    }),
  }),
  socialAccounts: router({
    list: adminProcedure.query(async () => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      return db.select().from(officialSocialAccounts).orderBy(officialSocialAccounts.platform);
    }),
    upsert: adminProcedure.input(z.object({ platform: z.enum(["x", "telegram", "discord", "email"]), handle: z.string().trim().min(1).max(320), url: z.string().url().max(2048).optional(), active: z.boolean() })).mutation(async ({ ctx, input }) => {
      await enforceRateLimit(ctx.user.id, "admin_social_config", 30, 60 * 60 * 1000);
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      await db.insert(officialSocialAccounts).values({ ...input, url: input.url || null, updatedByUserId: ctx.user.id }).onDuplicateKeyUpdate({ set: { handle: input.handle, url: input.url || null, active: input.active, updatedByUserId: ctx.user.id } });
      await recordAdminAudit({ adminUserId: ctx.user.id, action: "official_social_updated", targetType: "official_social", targetId: input.platform });
      return { success: true };
    }),
  }),
  multipliers: router({
    list: adminProcedure.query(async () => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      return db.select().from(multiplierLevels).orderBy(multiplierLevels.rank);
    }),
    updateThresholds: adminProcedure.input(z.array(z.object({ rank: z.number().int().min(1).max(4), thresholdPoints: z.number().int().min(0) })).length(4)).mutation(async ({ ctx, input }) => {
      const ranks = [...input].sort((a, b) => a.rank - b.rank);
      if (ranks.some((entry, index) => entry.rank !== index + 1) || ranks.some((entry, index) => index > 0 && entry.thresholdPoints < ranks[index - 1]!.thresholdPoints)) throw new Error("Multiplier thresholds must cover all tiers in ascending order.");
      await enforceRateLimit(ctx.user.id, "admin_multiplier_config", 30, 60 * 60 * 1000);
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      for (const entry of ranks) await db.update(multiplierLevels).set({ thresholdPoints: entry.thresholdPoints, multiplier: MULTIPLIER_TIER_VALUES[entry.rank - 1]!.toFixed(2) }).where(eq(multiplierLevels.rank, entry.rank));
      await recordAdminAudit({ adminUserId: ctx.user.id, action: "multiplier_thresholds_updated", targetType: "multiplier_levels" });
      return { success: true };
    }),
  }),
  settings: router({
    list: adminProcedure.query(async () => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      return db.select().from(appSettings).orderBy(appSettings.key);
    }),
    update: adminProcedure.input(z.object({ key: z.enum(["dailyCheckinBasePoints", "weeklyCheckinBasePoints", "weeklyCheckinDaysRequired", "readTheDocsUrl"]), value: z.union([z.number().int(), z.string().url().or(z.literal(""))]) })).mutation(async ({ ctx, input }) => {
      if ((input.key === "dailyCheckinBasePoints" || input.key === "weeklyCheckinBasePoints") && (typeof input.value !== "number" || input.value < STANDARD_QUEST_MINIMUM)) throw new Error(`Check-in rewards must be at least ${STANDARD_QUEST_MINIMUM} points.`);
      if (input.key === "weeklyCheckinDaysRequired" && (typeof input.value !== "number" || input.value < 1 || input.value > 7)) throw new Error("Weekly progress must require between 1 and 7 daily check-ins.");
      await enforceRateLimit(ctx.user.id, "admin_settings_config", 30, 60 * 60 * 1000);
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      await db.insert(appSettings).values({ key: input.key, value: input.value, updatedByUserId: ctx.user.id }).onDuplicateKeyUpdate({ set: { value: input.value, updatedByUserId: ctx.user.id } });
      await recordAdminAudit({ adminUserId: ctx.user.id, action: "setting_updated", targetType: "setting", targetId: input.key });
      return { success: true };
    }),
  }),
  campaigns: router({
    list: adminProcedure.query(async () => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      return db.select().from(campaigns).orderBy(campaigns.createdAt);
    }),
    upsert: adminProcedure.input(z.object({ id: z.number().int().positive().optional(), name: z.string().trim().min(3).max(160), description: z.string().trim().max(3000).optional(), active: z.boolean(), startsAt: z.date().optional(), endsAt: z.date().optional() })).mutation(async ({ ctx, input }) => {
      if (input.startsAt && input.endsAt && input.endsAt <= input.startsAt) throw new Error("Campaign end time must be after the start time.");
      await enforceRateLimit(ctx.user.id, "admin_campaign_config", 30, 60 * 60 * 1000);
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      const values = { name: input.name, description: input.description || null, active: input.active, startsAt: input.startsAt || null, endsAt: input.endsAt || null };
      if (input.id) {
        await db.update(campaigns).set(values).where(eq(campaigns.id, input.id));
        await recordAdminAudit({ adminUserId: ctx.user.id, action: "campaign_updated", targetType: "campaign", targetId: String(input.id) });
        return { id: input.id };
      }
      await db.insert(campaigns).values(values);
      const created = await db.select({ id: campaigns.id }).from(campaigns).where(eq(campaigns.name, input.name)).limit(1);
      await recordAdminAudit({ adminUserId: ctx.user.id, action: "campaign_created", targetType: "campaign", targetId: String(created[0]?.id) });
      return { id: created[0]?.id };
    }),
  }),
});
