CREATE TABLE `sheet_sync_records` (
	`key` text PRIMARY KEY NOT NULL,
	`base_json` text,
	`site_json` text,
	`sheet_json` text,
	`issue` text,
	`resolution` text,
	`resolved_by` text,
	`updated_at` text NOT NULL
);

--> statement-breakpoint
CREATE TABLE `sheet_sync_runs` (
	`id` text PRIMARY KEY NOT NULL,
	`started_at` text NOT NULL,
	`finished_at` text,
	`status` text NOT NULL,
	`counts_json` text,
	`error` text,
	`actor` text NOT NULL
);

--> statement-breakpoint
CREATE TABLE `sheet_sync_state` (
	`id` text PRIMARY KEY NOT NULL,
	`enabled` integer DEFAULT 0 NOT NULL,
	`lease_id` text,
	`lease_until` integer DEFAULT 0 NOT NULL,
	`last_attempt` text,
	`last_success` text,
	`runner_seen` text,
	`last_error` text,
	`failures` integer DEFAULT 0 NOT NULL,
	`next_attempt` integer DEFAULT 0 NOT NULL,
	`updated_by` text
);

