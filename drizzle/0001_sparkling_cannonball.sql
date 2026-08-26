CREATE TABLE `admin_audit_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`adminUserId` int NOT NULL,
	`action` varchar(96) NOT NULL,
	`targetType` varchar(64) NOT NULL,
	`targetId` varchar(128),
	`metadata` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `admin_audit_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `app_settings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`key` varchar(128) NOT NULL,
	`value` json NOT NULL,
	`updatedByUserId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `app_settings_id` PRIMARY KEY(`id`),
	CONSTRAINT `app_settings_key_unique` UNIQUE(`key`)
);
--> statement-breakpoint
CREATE TABLE `campaigns` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(160) NOT NULL,
	`description` text,
	`active` boolean NOT NULL DEFAULT false,
	`startsAt` timestamp,
	`endsAt` timestamp,
	`configuration` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `campaigns_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `daily_checkins` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`utcDateKey` varchar(10) NOT NULL,
	`streak` int NOT NULL,
	`bestStreak` int NOT NULL,
	`pointTransactionId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `daily_checkins_id` PRIMARY KEY(`id`),
	CONSTRAINT `daily_checkins_user_date_unique` UNIQUE(`userId`,`utcDateKey`)
);
--> statement-breakpoint
CREATE TABLE `leaderboard_snapshots` (
	`id` int AUTO_INCREMENT NOT NULL,
	`scope` enum('global','weekly','monthly','referral') NOT NULL,
	`periodKey` varchar(16) NOT NULL,
	`userId` int NOT NULL,
	`rank` int NOT NULL,
	`networkScore` int NOT NULL,
	`multiplier` decimal(4,2) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `leaderboard_snapshots_id` PRIMARY KEY(`id`),
	CONSTRAINT `leaderboard_snapshots_scope_period_user_unique` UNIQUE(`scope`,`periodKey`,`userId`)
);
--> statement-breakpoint
CREATE TABLE `multiplier_levels` (
	`id` int AUTO_INCREMENT NOT NULL,
	`code` varchar(32) NOT NULL,
	`label` varchar(64) NOT NULL,
	`rank` int NOT NULL,
	`multiplier` decimal(4,2) NOT NULL,
	`thresholdPoints` int NOT NULL,
	`active` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `multiplier_levels_id` PRIMARY KEY(`id`),
	CONSTRAINT `multiplier_levels_code_unique` UNIQUE(`code`),
	CONSTRAINT `multiplier_levels_rank_unique` UNIQUE(`rank`)
);
--> statement-breakpoint
CREATE TABLE `multiplier_unlocks` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`multiplierLevelId` int NOT NULL,
	`unlockedAt` timestamp NOT NULL DEFAULT (now()),
	`unlockSource` varchar(128) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `multiplier_unlocks_id` PRIMARY KEY(`id`),
	CONSTRAINT `multiplier_unlocks_user_level_unique` UNIQUE(`userId`,`multiplierLevelId`)
);
--> statement-breakpoint
CREATE TABLE `official_social_accounts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`platform` enum('x','telegram','discord','email') NOT NULL,
	`handle` varchar(320) NOT NULL,
	`url` varchar(2048),
	`active` boolean NOT NULL DEFAULT true,
	`updatedByUserId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `official_social_accounts_id` PRIMARY KEY(`id`),
	CONSTRAINT `official_social_accounts_platform_unique` UNIQUE(`platform`)
);
--> statement-breakpoint
CREATE TABLE `point_transactions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`source` enum('quest','daily_checkin','weekly_checkin','referral_reward','admin_adjustment','campaign') NOT NULL,
	`sourceId` varchar(128) NOT NULL,
	`basePoints` int NOT NULL,
	`activeMultiplier` decimal(4,2) NOT NULL,
	`finalPoints` int NOT NULL,
	`qualifiesForMultiplier` boolean NOT NULL DEFAULT true,
	`idempotencyKey` varchar(160) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `point_transactions_id` PRIMARY KEY(`id`),
	CONSTRAINT `point_transactions_idempotency_key_unique` UNIQUE(`idempotencyKey`)
);
--> statement-breakpoint
CREATE TABLE `profiles` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`username` varchar(64) NOT NULL,
	`bio` varchar(280),
	`avatarUrl` varchar(2048),
	`avatarKey` varchar(512),
	`fullName` varchar(160),
	`dateOfBirth` varchar(10),
	`country` varchar(2),
	`profileComplete` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `profiles_id` PRIMARY KEY(`id`),
	CONSTRAINT `profiles_user_id_unique` UNIQUE(`userId`),
	CONSTRAINT `profiles_username_unique` UNIQUE(`username`)
);
--> statement-breakpoint
CREATE TABLE `quest_completions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`questId` int NOT NULL,
	`status` enum('pending','verified','rejected') NOT NULL DEFAULT 'pending',
	`verificationData` json,
	`completedAt` timestamp NOT NULL DEFAULT (now()),
	`verifiedAt` timestamp,
	`verifiedByUserId` int,
	`idempotencyKey` varchar(128) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `quest_completions_id` PRIMARY KEY(`id`),
	CONSTRAINT `quest_completions_idempotency_key_unique` UNIQUE(`idempotencyKey`)
);
--> statement-breakpoint
CREATE TABLE `quests` (
	`id` int AUTO_INCREMENT NOT NULL,
	`slug` varchar(96) NOT NULL,
	`title` varchar(160) NOT NULL,
	`description` text NOT NULL,
	`category` enum('social','presence','passage') NOT NULL,
	`questType` enum('standard','premium','daily','weekly','manual') NOT NULL DEFAULT 'standard',
	`verificationType` enum('manual','oauth','api','onchain','system') NOT NULL DEFAULT 'manual',
	`platform` varchar(64),
	`basePoints` int NOT NULL,
	`isPremium` boolean NOT NULL DEFAULT false,
	`active` boolean NOT NULL DEFAULT true,
	`ctaLabel` varchar(80),
	`ctaUrl` varchar(2048),
	`instructions` json,
	`startsAt` timestamp,
	`endsAt` timestamp,
	`completionLimit` int NOT NULL DEFAULT 1,
	`createdByUserId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `quests_id` PRIMARY KEY(`id`),
	CONSTRAINT `quests_slug_unique` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE TABLE `rate_limit_windows` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`action` varchar(64) NOT NULL,
	`windowStart` timestamp NOT NULL,
	`requestCount` int NOT NULL DEFAULT 0,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `rate_limit_windows_id` PRIMARY KEY(`id`),
	CONSTRAINT `rate_limit_windows_user_action_window_unique` UNIQUE(`userId`,`action`,`windowStart`)
);
--> statement-breakpoint
CREATE TABLE `referral_rewards` (
	`id` int AUTO_INCREMENT NOT NULL,
	`referralId` int NOT NULL,
	`downstreamTransactionId` int NOT NULL,
	`rewardPercentage` decimal(5,2) NOT NULL,
	`rewardPoints` int NOT NULL,
	`pointTransactionId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `referral_rewards_id` PRIMARY KEY(`id`),
	CONSTRAINT `referral_rewards_referral_downstream_unique` UNIQUE(`referralId`,`downstreamTransactionId`)
);
--> statement-breakpoint
CREATE TABLE `referrals` (
	`id` int AUTO_INCREMENT NOT NULL,
	`referrerUserId` int NOT NULL,
	`referredUserId` int NOT NULL,
	`referralCode` varchar(32) NOT NULL,
	`tier` int NOT NULL,
	`status` enum('pending','qualified','blocked') NOT NULL DEFAULT 'pending',
	`qualifiedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `referrals_id` PRIMARY KEY(`id`),
	CONSTRAINT `referrals_referred_user_unique` UNIQUE(`referredUserId`)
);
--> statement-breakpoint
CREATE TABLE `social_accounts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`platform` enum('x','telegram','discord','email') NOT NULL,
	`handle` varchar(320) NOT NULL,
	`verificationState` enum('unverified','manual','verified') NOT NULL DEFAULT 'manual',
	`verifiedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `social_accounts_id` PRIMARY KEY(`id`),
	CONSTRAINT `social_accounts_user_platform_unique` UNIQUE(`userId`,`platform`)
);
--> statement-breakpoint
CREATE TABLE `wallets` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`address` varchar(42) NOT NULL,
	`normalizedAddress` varchar(42) NOT NULL,
	`verificationState` enum('unverified','verified') NOT NULL DEFAULT 'unverified',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `wallets_id` PRIMARY KEY(`id`),
	CONSTRAINT `wallets_user_id_unique` UNIQUE(`userId`),
	CONSTRAINT `wallets_normalized_address_unique` UNIQUE(`normalizedAddress`)
);
--> statement-breakpoint
CREATE TABLE `weekly_checkins` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`utcWeekKey` varchar(10) NOT NULL,
	`progressDays` int NOT NULL DEFAULT 0,
	`completedAt` timestamp,
	`pointTransactionId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `weekly_checkins_id` PRIMARY KEY(`id`),
	CONSTRAINT `weekly_checkins_user_week_unique` UNIQUE(`userId`,`utcWeekKey`)
);
--> statement-breakpoint
CREATE INDEX `admin_audit_logs_admin_created_idx` ON `admin_audit_logs` (`adminUserId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `campaigns_active_dates_idx` ON `campaigns` (`active`,`startsAt`,`endsAt`);--> statement-breakpoint
CREATE INDEX `daily_checkins_user_created_idx` ON `daily_checkins` (`userId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `leaderboard_snapshots_scope_period_rank_idx` ON `leaderboard_snapshots` (`scope`,`periodKey`,`rank`);--> statement-breakpoint
CREATE INDEX `point_transactions_user_created_idx` ON `point_transactions` (`userId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `point_transactions_source_idx` ON `point_transactions` (`source`,`sourceId`);--> statement-breakpoint
CREATE INDEX `quest_completions_user_quest_idx` ON `quest_completions` (`userId`,`questId`);--> statement-breakpoint
CREATE INDEX `quests_active_category_idx` ON `quests` (`active`,`category`);--> statement-breakpoint
CREATE INDEX `referral_rewards_transaction_idx` ON `referral_rewards` (`pointTransactionId`);--> statement-breakpoint
CREATE INDEX `referrals_referrer_status_idx` ON `referrals` (`referrerUserId`,`status`);