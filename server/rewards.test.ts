import { describe, expect, it } from "vitest";
import {
  assertNotSelfReferral,
  canVerifyQuestCompletion,
  calculateFinalPoints,
  hasAlreadyClaimedUtcPeriod,
  isValidEthereumAddress,
  isDuplicateIdempotencyKey,
  isProfileQualificationEligible,
  MULTIPLIER_TIER_VALUES,
  REFERRAL_TIER_PERCENTAGES,
  SUPPORTED_SOCIAL_QUEST_PLATFORMS,
  utcDateKey,
  utcWeekKey,
  validateAvatarPayload,
  validateQuestReward,
  wouldCreateReferralCycle,
  shouldAwardWeeklyCheckin,
} from "../shared/rewards";
import {
  buildQuestHistory,
  isOpaqueReferralCode,
  makeReferralCode,
  normalizeQuestIdentity,
} from "./rewards";
import { makeMemberUid, resolveRoleAssignment } from "./db";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

describe("Akla reward rules", () => {
  it("rejects standard earning quests below the mandatory 200-point minimum", () => {
    expect(() =>
      validateQuestReward({
        basePoints: 199,
        questType: "standard",
        isPremium: false,
      })
    ).toThrow("at least 200");
    expect(() =>
      validateQuestReward({
        basePoints: 150,
        questType: "daily",
        isPremium: false,
      })
    ).toThrow("at least 200");
    expect(() =>
      validateQuestReward({
        basePoints: 200,
        questType: "weekly",
        isPremium: false,
      })
    ).not.toThrow();
  });

  it("accepts premium quest rewards above the standard floor", () => {
    expect(() =>
      validateQuestReward({
        basePoints: 1000,
        questType: "premium",
        isPremium: true,
      })
    ).not.toThrow();
  });

  it("applies only the active tier multiplier to qualifying future earnings", () => {
    expect(calculateFinalPoints(200, 1.5)).toBe(300);
    expect(calculateFinalPoints(1000, 2)).toBe(2000);
    expect(calculateFinalPoints(200, 2, false)).toBe(200);
    expect(() => calculateFinalPoints(200, 1.8)).toThrow("configured tier");
  });

  it("keeps referral percentages and multiplier tiers fixed to the configured policy", () => {
    expect(REFERRAL_TIER_PERCENTAGES).toEqual({ 1: 15, 2: 10, 3: 5 });
    expect(MULTIPLIER_TIER_VALUES).toEqual([1, 1.2, 1.5, 2]);
  });

  it("uses stable UTC day and weekly keys for check-in enforcement", () => {
    const sunday = new Date("2026-08-30T23:30:00.000Z");
    const monday = new Date("2026-08-31T00:30:00.000Z");
    expect(utcDateKey(sunday)).toBe("2026-08-30");
    expect(utcWeekKey(sunday)).toBe("2026-08-24");
    expect(utcWeekKey(monday)).toBe("2026-08-31");
  });

  it("validates Ethereum wallet shape before persistence", () => {
    expect(
      isValidEthereumAddress("0x1234567890abcdef1234567890ABCDEF12345678")
    ).toBe(true);
    expect(isValidEthereumAddress("0x1234")).toBe(false);
  });

  it("creates opaque random referral tokens rather than account-derived codes", () => {
    const firstCode = makeReferralCode();
    const secondCode = makeReferralCode();
    expect(isOpaqueReferralCode(firstCode)).toBe(true);
    expect(isOpaqueReferralCode(secondCode)).toBe(true);
    expect(firstCode).not.toBe(secondCode);
    expect(isOpaqueReferralCode("akla000001")).toBe(false);
    expect(isOpaqueReferralCode("akla-not-valid!")).toBe(false);
  });

  it("creates opaque member UIDs for account identity and admin lookup", () => {
    const firstUid = makeMemberUid();
    const secondUid = makeMemberUid();
    expect(firstUid).toMatch(/^UID-[A-F0-9]{12}$/);
    expect(secondUid).toMatch(/^UID-[A-F0-9]{12}$/);
    expect(firstUid).not.toBe(secondUid);
  });

  it("retains every submission for a selected member instead of collapsing repeat attempts", () => {
    const history = buildQuestHistory(
      [
        { id: 1, title: "Daily proof" },
        { id: 2, title: "Discord proof" },
      ],
      [
        { id: 10, questId: 1, status: "verified" },
        { id: 11, questId: 1, status: "pending" },
        { id: 12, questId: 2, status: "rejected" },
      ]
    );
    expect(history[0]?.submissions).toHaveLength(2);
    expect(history[0]?.submissions.map(submission => submission.id)).toEqual([
      10, 11,
    ]);
    expect(history[1]?.submissions).toHaveLength(1);
  });

  it("keeps all required social platforms available to quest configuration", () => {
    expect(SUPPORTED_SOCIAL_QUEST_PLATFORMS).toEqual([
      "x",
      "telegram",
      "discord",
      "instagram",
    ]);
  });

  it("requires and normalizes the identity submitted for a social quest", () => {
    expect(normalizeQuestIdentity("x", "  @akla_ai  ")).toEqual({
      platform: "x",
      handle: "@akla_ai",
    });
    expect(() => normalizeQuestIdentity("discord", "")).toThrow(
      "discord username"
    );
    expect(() => normalizeQuestIdentity("email", "not-an-email")).toThrow(
      "valid email"
    );
    expect(normalizeQuestIdentity(undefined, undefined)).toBeNull();
  });

  it("identifies duplicate idempotency keys before a ledger reward is created twice", () => {
    expect(
      isDuplicateIdempotencyKey(
        ["quest:101", "daily:42:2026-08-26"],
        "quest:101"
      )
    ).toBe(true);
    expect(isDuplicateIdempotencyKey(["quest:101"], "quest:102")).toBe(false);
  });

  it("detects duplicate daily or weekly UTC period claims", () => {
    expect(hasAlreadyClaimedUtcPeriod(["2026-08-26"], "2026-08-26")).toBe(true);
    expect(hasAlreadyClaimedUtcPeriod(["2026-08-26"], "2026-08-27")).toBe(
      false
    );
  });

  it("blocks referral cycles before a referral relationship is persisted", () => {
    expect(wouldCreateReferralCycle(9, [12, 9, 4])).toBe(true);
    expect(wouldCreateReferralCycle(9, [12, 8, 4])).toBe(false);
    expect(() => assertNotSelfReferral(9, 9)).toThrow("own referral");
    expect(() => assertNotSelfReferral(9, 10)).not.toThrow();
  });

  it("qualifies referrals only after the required profile identity is complete", () => {
    expect(
      isProfileQualificationEligible({
        username: "member-1",
        fullName: "Akla Member",
        dateOfBirth: "1990-01-01",
        country: "US",
        walletAddress: "0x123",
      })
    ).toBe(true);
    expect(
      isProfileQualificationEligible({
        username: "member-1",
        fullName: "Akla Member",
        country: "US",
        walletAddress: "0x123",
      })
    ).toBe(false);
  });

  it("awards a weekly check-in only after progress reaches the configured threshold and only once", () => {
    expect(shouldAwardWeeklyCheckin(4, 5, false)).toBe(false);
    expect(shouldAwardWeeklyCheckin(5, 5, false)).toBe(true);
    expect(shouldAwardWeeklyCheckin(5, 5, true)).toBe(false);
  });

  it("allows quest award approval only from a pending verification state", () => {
    expect(canVerifyQuestCompletion("pending")).toBe(true);
    expect(canVerifyQuestCompletion("verified")).toBe(false);
    expect(canVerifyQuestCompletion("rejected")).toBe(false);
  });

  it("preserves an existing administrator role during routine OAuth account refreshes", () => {
    expect(resolveRoleAssignment(undefined, false)).toBeUndefined();
    expect(resolveRoleAssignment(undefined, true)).toBe("admin");
    expect(resolveRoleAssignment("admin", false)).toBe("admin");
  });

  it("accepts signed image payloads only when their MIME declaration and bytes agree", () => {
    const png = "data:image/png;base64,iVBORw0KGgo=";
    expect(validateAvatarPayload(png)).toMatchObject({
      mimeType: "image/png",
      extension: "png",
    });
    expect(() => validateAvatarPayload("data:image/png;base64,/9j/")).toThrow(
      "does not match"
    );
    expect(() =>
      validateAvatarPayload("data:image/gif;base64,R0lGODlh")
    ).toThrow("PNG, JPEG, or WebP");
  });

  it("blocks a standard member from the admin rewards console", async () => {
    const ctx = {
      user: {
        id: 42,
        openId: "member-open-id",
        name: "Member",
        email: "member@example.com",
        loginMethod: "manus",
        role: "user",
        createdAt: new Date(),
        updatedAt: new Date(),
        lastSignedIn: new Date(),
      },
      req: {} as TrpcContext["req"],
      res: {} as TrpcContext["res"],
    } as TrpcContext;
    await expect(
      appRouter.createCaller(ctx).admin.overview()
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
