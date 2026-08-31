CREATE TABLE `investments` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`type` text NOT NULL,
	`detail` text,
	`invested_minor` integer DEFAULT 0 NOT NULL,
	`current_minor` integer DEFAULT 0 NOT NULL,
	`sip_minor` integer DEFAULT 0 NOT NULL,
	`sip_day` text,
	`currency` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT `investment_amounts_non_negative` CHECK(`invested_minor` >= 0 AND `current_minor` >= 0 AND `sip_minor` >= 0)
);--> statement-breakpoint
CREATE INDEX `investments_user_idx` ON `investments` (`user_id`);--> statement-breakpoint
CREATE TABLE `ipo_applications` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`applied_on` text NOT NULL,
	`allotment_on` text,
	`amount_minor` integer NOT NULL,
	`lots` integer DEFAULT 1 NOT NULL,
	`status` text NOT NULL,
	`currency` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT `ipo_amount_positive` CHECK(`amount_minor` > 0),
	CONSTRAINT `ipo_lots_positive` CHECK(`lots` > 0)
);--> statement-breakpoint
CREATE INDEX `ipo_applications_user_idx` ON `ipo_applications` (`user_id`);--> statement-breakpoint
CREATE TABLE `loans` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`lender` text NOT NULL,
	`rate` text NOT NULL,
	`emi_minor` integer NOT NULL,
	`outstanding_minor` integer NOT NULL,
	`due_on` text NOT NULL,
	`remaining_emis` integer DEFAULT 0 NOT NULL,
	`progress` integer DEFAULT 0 NOT NULL,
	`currency` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT `loan_amounts_non_negative` CHECK(`emi_minor` >= 0 AND `outstanding_minor` >= 0),
	CONSTRAINT `loan_progress_range` CHECK(`progress` >= 0 AND `progress` <= 100),
	CONSTRAINT `loan_remaining_non_negative` CHECK(`remaining_emis` >= 0)
);--> statement-breakpoint
CREATE INDEX `loans_user_idx` ON `loans` (`user_id`);--> statement-breakpoint
CREATE TABLE `credit_facilities` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`kind` text NOT NULL,
	`name` text NOT NULL,
	`provider` text,
	`mask` text,
	`account_id` text,
	`limit_minor` integer DEFAULT 0 NOT NULL,
	`used_minor` integer DEFAULT 0 NOT NULL,
	`today_spend_minor` integer DEFAULT 0 NOT NULL,
	`overdue_minor` integer DEFAULT 0 NOT NULL,
	`due_on` text,
	`currency` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT `credit_kind_valid` CHECK(`kind` IN ('CARD', 'UPI')),
	CONSTRAINT `credit_amounts_non_negative` CHECK(`limit_minor` >= 0 AND `used_minor` >= 0 AND `today_spend_minor` >= 0 AND `overdue_minor` >= 0)
);--> statement-breakpoint
CREATE INDEX `credit_facilities_user_idx` ON `credit_facilities` (`user_id`,`kind`);--> statement-breakpoint
CREATE TABLE `lend_records` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`person` text NOT NULL,
	`relation` text,
	`kind` text NOT NULL,
	`amount_minor` integer NOT NULL,
	`given_on` text NOT NULL,
	`due_on` text NOT NULL,
	`status` text NOT NULL,
	`currency` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT `lend_kind_valid` CHECK(`kind` IN ('lent', 'borrowed')),
	CONSTRAINT `lend_status_valid` CHECK(`status` IN ('pending', 'due', 'settled')),
	CONSTRAINT `lend_amount_positive` CHECK(`amount_minor` > 0)
);--> statement-breakpoint
CREATE INDEX `lend_records_user_idx` ON `lend_records` (`user_id`);
