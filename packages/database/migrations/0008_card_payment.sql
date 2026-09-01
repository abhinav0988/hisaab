ALTER TABLE `credit_facilities` ADD `min_due_minor` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `credit_facilities` ADD `last_paid_on` text;--> statement-breakpoint
CREATE TABLE `credit_utilisation_months` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`month` text NOT NULL,
	`used_minor` integer DEFAULT 0 NOT NULL,
	`limit_minor` integer DEFAULT 0 NOT NULL,
	`overdue_minor` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT `credit_utilisation_amounts_non_negative` CHECK(`used_minor` >= 0 AND `limit_minor` >= 0 AND `overdue_minor` >= 0)
);--> statement-breakpoint
CREATE UNIQUE INDEX `credit_utilisation_user_month_unique` ON `credit_utilisation_months` (`user_id`,`month`);
