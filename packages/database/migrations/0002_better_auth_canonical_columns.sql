ALTER TABLE `user` RENAME COLUMN `email_verified` TO `emailVerified`;
--> statement-breakpoint
ALTER TABLE `user` RENAME COLUMN `created_at` TO `createdAt`;
--> statement-breakpoint
ALTER TABLE `user` RENAME COLUMN `updated_at` TO `updatedAt`;
--> statement-breakpoint
ALTER TABLE `session` RENAME COLUMN `expires_at` TO `expiresAt`;
--> statement-breakpoint
ALTER TABLE `session` RENAME COLUMN `ip_address` TO `ipAddress`;
--> statement-breakpoint
ALTER TABLE `session` RENAME COLUMN `user_agent` TO `userAgent`;
--> statement-breakpoint
ALTER TABLE `session` RENAME COLUMN `user_id` TO `userId`;
--> statement-breakpoint
ALTER TABLE `session` RENAME COLUMN `created_at` TO `createdAt`;
--> statement-breakpoint
ALTER TABLE `session` RENAME COLUMN `updated_at` TO `updatedAt`;
--> statement-breakpoint
ALTER TABLE `account` RENAME COLUMN `account_id` TO `accountId`;
--> statement-breakpoint
ALTER TABLE `account` RENAME COLUMN `provider_id` TO `providerId`;
--> statement-breakpoint
ALTER TABLE `account` RENAME COLUMN `user_id` TO `userId`;
--> statement-breakpoint
ALTER TABLE `account` RENAME COLUMN `access_token` TO `accessToken`;
--> statement-breakpoint
ALTER TABLE `account` RENAME COLUMN `refresh_token` TO `refreshToken`;
--> statement-breakpoint
ALTER TABLE `account` RENAME COLUMN `id_token` TO `idToken`;
--> statement-breakpoint
ALTER TABLE `account` RENAME COLUMN `access_token_expires_at` TO `accessTokenExpiresAt`;
--> statement-breakpoint
ALTER TABLE `account` RENAME COLUMN `refresh_token_expires_at` TO `refreshTokenExpiresAt`;
--> statement-breakpoint
ALTER TABLE `account` RENAME COLUMN `created_at` TO `createdAt`;
--> statement-breakpoint
ALTER TABLE `account` RENAME COLUMN `updated_at` TO `updatedAt`;
--> statement-breakpoint
ALTER TABLE `verification` RENAME COLUMN `expires_at` TO `expiresAt`;
--> statement-breakpoint
ALTER TABLE `verification` RENAME COLUMN `created_at` TO `createdAt`;
--> statement-breakpoint
ALTER TABLE `verification` RENAME COLUMN `updated_at` TO `updatedAt`;
