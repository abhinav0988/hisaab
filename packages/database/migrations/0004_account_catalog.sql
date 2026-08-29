CREATE TABLE `account_catalog` (
	`id` text PRIMARY KEY NOT NULL,
	`type` text NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`is_active` integer DEFAULT 1 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);--> statement-breakpoint
CREATE UNIQUE INDEX `account_catalog_type_unique` ON `account_catalog` (`type`);--> statement-breakpoint
INSERT INTO `account_catalog` (`id`,`type`,`name`,`description`,`sort_order`,`is_active`,`created_at`,`updated_at`) VALUES
	('catalog-cash','CASH','Cash','Physical cash and day-to-day notes',1,1,datetime('now'),datetime('now')),
	('catalog-bank','BANK','Bank','Savings or current bank account',2,1,datetime('now'),datetime('now')),
	('catalog-upi','UPI','UPI','UPI apps and linked bank handles',3,1,datetime('now'),datetime('now')),
	('catalog-wallet','MOBILE_WALLET','Wallet','Mobile wallets and prepaid balances',4,1,datetime('now'),datetime('now')),
	('catalog-credit','CREDIT_CARD','Credit card','Credit card spending',5,1,datetime('now'),datetime('now')),
	('catalog-debit','DEBIT_CARD','Debit card','Debit card linked to your bank',6,1,datetime('now'),datetime('now'));--> statement-breakpoint
ALTER TABLE `accounts` ADD `catalog_id` text REFERENCES `account_catalog`(`id`) ON DELETE set null;--> statement-breakpoint
CREATE UNIQUE INDEX `accounts_user_catalog_unique` ON `accounts` (`user_id`,`catalog_id`) WHERE `catalog_id` IS NOT NULL;
