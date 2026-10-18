-- Local-only subcategory support: optional parent category for hierarchical organization.
ALTER TABLE `categories` ADD COLUMN `parent_id` text REFERENCES `categories`(`id`) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS `categories_parent_idx` ON `categories` (`parent_id`);
