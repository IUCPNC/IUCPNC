CREATE TABLE `nadi_auth_accounts` (
	`id` text PRIMARY KEY NOT NULL,
	`employee_id` text,
	`email` text NOT NULL,
	`canonical_user_id` text NOT NULL,
	`password_hash` text NOT NULL,
	`enabled` integer DEFAULT 1 NOT NULL,
	`must_change` integer DEFAULT 1 NOT NULL,
	`temporary_expires` integer,
	`version` integer DEFAULT 1 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`employee_id`) REFERENCES `employees`(`employee_id`) ON UPDATE no action ON DELETE no action
);

--> statement-breakpoint
CREATE UNIQUE INDEX `nadi_auth_email_unique` ON `nadi_auth_accounts` (`email`);
--> statement-breakpoint
CREATE UNIQUE INDEX `nadi_auth_employee_unique` ON `nadi_auth_accounts` (`employee_id`);
--> statement-breakpoint
CREATE UNIQUE INDEX `nadi_auth_identity_unique` ON `nadi_auth_accounts` (`canonical_user_id`);
--> statement-breakpoint
CREATE TABLE `nadi_auth_audit` (
	`id` text PRIMARY KEY NOT NULL,
	`actor_id` text NOT NULL,
	`actor_email` text NOT NULL,
	`action` text NOT NULL,
	`account_id` text,
	`employee_id` text,
	`detail_json` text NOT NULL,
	`created_at` text NOT NULL
);

--> statement-breakpoint
CREATE INDEX `nadi_auth_audit_created` ON `nadi_auth_audit` (`created_at`);
--> statement-breakpoint
CREATE TABLE `nadi_auth_limits` (
	`bucket` text NOT NULL,
	`window_ms` integer NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`expires_ms` integer NOT NULL,
	PRIMARY KEY(`bucket`, `window_ms`)
);

--> statement-breakpoint
CREATE INDEX `nadi_auth_limits_expiry` ON `nadi_auth_limits` (`expires_ms`);
--> statement-breakpoint
CREATE TABLE `nadi_auth_settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL,
	`updated_by` text NOT NULL,
	`updated_at` text NOT NULL
);

--> statement-breakpoint
CREATE TABLE `nadi_calendar_cache` (
	`source` text NOT NULL,
	`month` text NOT NULL,
	`events_json` text NOT NULL,
	`updated_at` text NOT NULL,
	PRIMARY KEY(`source`, `month`)
);

--> statement-breakpoint
CREATE TABLE `nadi_auth_sessions` (
	`token_hash` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`account_version` integer NOT NULL,
	`created_ms` integer NOT NULL,
	`expires_ms` integer NOT NULL,
	`seen_ms` integer NOT NULL,
	FOREIGN KEY (`account_id`) REFERENCES `nadi_auth_accounts`(`id`) ON UPDATE no action ON DELETE no action
);

--> statement-breakpoint
CREATE INDEX `nadi_auth_sessions_account` ON `nadi_auth_sessions` (`account_id`);
--> statement-breakpoint
CREATE INDEX `nadi_auth_sessions_expiry` ON `nadi_auth_sessions` (`expires_ms`);
