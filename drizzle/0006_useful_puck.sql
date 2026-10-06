CREATE TABLE `agent_feedback` (
	`id` int AUTO_INCREMENT NOT NULL,
	`agentId` int NOT NULL,
	`userId` int NOT NULL,
	`conversationId` varchar(64) NOT NULL,
	`rating` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `agent_feedback_id` PRIMARY KEY(`id`),
	CONSTRAINT `agent_feedback_user_conversation_unique` UNIQUE(`agentId`,`userId`,`conversationId`)
);
--> statement-breakpoint
CREATE TABLE `agent_messages` (
	`id` int AUTO_INCREMENT NOT NULL,
	`agentId` int NOT NULL,
	`userId` int NOT NULL,
	`conversationId` varchar(64) NOT NULL,
	`role` enum('user','assistant') NOT NULL,
	`content` text NOT NULL,
	`creditsSpent` int NOT NULL DEFAULT 0,
	`provider` varchar(64),
	`model` varchar(160),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `agent_messages_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `agents` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int NOT NULL,
	`creatorUserId` int NOT NULL,
	`name` varchar(120) NOT NULL,
	`slug` varchar(120) NOT NULL,
	`description` text NOT NULL,
	`personality` varchar(80) NOT NULL,
	`systemInstructions` text NOT NULL,
	`goals` text NOT NULL,
	`allowedActions` text NOT NULL,
	`prohibitedActions` text NOT NULL,
	`responseStyle` varchar(80) NOT NULL,
	`avatarUrl` varchar(2048),
	`status` enum('draft','launched','disabled') NOT NULL DEFAULT 'draft',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `agents_id` PRIMARY KEY(`id`),
	CONSTRAINT `agents_slug_unique` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE TABLE `credit_packages` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(96) NOT NULL,
	`credits` int NOT NULL,
	`priceWei` varchar(96) NOT NULL,
	`active` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `credit_packages_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `credit_transactions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`type` enum('welcome','purchase','spend','admin_adjustment','refund') NOT NULL,
	`amount` int NOT NULL,
	`reference` varchar(160) NOT NULL,
	`txHash` varchar(128),
	`metadata` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `credit_transactions_id` PRIMARY KEY(`id`),
	CONSTRAINT `credit_transactions_user_type_reference_unique` UNIQUE(`userId`,`type`,`reference`)
);
--> statement-breakpoint
CREATE TABLE `projects` (
	`id` int AUTO_INCREMENT NOT NULL,
	`creatorUserId` int NOT NULL,
	`name` varchar(160) NOT NULL,
	`slug` varchar(96) NOT NULL,
	`symbol` varchar(32),
	`description` text NOT NULL,
	`tokenContractAddress` varchar(42),
	`chainId` int,
	`imageUrl` varchar(2048),
	`active` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `projects_id` PRIMARY KEY(`id`),
	CONSTRAINT `projects_slug_unique` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE INDEX `agent_feedback_agent_idx` ON `agent_feedback` (`agentId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `agent_messages_agent_created_idx` ON `agent_messages` (`agentId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `agent_messages_user_created_idx` ON `agent_messages` (`userId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `agent_messages_conversation_idx` ON `agent_messages` (`conversationId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `agents_creator_status_idx` ON `agents` (`creatorUserId`,`status`);--> statement-breakpoint
CREATE INDEX `agents_project_idx` ON `agents` (`projectId`);--> statement-breakpoint
CREATE INDEX `credit_packages_active_idx` ON `credit_packages` (`active`,`createdAt`);--> statement-breakpoint
CREATE INDEX `credit_transactions_user_created_idx` ON `credit_transactions` (`userId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `projects_creator_created_idx` ON `projects` (`creatorUserId`,`createdAt`);