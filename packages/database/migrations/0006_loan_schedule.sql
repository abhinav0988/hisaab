ALTER TABLE `loans` ADD `principal_minor` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `loans` ADD `total_emis` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `loans` ADD `emi_day` integer DEFAULT 1 NOT NULL;
