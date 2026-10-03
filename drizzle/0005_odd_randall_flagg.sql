CREATE TABLE `web3_token_tasks` (
	`id` int AUTO_INCREMENT NOT NULL,
	`questId` int NOT NULL,
	`name` varchar(160) NOT NULL,
	`symbol` varchar(32) NOT NULL,
	`contractAddress` varchar(42) NOT NULL,
	`chainId` int NOT NULL,
	`decimals` int NOT NULL,
	`minimumBalance` varchar(160) NOT NULL,
	`rewardPoints` int NOT NULL,
	`description` text NOT NULL,
	`active` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `web3_token_tasks_id` PRIMARY KEY(`id`),
	CONSTRAINT `web3_token_tasks_quest_unique` UNIQUE(`questId`),
	CONSTRAINT `web3_token_tasks_contract_chain_unique` UNIQUE(`contractAddress`,`chainId`)
);
--> statement-breakpoint
CREATE INDEX `web3_token_tasks_active_idx` ON `web3_token_tasks` (`active`,`createdAt`);