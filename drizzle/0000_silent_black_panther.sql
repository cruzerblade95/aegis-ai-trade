CREATE TABLE `admin_audit_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`actor_user_id` text,
	`action` text NOT NULL,
	`target_type` text NOT NULL,
	`target_id` text,
	`metadata_json` text DEFAULT '{}' NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`actor_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `admin_audit_actor_created_idx` ON `admin_audit_logs` (`actor_user_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `admin_audit_target_idx` ON `admin_audit_logs` (`target_type`,`target_id`);--> statement-breakpoint
CREATE TABLE `ai_explanation_history` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`market_symbol` text NOT NULL,
	`prompt` text NOT NULL,
	`explanation` text NOT NULL,
	`risk_level` text NOT NULL,
	`model` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `ai_history_user_created_idx` ON `ai_explanation_history` (`user_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `ai_history_market_idx` ON `ai_explanation_history` (`market_symbol`);--> statement-breakpoint
CREATE TABLE `auth_identities` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`provider` text NOT NULL,
	`provider_account_id` text NOT NULL,
	`last_signed_in_at` integer NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `auth_identity_provider_account_unique` ON `auth_identities` (`provider`,`provider_account_id`);--> statement-breakpoint
CREATE INDEX `auth_identities_user_idx` ON `auth_identities` (`user_id`);--> statement-breakpoint
CREATE TABLE `paper_trades` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`market_symbol` text NOT NULL,
	`side` text NOT NULL,
	`status` text DEFAULT 'open' NOT NULL,
	`quantity` text NOT NULL,
	`entry_price` text NOT NULL,
	`exit_price` text,
	`opened_at` integer NOT NULL,
	`closed_at` integer,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `paper_trades_user_status_idx` ON `paper_trades` (`user_id`,`status`);--> statement-breakpoint
CREATE INDEX `paper_trades_market_idx` ON `paper_trades` (`market_symbol`);--> statement-breakpoint
CREATE TABLE `plans` (
	`id` text PRIMARY KEY NOT NULL,
	`code` text NOT NULL,
	`name` text NOT NULL,
	`description` text NOT NULL,
	`monthly_virtual_credits` integer DEFAULT 0 NOT NULL,
	`price_minor` integer DEFAULT 0 NOT NULL,
	`currency` text DEFAULT 'USD' NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `plans_code_unique` ON `plans` (`code`);--> statement-breakpoint
CREATE INDEX `plans_active_idx` ON `plans` (`is_active`);--> statement-breakpoint
CREATE TABLE `subscriptions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`plan_id` text NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`started_at` integer NOT NULL,
	`ends_at` integer,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`plan_id`) REFERENCES `plans`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `subscriptions_active_user_unique` ON `subscriptions` (`user_id`);--> statement-breakpoint
CREATE INDEX `subscriptions_plan_idx` ON `subscriptions` (`plan_id`);--> statement-breakpoint
CREATE INDEX `subscriptions_status_idx` ON `subscriptions` (`status`);--> statement-breakpoint
CREATE TABLE `trade_journal_entries` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`paper_trade_id` text,
	`title` text NOT NULL,
	`thesis` text NOT NULL,
	`risk_notes` text NOT NULL,
	`reflection` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`paper_trade_id`) REFERENCES `paper_trades`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `trade_journal_user_created_idx` ON `trade_journal_entries` (`user_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `trade_journal_trade_idx` ON `trade_journal_entries` (`paper_trade_id`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`display_name` text NOT NULL,
	`role` text DEFAULT 'user' NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`email_verified_at` integer,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);--> statement-breakpoint
CREATE INDEX `users_role_idx` ON `users` (`role`);--> statement-breakpoint
CREATE INDEX `users_status_idx` ON `users` (`status`);--> statement-breakpoint
CREATE TABLE `virtual_ledger_entries` (
	`id` text PRIMARY KEY NOT NULL,
	`wallet_id` text NOT NULL,
	`type` text NOT NULL,
	`amount_minor` integer NOT NULL,
	`balance_after_minor` integer NOT NULL,
	`reference_id` text,
	`note` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`wallet_id`) REFERENCES `virtual_wallets`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `virtual_ledger_wallet_created_idx` ON `virtual_ledger_entries` (`wallet_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `virtual_ledger_reference_idx` ON `virtual_ledger_entries` (`reference_id`);--> statement-breakpoint
CREATE TABLE `virtual_wallets` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`currency` text DEFAULT 'USD' NOT NULL,
	`balance_minor` integer DEFAULT 10000000 NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `virtual_wallet_user_currency_unique` ON `virtual_wallets` (`user_id`,`currency`);