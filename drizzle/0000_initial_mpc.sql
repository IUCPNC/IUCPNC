CREATE TABLE `employees` (
	`employee_id` text PRIMARY KEY NOT NULL,
	`account_user_id` text,
	`email` text NOT NULL,
	`employee_name` text NOT NULL,
	`position` text DEFAULT '' NOT NULL,
	`department` text DEFAULT '' NOT NULL,
	`appraiser` text DEFAULT '' NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `employees_account_user_id_unique` ON `employees` (`account_user_id`);
--> statement-breakpoint
CREATE UNIQUE INDEX `employees_email_unique` ON `employees` (`email`);
--> statement-breakpoint
CREATE INDEX `employees_department_idx` ON `employees` (`department`);
--> statement-breakpoint
CREATE TABLE `mpc_submissions` (
	`id` text PRIMARY KEY NOT NULL,
	`authenticated_user_id` text NOT NULL,
	`authenticated_email` text NOT NULL,
	`employee_id` text NOT NULL,
	`employee_name` text NOT NULL,
	`employee_email` text NOT NULL,
	`position` text DEFAULT '' NOT NULL,
	`department` text DEFAULT '' NOT NULL,
	`appraiser` text DEFAULT '' NOT NULL,
	`reporting_year` integer NOT NULL,
	`month` integer NOT NULL,
	`kpi_score` real,
	`values_rating` real,
	`cpd_rating` real,
	`social_rating` real,
	`overall_score` real,
	`performance_band` text NOT NULL,
	`check_in_status` text NOT NULL,
	`cpd_hours` real DEFAULT 0 NOT NULL,
	`social_links` integer DEFAULT 0 NOT NULL,
	`employee_acknowledgment` text NOT NULL,
	`appraiser_confirmation` text NOT NULL,
	`missing_components` text NOT NULL,
	`number_missing` integer NOT NULL,
	`score_below_299` integer DEFAULT false NOT NULL,
	`social_links_compliant` integer DEFAULT false NOT NULL,
	`employee_acknowledged` integer DEFAULT false NOT NULL,
	`rule_version` text DEFAULT '2026.1' NOT NULL,
	`payload_json` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`submitted_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `submission_employee_period_unique` ON `mpc_submissions` (`employee_id`,`reporting_year`,`month`);
--> statement-breakpoint
CREATE INDEX `submission_period_idx` ON `mpc_submissions` (`reporting_year`,`month`);
--> statement-breakpoint
CREATE INDEX `submission_department_idx` ON `mpc_submissions` (`department`);
--> statement-breakpoint
CREATE INDEX `submission_status_idx` ON `mpc_submissions` (`check_in_status`);
--> statement-breakpoint
CREATE TABLE `mpc_submission_events` (
	`id` text PRIMARY KEY NOT NULL,
	`submission_id` text NOT NULL,
	`actor_user_id` text NOT NULL,
	`actor_email` text NOT NULL,
	`event_type` text NOT NULL,
	`snapshot_json` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`submission_id`) REFERENCES `mpc_submissions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `submission_event_submission_idx` ON `mpc_submission_events` (`submission_id`);
--> statement-breakpoint
PRAGMA optimize;
