ALTER TABLE `user_preferences` ADD `language` text DEFAULT 'en' NOT NULL;--> statement-breakpoint
ALTER TABLE `user_preferences` ADD `profile_note` text;--> statement-breakpoint
ALTER TABLE `user_preferences` ADD `smart_notifications` integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `user_preferences` ADD `weekly_summary` integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `user_preferences` ADD `app_lock_enabled` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
CREATE TABLE `subscriptions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`plan` text DEFAULT 'free' NOT NULL,
	`status` text DEFAULT 'inactive' NOT NULL,
	`billing_interval` text,
	`currency` text DEFAULT 'INR' NOT NULL,
	`amount_minor` integer,
	`trial_ends_at` text,
	`current_period_ends_at` text,
	`canceled_at` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);--> statement-breakpoint
CREATE UNIQUE INDEX `subscriptions_user_id_unique` ON `subscriptions` (`user_id`);--> statement-breakpoint
CREATE INDEX `subscriptions_status_idx` ON `subscriptions` (`status`);--> statement-breakpoint
CREATE TABLE `savings_goals` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`icon` text DEFAULT '*' NOT NULL,
	`target_amount_minor` integer NOT NULL,
	`saved_amount_minor` integer DEFAULT 0 NOT NULL,
	`currency` text NOT NULL,
	`target_date` text,
	`notes` text,
	`is_active` integer DEFAULT 1 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT `savings_goal_target_positive` CHECK(`target_amount_minor` > 0),
	CONSTRAINT `savings_goal_saved_non_negative` CHECK(`saved_amount_minor` >= 0)
);--> statement-breakpoint
CREATE INDEX `savings_goals_user_idx` ON `savings_goals` (`user_id`);--> statement-breakpoint
CREATE TABLE `goal_contributions` (
	`id` text PRIMARY KEY NOT NULL,
	`goal_id` text NOT NULL,
	`user_id` text NOT NULL,
	`amount_minor` integer NOT NULL,
	`source` text DEFAULT 'MANUAL' NOT NULL,
	`notes` text,
	`contributed_at` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`goal_id`) REFERENCES `savings_goals`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT `goal_contribution_positive` CHECK(`amount_minor` > 0)
);--> statement-breakpoint
CREATE INDEX `goal_contributions_goal_idx` ON `goal_contributions` (`goal_id`,`contributed_at`);--> statement-breakpoint
CREATE TABLE `in_app_notifications` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`type` text NOT NULL,
	`title` text NOT NULL,
	`body` text NOT NULL,
	`read_at` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);--> statement-breakpoint
CREATE INDEX `in_app_notifications_user_idx` ON `in_app_notifications` (`user_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `receipts` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`transaction_id` text,
	`storage_key` text NOT NULL,
	`status` text DEFAULT 'PENDING' NOT NULL,
	`merchant` text,
	`amount_minor` integer,
	`extracted_json` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`transaction_id`) REFERENCES `transactions`(`id`) ON UPDATE no action ON DELETE set null
);--> statement-breakpoint
CREATE INDEX `receipts_user_idx` ON `receipts` (`user_id`,`created_at`);
