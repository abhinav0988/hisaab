ALTER TABLE `transactions` ADD `destination_account_id` text REFERENCES `accounts`(`id`) ON DELETE restrict;--> statement-breakpoint
CREATE INDEX `transactions_destination_account_idx` ON `transactions` (`destination_account_id`);
