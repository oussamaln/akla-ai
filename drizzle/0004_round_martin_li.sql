CREATE TABLE `web3_challenges` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`address` varchar(42) NOT NULL,
	`nonce` varchar(64) NOT NULL,
	`message` text NOT NULL,
	`expiresAt` timestamp NOT NULL,
	`usedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `web3_challenges_id` PRIMARY KEY(`id`),
	CONSTRAINT `web3_challenges_nonce_unique` UNIQUE(`nonce`)
);
--> statement-breakpoint
CREATE TABLE `web3_verifications` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`questId` int NOT NULL,
	`walletAddress` varchar(42) NOT NULL,
	`chainId` int NOT NULL,
	`contractAddress` varchar(42) NOT NULL,
	`verifiedBalance` varchar(160) NOT NULL,
	`requiredBalance` varchar(160) NOT NULL,
	`status` enum('verified','not_eligible','error') NOT NULL,
	`verificationData` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `web3_verifications_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `web3_challenges_user_idx` ON `web3_challenges` (`userId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `web3_verifications_user_quest_idx` ON `web3_verifications` (`userId`,`questId`,`createdAt`);