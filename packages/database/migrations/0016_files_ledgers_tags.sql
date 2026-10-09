ALTER TABLE `tags` ADD `normalized_name` text NOT NULL DEFAULT '';--> statement-breakpoint
UPDATE `tags` SET `normalized_name` = lower(trim(`name`)) WHERE `normalized_name` = '';--> statement-breakpoint
DELETE FROM `transaction_tags` WHERE `tag_id` IN (SELECT `id` FROM `tags` WHERE `rowid` NOT IN (SELECT MIN(`rowid`) FROM `tags` GROUP BY `user_id`, `normalized_name`));--> statement-breakpoint
DELETE FROM `tags` WHERE `rowid` NOT IN (SELECT MIN(`rowid`) FROM `tags` GROUP BY `user_id`, `normalized_name`);--> statement-breakpoint
CREATE UNIQUE INDEX `tags_user_normalized_unique` ON `tags` (`user_id`,`normalized_name`);--> statement-breakpoint
CREATE TABLE `stored_files` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`storage_key` text NOT NULL,
	`original_name` text NOT NULL,
	`mime_type` text NOT NULL,
	`size_bytes` integer NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT `stored_files_size_positive` CHECK(`size_bytes` > 0)
);--> statement-breakpoint
CREATE UNIQUE INDEX `stored_files_key_unique` ON `stored_files` (`storage_key`);--> statement-breakpoint
CREATE INDEX `stored_files_user_idx` ON `stored_files` (`user_id`);--> statement-breakpoint
CREATE TABLE `transaction_attachments` (
	`id` text PRIMARY KEY NOT NULL,
	`transaction_id` text NOT NULL,
	`file_id` text NOT NULL,
	`user_id` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`transaction_id`) REFERENCES `transactions`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`file_id`) REFERENCES `stored_files`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);--> statement-breakpoint
CREATE UNIQUE INDEX `transaction_attachments_tx_file_unique` ON `transaction_attachments` (`transaction_id`,`file_id`);--> statement-breakpoint
CREATE INDEX `transaction_attachments_user_idx` ON `transaction_attachments` (`user_id`);--> statement-breakpoint
ALTER TABLE `split_receipts` ADD `file_id` text REFERENCES `stored_files`(`id`);--> statement-breakpoint
ALTER TABLE `split_receipts` ADD `description` text;--> statement-breakpoint
CREATE TABLE `lend_repayments` (
	`id` text PRIMARY KEY NOT NULL,
	`lend_record_id` text NOT NULL,
	`user_id` text NOT NULL,
	`amount_minor` integer NOT NULL,
	`paid_at` text NOT NULL,
	`note` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`lend_record_id`) REFERENCES `lend_records`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT `lend_repayments_amount_positive` CHECK(`amount_minor` > 0)
);--> statement-breakpoint
CREATE INDEX `lend_repayments_record_idx` ON `lend_repayments` (`lend_record_id`);--> statement-breakpoint
CREATE TABLE `loan_payments` (
	`id` text PRIMARY KEY NOT NULL,
	`loan_id` text NOT NULL,
	`user_id` text NOT NULL,
	`installment_number` integer,
	`amount_minor` integer NOT NULL,
	`paid_at` text NOT NULL,
	`payment_type` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`loan_id`) REFERENCES `loans`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT `loan_payments_amount_positive` CHECK(`amount_minor` > 0),
	CONSTRAINT `loan_payments_type_valid` CHECK(`payment_type` IN ('EMI'))
);--> statement-breakpoint
CREATE INDEX `loan_payments_loan_idx` ON `loan_payments` (`loan_id`);--> statement-breakpoint
CREATE TABLE `facility_payments` (
	`id` text PRIMARY KEY NOT NULL,
	`credit_facility_id` text NOT NULL,
	`user_id` text NOT NULL,
	`amount_minor` integer NOT NULL,
	`paid_at` text NOT NULL,
	`statement_period` text,
	`kind` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`credit_facility_id`) REFERENCES `credit_facilities`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT `facility_payments_amount_positive` CHECK(`amount_minor` > 0),
	CONSTRAINT `facility_payments_kind_valid` CHECK(`kind` IN ('CARD', 'UPI'))
);--> statement-breakpoint
CREATE INDEX `facility_payments_facility_idx` ON `facility_payments` (`credit_facility_id`);--> statement-breakpoint
CREATE TABLE `idempotency_keys` (
	`user_id` text NOT NULL,
	`scope` text NOT NULL,
	`key` text NOT NULL,
	`response_json` text NOT NULL,
	`created_at` text NOT NULL,
	PRIMARY KEY(`user_id`, `scope`, `key`)
);
