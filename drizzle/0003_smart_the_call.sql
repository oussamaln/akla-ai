ALTER TABLE `official_social_accounts` MODIFY COLUMN `platform` enum('x','telegram','discord','instagram','email') NOT NULL;--> statement-breakpoint
ALTER TABLE `social_accounts` MODIFY COLUMN `platform` enum('x','telegram','discord','instagram','email') NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `memberUid` varchar(20);--> statement-breakpoint
ALTER TABLE `users` ADD CONSTRAINT `users_member_uid_unique` UNIQUE(`memberUid`);