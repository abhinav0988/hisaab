CREATE TABLE `split_people` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`full_name` text NOT NULL,
	`phone` text,
	`country_code` text DEFAULT 'IN',
	`email` text,
	`relationship` text DEFAULT 'friend' NOT NULL,
	`photo_url` text,
	`is_self` integer DEFAULT false NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT `split_people_relationship_valid` CHECK(`relationship` IN ('friend', 'family', 'colleague', 'other'))
);
--> statement-breakpoint
CREATE INDEX `split_people_user_idx` ON `split_people` (`user_id`);
--> statement-breakpoint
CREATE TABLE `split_groups` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`category` text,
	`image_url` text,
	`group_type` text DEFAULT 'shared' NOT NULL,
	`currency` text DEFAULT 'INR' NOT NULL,
	`default_split_method` text DEFAULT 'equal' NOT NULL,
	`default_due_days` integer DEFAULT 7 NOT NULL,
	`allow_member_add` integer DEFAULT true NOT NULL,
	`allow_member_edit` integer DEFAULT true NOT NULL,
	`allow_member_settle` integer DEFAULT true NOT NULL,
	`send_notifications` integer DEFAULT true NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`owner_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT `split_groups_type_valid` CHECK(`group_type` IN ('shared', 'personal')),
	CONSTRAINT `split_groups_method_valid` CHECK(`default_split_method` IN ('equal', 'exact', 'percentage', 'shares', 'itemwise'))
);
--> statement-breakpoint
CREATE INDEX `split_groups_owner_idx` ON `split_groups` (`owner_id`);
--> statement-breakpoint
CREATE TABLE `split_group_members` (
	`id` text PRIMARY KEY NOT NULL,
	`group_id` text NOT NULL,
	`person_id` text NOT NULL,
	`role` text DEFAULT 'member' NOT NULL,
	`joined_at` text NOT NULL,
	FOREIGN KEY (`group_id`) REFERENCES `split_groups`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`person_id`) REFERENCES `split_people`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `split_group_members_unique` ON `split_group_members` (`group_id`,`person_id`);
--> statement-breakpoint
CREATE INDEX `split_group_members_group_idx` ON `split_group_members` (`group_id`);
--> statement-breakpoint
CREATE TABLE `split_expenses` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`category` text NOT NULL,
	`total_amount_minor` integer NOT NULL,
	`currency` text DEFAULT 'INR' NOT NULL,
	`expense_date` text NOT NULL,
	`expense_time` text,
	`group_id` text,
	`split_method` text DEFAULT 'equal' NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`due_date` text,
	`note_for_participants` text,
	`allow_partial_payments` integer DEFAULT true NOT NULL,
	`send_notifications` integer DEFAULT true NOT NULL,
	`is_draft` integer DEFAULT false NOT NULL,
	`receipt_id` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`group_id`) REFERENCES `split_groups`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT `split_expenses_amount_positive` CHECK(`total_amount_minor` > 0),
	CONSTRAINT `split_expenses_method_valid` CHECK(`split_method` IN ('equal', 'exact', 'percentage', 'shares', 'itemwise')),
	CONSTRAINT `split_expenses_status_valid` CHECK(`status` IN ('draft', 'pending', 'partially_paid', 'partially_settled', 'almost_settled', 'settled', 'overdue', 'overpaid', 'cancelled'))
);
--> statement-breakpoint
CREATE INDEX `split_expenses_user_idx` ON `split_expenses` (`user_id`);
--> statement-breakpoint
CREATE INDEX `split_expenses_status_idx` ON `split_expenses` (`user_id`,`status`);
--> statement-breakpoint
CREATE TABLE `split_expense_payers` (
	`id` text PRIMARY KEY NOT NULL,
	`expense_id` text NOT NULL,
	`person_id` text NOT NULL,
	`paid_amount_minor` integer NOT NULL,
	FOREIGN KEY (`expense_id`) REFERENCES `split_expenses`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`person_id`) REFERENCES `split_people`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT `split_expense_payers_amount_positive` CHECK(`paid_amount_minor` > 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `split_expense_payers_unique` ON `split_expense_payers` (`expense_id`,`person_id`);
--> statement-breakpoint
CREATE INDEX `split_expense_payers_expense_idx` ON `split_expense_payers` (`expense_id`);
--> statement-breakpoint
CREATE TABLE `split_participants` (
	`id` text PRIMARY KEY NOT NULL,
	`expense_id` text NOT NULL,
	`person_id` text NOT NULL,
	`share_percentage_bps` integer DEFAULT 0 NOT NULL,
	`share_value` integer DEFAULT 1 NOT NULL,
	`share_amount_minor` integer NOT NULL,
	`adjusted_share_amount_minor` integer NOT NULL,
	`paid_amount_minor` integer DEFAULT 0 NOT NULL,
	`pending_amount_minor` integer DEFAULT 0 NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	FOREIGN KEY (`expense_id`) REFERENCES `split_expenses`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`person_id`) REFERENCES `split_people`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT `split_participants_status_valid` CHECK(`status` IN ('pending', 'partially_paid', 'paid', 'overpaid', 'waived'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `split_participants_unique` ON `split_participants` (`expense_id`,`person_id`);
--> statement-breakpoint
CREATE INDEX `split_participants_expense_idx` ON `split_participants` (`expense_id`);
--> statement-breakpoint
CREATE TABLE `split_payments` (
	`id` text PRIMARY KEY NOT NULL,
	`expense_id` text NOT NULL,
	`participant_id` text NOT NULL,
	`payer_person_id` text NOT NULL,
	`receiver_person_id` text NOT NULL,
	`amount_minor` integer NOT NULL,
	`method` text DEFAULT 'upi' NOT NULL,
	`reference_id` text,
	`note` text,
	`proof_url` text,
	`payment_date` text NOT NULL,
	`status` text DEFAULT 'completed' NOT NULL,
	`is_final_settlement` integer DEFAULT false NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`expense_id`) REFERENCES `split_expenses`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`participant_id`) REFERENCES `split_participants`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`payer_person_id`) REFERENCES `split_people`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`receiver_person_id`) REFERENCES `split_people`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT `split_payments_amount_positive` CHECK(`amount_minor` > 0),
	CONSTRAINT `split_payments_method_valid` CHECK(`method` IN ('upi', 'cash', 'bank_transfer', 'card', 'other')),
	CONSTRAINT `split_payments_status_valid` CHECK(`status` IN ('completed', 'voided'))
);
--> statement-breakpoint
CREATE INDEX `split_payments_expense_idx` ON `split_payments` (`expense_id`);
--> statement-breakpoint
CREATE INDEX `split_payments_participant_idx` ON `split_payments` (`participant_id`);
--> statement-breakpoint
CREATE TABLE `split_adjustments` (
	`id` text PRIMARY KEY NOT NULL,
	`expense_id` text NOT NULL,
	`participant_id` text NOT NULL,
	`amount_minor` integer NOT NULL,
	`type` text NOT NULL,
	`reason` text,
	`created_by` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`expense_id`) REFERENCES `split_expenses`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`participant_id`) REFERENCES `split_participants`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`created_by`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT `split_adjustments_type_valid` CHECK(`type` IN ('discount', 'waived', 'correction', 'refund', 'other'))
);
--> statement-breakpoint
CREATE INDEX `split_adjustments_expense_idx` ON `split_adjustments` (`expense_id`);
--> statement-breakpoint
CREATE TABLE `split_reminders` (
	`id` text PRIMARY KEY NOT NULL,
	`expense_id` text NOT NULL,
	`participant_id` text,
	`channel` text NOT NULL,
	`scheduled_at` text NOT NULL,
	`frequency` text,
	`status` text DEFAULT 'scheduled' NOT NULL,
	`message` text,
	`sent_at` text,
	`stop_after_settlement` integer DEFAULT true NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`expense_id`) REFERENCES `split_expenses`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`participant_id`) REFERENCES `split_participants`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT `split_reminders_channel_valid` CHECK(`channel` IN ('in_app', 'email', 'whatsapp', 'sms')),
	CONSTRAINT `split_reminders_status_valid` CHECK(`status` IN ('scheduled', 'sent', 'cancelled', 'failed'))
);
--> statement-breakpoint
CREATE INDEX `split_reminders_expense_idx` ON `split_reminders` (`expense_id`);
--> statement-breakpoint
CREATE TABLE `split_receipts` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`expense_id` text,
	`file_url` text NOT NULL,
	`file_name` text,
	`mime_type` text,
	`file_size_bytes` integer,
	`merchant` text,
	`receipt_date` text,
	`subtotal_minor` integer,
	`tax_minor` integer,
	`total_minor` integer,
	`ocr_status` text DEFAULT 'pending' NOT NULL,
	`ocr_payload` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`expense_id`) REFERENCES `split_expenses`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT `split_receipts_ocr_status_valid` CHECK(`ocr_status` IN ('pending', 'processing', 'extracted', 'failed', 'manual'))
);
--> statement-breakpoint
CREATE INDEX `split_receipts_user_idx` ON `split_receipts` (`user_id`);
--> statement-breakpoint
CREATE TABLE `split_items` (
	`id` text PRIMARY KEY NOT NULL,
	`expense_id` text NOT NULL,
	`name` text NOT NULL,
	`quantity` integer DEFAULT 1 NOT NULL,
	`price_minor` integer NOT NULL,
	`kind` text DEFAULT 'item' NOT NULL,
	FOREIGN KEY (`expense_id`) REFERENCES `split_expenses`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT `split_items_kind_valid` CHECK(`kind` IN ('item', 'tax', 'tip')),
	CONSTRAINT `split_items_price_non_negative` CHECK(`price_minor` >= 0)
);
--> statement-breakpoint
CREATE INDEX `split_items_expense_idx` ON `split_items` (`expense_id`);
--> statement-breakpoint
CREATE TABLE `split_item_participants` (
	`id` text PRIMARY KEY NOT NULL,
	`item_id` text NOT NULL,
	`person_id` text NOT NULL,
	FOREIGN KEY (`item_id`) REFERENCES `split_items`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`person_id`) REFERENCES `split_people`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `split_item_participants_unique` ON `split_item_participants` (`item_id`,`person_id`);
--> statement-breakpoint
CREATE TABLE `split_activities` (
	`id` text PRIMARY KEY NOT NULL,
	`expense_id` text,
	`group_id` text,
	`user_id` text NOT NULL,
	`actor_person_id` text,
	`action` text NOT NULL,
	`metadata` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`expense_id`) REFERENCES `split_expenses`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`group_id`) REFERENCES `split_groups`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`actor_person_id`) REFERENCES `split_people`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `split_activities_expense_idx` ON `split_activities` (`expense_id`);
--> statement-breakpoint
CREATE INDEX `split_activities_user_idx` ON `split_activities` (`user_id`);
--> statement-breakpoint
CREATE TABLE `split_settlement_suggestions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`from_person_id` text NOT NULL,
	`to_person_id` text NOT NULL,
	`amount_minor` integer NOT NULL,
	`currency` text DEFAULT 'INR' NOT NULL,
	`status` text DEFAULT 'suggested' NOT NULL,
	`metadata` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`from_person_id`) REFERENCES `split_people`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`to_person_id`) REFERENCES `split_people`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT `split_settlement_suggestions_amount_positive` CHECK(`amount_minor` > 0)
);
--> statement-breakpoint
CREATE INDEX `split_settlement_suggestions_user_idx` ON `split_settlement_suggestions` (`user_id`);
