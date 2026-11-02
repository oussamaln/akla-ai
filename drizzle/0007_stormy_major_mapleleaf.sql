CREATE TABLE `project_token_payments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`agentId` int NOT NULL,
	`walletAddress` varchar(42) NOT NULL,
	`tokenAddress` varchar(42) NOT NULL,
	`treasuryAddress` varchar(42) NOT NULL,
	`chainId` int NOT NULL,
	`decimals` int NOT NULL,
	`amountRaw` varchar(160) NOT NULL,
	`transactionHash` varchar(128) NOT NULL,
	`blockNumber` varchar(64),
	`status` enum('submitted','verified','used') NOT NULL DEFAULT 'submitted',
	`failureReason` varchar(512),
	`verifiedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `project_token_payments_id` PRIMARY KEY(`id`),
	CONSTRAINT `project_token_payments_tx_unique` UNIQUE(`transactionHash`)
);
--> statement-breakpoint
ALTER TABLE `agent_messages` ADD `walletAddress` varchar(42);--> statement-breakpoint
ALTER TABLE `agent_messages` ADD `paymentId` int;--> statement-breakpoint
CREATE INDEX `project_token_payments_user_created_idx` ON `project_token_payments` (`userId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `project_token_payments_agent_created_idx` ON `project_token_payments` (`agentId`,`createdAt`);