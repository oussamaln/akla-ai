export const STANDARD_QUEST_MINIMUM = 200;

export const REFERRAL_TIER_PERCENTAGES = {
  1: 15,
  2: 10,
  3: 5,
} as const;

export const MULTIPLIER_TIER_VALUES = [1, 1.2, 1.5, 2] as const;
export const SUPPORTED_SOCIAL_QUEST_PLATFORMS = [
  "x",
  "telegram",
  "discord",
  "instagram",
] as const;

export type QuestCategory = "social" | "presence" | "passage";
export type QuestType = "standard" | "premium" | "daily" | "weekly" | "manual";
export type PointSource =
  | "quest"
  | "daily_checkin"
  | "weekly_checkin"
  | "referral_reward"
  | "admin_adjustment"
  | "campaign";

export function validateQuestReward(input: {
  basePoints: number;
  questType: QuestType;
  isPremium: boolean;
}) {
  const isStandardEarningQuest =
    input.questType === "standard" ||
    input.questType === "daily" ||
    input.questType === "weekly";
  if (
    isStandardEarningQuest &&
    !input.isPremium &&
    input.basePoints < STANDARD_QUEST_MINIMUM
  ) {
    throw new Error(
      `Standard earning quests must award at least ${STANDARD_QUEST_MINIMUM} base points.`
    );
  }
  if (!Number.isInteger(input.basePoints) || input.basePoints <= 0) {
    throw new Error("Quest reward must be a positive whole number.");
  }
}

export function calculateFinalPoints(
  basePoints: number,
  multiplier: number,
  qualifiesForMultiplier = true
) {
  if (!Number.isInteger(basePoints) || basePoints <= 0) {
    throw new Error("Base points must be a positive whole number.");
  }
  if (
    !MULTIPLIER_TIER_VALUES.includes(
      multiplier as (typeof MULTIPLIER_TIER_VALUES)[number]
    )
  ) {
    throw new Error("Multiplier must be one of the configured tier values.");
  }
  return qualifiesForMultiplier
    ? Math.round(basePoints * multiplier)
    : basePoints;
}

export function isValidEthereumAddress(address: string) {
  return /^0x[a-fA-F0-9]{40}$/.test(address);
}

export function walletVerificationStateAfterAddressChange(
  existing:
    | {
        normalizedAddress: string;
        verificationState: "unverified" | "verified";
      }
    | undefined,
  nextAddress: string
) {
  return existing?.verificationState === "verified" &&
    existing.normalizedAddress === nextAddress.toLowerCase()
    ? "verified"
    : "unverified";
}

export function utcDateKey(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

export function utcWeekKey(date = new Date()) {
  const day = date.getUTCDay() || 7;
  const weekStart = new Date(
    Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth(),
      date.getUTCDate() - day + 1
    )
  );
  return weekStart.toISOString().slice(0, 10);
}

export function isDuplicateIdempotencyKey(
  existingKeys: readonly string[],
  idempotencyKey: string
) {
  return existingKeys.includes(idempotencyKey);
}

export function hasAlreadyClaimedUtcPeriod(
  existingPeriodKeys: readonly string[],
  periodKey: string
) {
  return existingPeriodKeys.includes(periodKey);
}

export function wouldCreateReferralCycle(
  referredUserId: number,
  ancestorUserIds: readonly number[]
) {
  return ancestorUserIds.includes(referredUserId);
}

export function assertNotSelfReferral(
  referrerUserId: number,
  referredUserId: number
) {
  if (referrerUserId === referredUserId)
    throw new Error("You cannot use your own referral link.");
}

export function isProfileQualificationEligible(input: {
  username: string;
  fullName?: string;
  dateOfBirth?: string;
  country?: string;
  walletAddress?: string;
}) {
  return Boolean(
    input.username.trim() &&
      input.fullName?.trim() &&
      input.dateOfBirth &&
      input.country?.trim() &&
      input.walletAddress?.trim()
  );
}

export function shouldAwardWeeklyCheckin(
  progressDays: number,
  requiredDays: number,
  alreadyCompleted: boolean
) {
  return progressDays >= requiredDays && !alreadyCompleted;
}

export function canVerifyQuestCompletion(
  status: "pending" | "verified" | "rejected"
) {
  return status === "pending";
}

export function validateAvatarPayload(dataUrl: string) {
  const match =
    /^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl);
  if (!match) throw new Error("Upload a PNG, JPEG, or WebP image.");
  const mimeType = match[1]!;
  const bytes = Buffer.from(match[2]!, "base64");
  if (bytes.length === 0 || bytes.length > 2 * 1024 * 1024)
    throw new Error("Profile images must be no larger than 2 MB.");
  const matchesSignature =
    (mimeType === "image/png" &&
      bytes
        .subarray(0, 8)
        .equals(
          Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
        )) ||
    (mimeType === "image/jpeg" &&
      bytes.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]))) ||
    (mimeType === "image/webp" &&
      bytes.subarray(0, 4).toString("ascii") === "RIFF" &&
      bytes.subarray(8, 12).toString("ascii") === "WEBP");
  if (!matchesSignature)
    throw new Error(
      "The uploaded image file does not match its declared type."
    );
  const extension =
    mimeType === "image/png"
      ? "png"
      : mimeType === "image/jpeg"
        ? "jpg"
        : "webp";
  return { mimeType, bytes, extension };
}
