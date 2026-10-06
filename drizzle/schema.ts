import {
  boolean,
  decimal,
  index,
  int,
  json,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/mysql-core";

export const users = mysqlTable(
  "users",
  {
    id: int("id").autoincrement().primaryKey(),
    memberUid: varchar("memberUid", { length: 20 }),
    openId: varchar("openId", { length: 64 }).notNull().unique(),
    name: text("name"),
    email: varchar("email", { length: 320 }),
    loginMethod: varchar("loginMethod", { length: 64 }),
    role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
    lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
  },
  table => [uniqueIndex("users_member_uid_unique").on(table.memberUid)]
);

export const profiles = mysqlTable(
  "profiles",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("userId").notNull(),
    username: varchar("username", { length: 64 }).notNull(),
    bio: varchar("bio", { length: 280 }),
    avatarUrl: varchar("avatarUrl", { length: 2048 }),
    avatarKey: varchar("avatarKey", { length: 512 }),
    fullName: varchar("fullName", { length: 160 }),
    dateOfBirth: varchar("dateOfBirth", { length: 10 }),
    country: varchar("country", { length: 2 }),
    profileComplete: boolean("profileComplete").default(false).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [
    uniqueIndex("profiles_user_id_unique").on(table.userId),
    uniqueIndex("profiles_username_unique").on(table.username),
  ]
);

export const wallets = mysqlTable(
  "wallets",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("userId").notNull(),
    address: varchar("address", { length: 42 }).notNull(),
    normalizedAddress: varchar("normalizedAddress", { length: 42 }).notNull(),
    verificationState: mysqlEnum("verificationState", [
      "unverified",
      "verified",
    ])
      .default("unverified")
      .notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [
    uniqueIndex("wallets_user_id_unique").on(table.userId),
    uniqueIndex("wallets_normalized_address_unique").on(
      table.normalizedAddress
    ),
  ]
);

export const socialAccounts = mysqlTable(
  "social_accounts",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("userId").notNull(),
    platform: mysqlEnum("platform", [
      "x",
      "telegram",
      "discord",
      "instagram",
      "email",
    ]).notNull(),
    handle: varchar("handle", { length: 320 }).notNull(),
    verificationState: mysqlEnum("verificationState", [
      "unverified",
      "manual",
      "verified",
    ])
      .default("manual")
      .notNull(),
    verifiedAt: timestamp("verifiedAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [
    uniqueIndex("social_accounts_user_platform_unique").on(
      table.userId,
      table.platform
    ),
  ]
);

export const quests = mysqlTable(
  "quests",
  {
    id: int("id").autoincrement().primaryKey(),
    slug: varchar("slug", { length: 96 }).notNull(),
    title: varchar("title", { length: 160 }).notNull(),
    description: text("description").notNull(),
    category: mysqlEnum("category", [
      "social",
      "presence",
      "passage",
    ]).notNull(),
    questType: mysqlEnum("questType", [
      "standard",
      "premium",
      "daily",
      "weekly",
      "manual",
    ])
      .default("standard")
      .notNull(),
    verificationType: mysqlEnum("verificationType", [
      "manual",
      "oauth",
      "api",
      "onchain",
      "system",
    ])
      .default("manual")
      .notNull(),
    platform: varchar("platform", { length: 64 }),
    basePoints: int("basePoints").notNull(),
    isPremium: boolean("isPremium").default(false).notNull(),
    active: boolean("active").default(true).notNull(),
    ctaLabel: varchar("ctaLabel", { length: 80 }),
    ctaUrl: varchar("ctaUrl", { length: 2048 }),
    instructions: json("instructions"),
    startsAt: timestamp("startsAt"),
    endsAt: timestamp("endsAt"),
    completionLimit: int("completionLimit").default(1).notNull(),
    createdByUserId: int("createdByUserId"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [
    uniqueIndex("quests_slug_unique").on(table.slug),
    index("quests_active_category_idx").on(table.active, table.category),
  ]
);

export const questCompletions = mysqlTable(
  "quest_completions",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("userId").notNull(),
    questId: int("questId").notNull(),
    status: mysqlEnum("status", ["pending", "verified", "rejected"])
      .default("pending")
      .notNull(),
    verificationData: json("verificationData"),
    completedAt: timestamp("completedAt").defaultNow().notNull(),
    verifiedAt: timestamp("verifiedAt"),
    verifiedByUserId: int("verifiedByUserId"),
    idempotencyKey: varchar("idempotencyKey", { length: 128 }).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [
    uniqueIndex("quest_completions_idempotency_key_unique").on(
      table.idempotencyKey
    ),
    index("quest_completions_user_quest_idx").on(table.userId, table.questId),
  ]
);

export const pointTransactions = mysqlTable(
  "point_transactions",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("userId").notNull(),
    source: mysqlEnum("source", [
      "quest",
      "daily_checkin",
      "weekly_checkin",
      "referral_reward",
      "admin_adjustment",
      "campaign",
    ]).notNull(),
    sourceId: varchar("sourceId", { length: 128 }).notNull(),
    basePoints: int("basePoints").notNull(),
    activeMultiplier: decimal("activeMultiplier", {
      precision: 4,
      scale: 2,
    }).notNull(),
    finalPoints: int("finalPoints").notNull(),
    qualifiesForMultiplier: boolean("qualifiesForMultiplier")
      .default(true)
      .notNull(),
    idempotencyKey: varchar("idempotencyKey", { length: 160 }).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [
    uniqueIndex("point_transactions_idempotency_key_unique").on(
      table.idempotencyKey
    ),
    index("point_transactions_user_created_idx").on(
      table.userId,
      table.createdAt
    ),
    index("point_transactions_source_idx").on(table.source, table.sourceId),
  ]
);

export const dailyCheckins = mysqlTable(
  "daily_checkins",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("userId").notNull(),
    utcDateKey: varchar("utcDateKey", { length: 10 }).notNull(),
    streak: int("streak").notNull(),
    bestStreak: int("bestStreak").notNull(),
    pointTransactionId: int("pointTransactionId"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [
    uniqueIndex("daily_checkins_user_date_unique").on(
      table.userId,
      table.utcDateKey
    ),
    index("daily_checkins_user_created_idx").on(table.userId, table.createdAt),
  ]
);

export const weeklyCheckins = mysqlTable(
  "weekly_checkins",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("userId").notNull(),
    utcWeekKey: varchar("utcWeekKey", { length: 10 }).notNull(),
    progressDays: int("progressDays").default(0).notNull(),
    completedAt: timestamp("completedAt"),
    pointTransactionId: int("pointTransactionId"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [
    uniqueIndex("weekly_checkins_user_week_unique").on(
      table.userId,
      table.utcWeekKey
    ),
  ]
);

export const referrals = mysqlTable(
  "referrals",
  {
    id: int("id").autoincrement().primaryKey(),
    referrerUserId: int("referrerUserId").notNull(),
    referredUserId: int("referredUserId").notNull(),
    referralCode: varchar("referralCode", { length: 32 }).notNull(),
    tier: int("tier").notNull(),
    status: mysqlEnum("status", ["pending", "qualified", "blocked"])
      .default("pending")
      .notNull(),
    qualifiedAt: timestamp("qualifiedAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [
    uniqueIndex("referrals_referred_user_unique").on(table.referredUserId),
    index("referrals_referrer_status_idx").on(
      table.referrerUserId,
      table.status
    ),
  ]
);

export const referralCodes = mysqlTable(
  "referral_codes",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("userId").notNull(),
    code: varchar("code", { length: 48 }).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [
    uniqueIndex("referral_codes_user_unique").on(table.userId),
    uniqueIndex("referral_codes_code_unique").on(table.code),
  ]
);

export const referralRewards = mysqlTable(
  "referral_rewards",
  {
    id: int("id").autoincrement().primaryKey(),
    referralId: int("referralId").notNull(),
    downstreamTransactionId: int("downstreamTransactionId").notNull(),
    rewardPercentage: decimal("rewardPercentage", {
      precision: 5,
      scale: 2,
    }).notNull(),
    rewardPoints: int("rewardPoints").notNull(),
    pointTransactionId: int("pointTransactionId").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [
    uniqueIndex("referral_rewards_referral_downstream_unique").on(
      table.referralId,
      table.downstreamTransactionId
    ),
    index("referral_rewards_transaction_idx").on(table.pointTransactionId),
  ]
);

export const multiplierLevels = mysqlTable(
  "multiplier_levels",
  {
    id: int("id").autoincrement().primaryKey(),
    code: varchar("code", { length: 32 }).notNull(),
    label: varchar("label", { length: 64 }).notNull(),
    rank: int("rank").notNull(),
    multiplier: decimal("multiplier", { precision: 4, scale: 2 }).notNull(),
    thresholdPoints: int("thresholdPoints").notNull(),
    active: boolean("active").default(true).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [
    uniqueIndex("multiplier_levels_code_unique").on(table.code),
    uniqueIndex("multiplier_levels_rank_unique").on(table.rank),
  ]
);

export const multiplierUnlocks = mysqlTable(
  "multiplier_unlocks",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("userId").notNull(),
    multiplierLevelId: int("multiplierLevelId").notNull(),
    unlockedAt: timestamp("unlockedAt").defaultNow().notNull(),
    unlockSource: varchar("unlockSource", { length: 128 }).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [
    uniqueIndex("multiplier_unlocks_user_level_unique").on(
      table.userId,
      table.multiplierLevelId
    ),
  ]
);

export const leaderboardSnapshots = mysqlTable(
  "leaderboard_snapshots",
  {
    id: int("id").autoincrement().primaryKey(),
    scope: mysqlEnum("scope", [
      "global",
      "weekly",
      "monthly",
      "referral",
    ]).notNull(),
    periodKey: varchar("periodKey", { length: 16 }).notNull(),
    userId: int("userId").notNull(),
    rank: int("rank").notNull(),
    networkScore: int("networkScore").notNull(),
    multiplier: decimal("multiplier", { precision: 4, scale: 2 }).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [
    uniqueIndex("leaderboard_snapshots_scope_period_user_unique").on(
      table.scope,
      table.periodKey,
      table.userId
    ),
    index("leaderboard_snapshots_scope_period_rank_idx").on(
      table.scope,
      table.periodKey,
      table.rank
    ),
  ]
);

export const campaigns = mysqlTable(
  "campaigns",
  {
    id: int("id").autoincrement().primaryKey(),
    name: varchar("name", { length: 160 }).notNull(),
    description: text("description"),
    active: boolean("active").default(false).notNull(),
    startsAt: timestamp("startsAt"),
    endsAt: timestamp("endsAt"),
    configuration: json("configuration"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [
    index("campaigns_active_dates_idx").on(
      table.active,
      table.startsAt,
      table.endsAt
    ),
  ]
);

export const officialSocialAccounts = mysqlTable(
  "official_social_accounts",
  {
    id: int("id").autoincrement().primaryKey(),
    platform: mysqlEnum("platform", [
      "x",
      "telegram",
      "discord",
      "instagram",
      "email",
    ]).notNull(),
    handle: varchar("handle", { length: 320 }).notNull(),
    url: varchar("url", { length: 2048 }),
    active: boolean("active").default(true).notNull(),
    updatedByUserId: int("updatedByUserId"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [
    uniqueIndex("official_social_accounts_platform_unique").on(table.platform),
  ]
);

export const appSettings = mysqlTable(
  "app_settings",
  {
    id: int("id").autoincrement().primaryKey(),
    key: varchar("key", { length: 128 }).notNull(),
    value: json("value").notNull(),
    updatedByUserId: int("updatedByUserId"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [uniqueIndex("app_settings_key_unique").on(table.key)]
);

export const rateLimitWindows = mysqlTable(
  "rate_limit_windows",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("userId").notNull(),
    action: varchar("action", { length: 64 }).notNull(),
    windowStart: timestamp("windowStart").notNull(),
    requestCount: int("requestCount").default(0).notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [
    uniqueIndex("rate_limit_windows_user_action_window_unique").on(
      table.userId,
      table.action,
      table.windowStart
    ),
  ]
);

export const adminAuditLogs = mysqlTable(
  "admin_audit_logs",
  {
    id: int("id").autoincrement().primaryKey(),
    adminUserId: int("adminUserId").notNull(),
    action: varchar("action", { length: 96 }).notNull(),
    targetType: varchar("targetType", { length: 64 }).notNull(),
    targetId: varchar("targetId", { length: 128 }),
    metadata: json("metadata"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [
    index("admin_audit_logs_admin_created_idx").on(
      table.adminUserId,
      table.createdAt
    ),
  ]
);

export const web3Challenges = mysqlTable(
  "web3_challenges",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("userId").notNull(),
    address: varchar("address", { length: 42 }).notNull(),
    nonce: varchar("nonce", { length: 64 }).notNull(),
    message: text("message").notNull(),
    expiresAt: timestamp("expiresAt").notNull(),
    usedAt: timestamp("usedAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [
    uniqueIndex("web3_challenges_nonce_unique").on(table.nonce),
    index("web3_challenges_user_idx").on(table.userId, table.createdAt),
  ]
);

export const web3TokenTasks = mysqlTable(
  "web3_token_tasks",
  {
    id: int("id").autoincrement().primaryKey(),
    questId: int("questId").notNull(),
    name: varchar("name", { length: 160 }).notNull(),
    symbol: varchar("symbol", { length: 32 }).notNull(),
    contractAddress: varchar("contractAddress", { length: 42 }).notNull(),
    chainId: int("chainId").notNull(),
    decimals: int("decimals").notNull(),
    minimumBalance: varchar("minimumBalance", { length: 160 }).notNull(),
    rewardPoints: int("rewardPoints").notNull(),
    description: text("description").notNull(),
    active: boolean("active").default(true).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [
    uniqueIndex("web3_token_tasks_quest_unique").on(table.questId),
    uniqueIndex("web3_token_tasks_contract_chain_unique").on(
      table.contractAddress,
      table.chainId
    ),
    index("web3_token_tasks_active_idx").on(table.active, table.createdAt),
  ]
);

export const web3Verifications = mysqlTable(
  "web3_verifications",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("userId").notNull(),
    questId: int("questId").notNull(),
    walletAddress: varchar("walletAddress", { length: 42 }).notNull(),
    chainId: int("chainId").notNull(),
    contractAddress: varchar("contractAddress", { length: 42 }).notNull(),
    verifiedBalance: varchar("verifiedBalance", { length: 160 }).notNull(),
    requiredBalance: varchar("requiredBalance", { length: 160 }).notNull(),
    status: mysqlEnum("status", [
      "verified",
      "not_eligible",
      "error",
    ]).notNull(),
    verificationData: json("verificationData"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [
    index("web3_verifications_user_quest_idx").on(
      table.userId,
      table.questId,
      table.createdAt
    ),
  ]
);

export const projects = mysqlTable(
  "projects",
  {
    id: int("id").autoincrement().primaryKey(),
    creatorUserId: int("creatorUserId").notNull(),
    name: varchar("name", { length: 160 }).notNull(),
    slug: varchar("slug", { length: 96 }).notNull(),
    symbol: varchar("symbol", { length: 32 }),
    description: text("description").notNull(),
    tokenContractAddress: varchar("tokenContractAddress", { length: 42 }),
    chainId: int("chainId"),
    imageUrl: varchar("imageUrl", { length: 2048 }),
    active: boolean("active").default(true).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [
    uniqueIndex("projects_slug_unique").on(table.slug),
    index("projects_creator_created_idx").on(
      table.creatorUserId,
      table.createdAt
    ),
  ]
);

export const agents = mysqlTable(
  "agents",
  {
    id: int("id").autoincrement().primaryKey(),
    projectId: int("projectId").notNull(),
    creatorUserId: int("creatorUserId").notNull(),
    name: varchar("name", { length: 120 }).notNull(),
    slug: varchar("slug", { length: 120 }).notNull(),
    description: text("description").notNull(),
    personality: varchar("personality", { length: 80 }).notNull(),
    systemInstructions: text("systemInstructions").notNull(),
    goals: text("goals").notNull(),
    allowedActions: text("allowedActions").notNull(),
    prohibitedActions: text("prohibitedActions").notNull(),
    responseStyle: varchar("responseStyle", { length: 80 }).notNull(),
    avatarUrl: varchar("avatarUrl", { length: 2048 }),
    status: mysqlEnum("status", ["draft", "launched", "disabled"])
      .default("draft")
      .notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [
    uniqueIndex("agents_slug_unique").on(table.slug),
    index("agents_creator_status_idx").on(table.creatorUserId, table.status),
    index("agents_project_idx").on(table.projectId),
  ]
);

export const agentMessages = mysqlTable(
  "agent_messages",
  {
    id: int("id").autoincrement().primaryKey(),
    agentId: int("agentId").notNull(),
    userId: int("userId").notNull(),
    conversationId: varchar("conversationId", { length: 64 }).notNull(),
    role: mysqlEnum("role", ["user", "assistant"]).notNull(),
    content: text("content").notNull(),
    creditsSpent: int("creditsSpent").default(0).notNull(),
    provider: varchar("provider", { length: 64 }),
    model: varchar("model", { length: 160 }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [
    index("agent_messages_agent_created_idx").on(
      table.agentId,
      table.createdAt
    ),
    index("agent_messages_user_created_idx").on(table.userId, table.createdAt),
    index("agent_messages_conversation_idx").on(
      table.conversationId,
      table.createdAt
    ),
  ]
);

export const agentFeedback = mysqlTable(
  "agent_feedback",
  {
    id: int("id").autoincrement().primaryKey(),
    agentId: int("agentId").notNull(),
    userId: int("userId").notNull(),
    conversationId: varchar("conversationId", { length: 64 }).notNull(),
    rating: int("rating").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [
    uniqueIndex("agent_feedback_user_conversation_unique").on(
      table.agentId,
      table.userId,
      table.conversationId
    ),
    index("agent_feedback_agent_idx").on(table.agentId, table.createdAt),
  ]
);

export const creditTransactions = mysqlTable(
  "credit_transactions",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("userId").notNull(),
    type: mysqlEnum("type", [
      "welcome",
      "purchase",
      "spend",
      "admin_adjustment",
      "refund",
    ]).notNull(),
    amount: int("amount").notNull(),
    reference: varchar("reference", { length: 160 }).notNull(),
    txHash: varchar("txHash", { length: 128 }),
    metadata: json("metadata"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [
    uniqueIndex("credit_transactions_user_type_reference_unique").on(
      table.userId,
      table.type,
      table.reference
    ),
    index("credit_transactions_user_created_idx").on(
      table.userId,
      table.createdAt
    ),
  ]
);

export const creditPackages = mysqlTable(
  "credit_packages",
  {
    id: int("id").autoincrement().primaryKey(),
    name: varchar("name", { length: 96 }).notNull(),
    credits: int("credits").notNull(),
    priceWei: varchar("priceWei", { length: 96 }).notNull(),
    active: boolean("active").default(true).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [
    index("credit_packages_active_idx").on(table.active, table.createdAt),
  ]
);

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
