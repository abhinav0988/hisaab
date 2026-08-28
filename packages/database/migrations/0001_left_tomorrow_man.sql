CREATE TABLE `api_rate_limits` (
	`key` text NOT NULL,
	`bucket` integer NOT NULL,
	`count` integer DEFAULT 1 NOT NULL,
	`expires_at` text NOT NULL,
	PRIMARY KEY(`key`, `bucket`)
);
--> statement-breakpoint
CREATE INDEX `api_rate_limits_expiry_idx` ON `api_rate_limits` (`expires_at`);
--> statement-breakpoint
CREATE UNIQUE INDEX `budgets_overall_user_month_unique` ON `budgets` (`user_id`,`month`) WHERE `category_id` IS NULL;
--> statement-breakpoint
CREATE UNIQUE INDEX `categories_system_name_type_unique` ON `categories` (`name`,`type`) WHERE `user_id` IS NULL;
