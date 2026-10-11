CREATE TABLE `attendance_arrangements` (
	`id` text PRIMARY KEY NOT NULL,
	`employee_id` text NOT NULL,
	`context` text NOT NULL,
	`starts_at` text NOT NULL,
	`ends_at` text NOT NULL,
	`reason` text NOT NULL,
	`status` text NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`employee_id`) REFERENCES `employees`(`employee_id`) ON UPDATE no action ON DELETE no action
);

--> statement-breakpoint
CREATE INDEX `attendance_arrangement_employee` ON `attendance_arrangements` (`employee_id`,`starts_at`,`ends_at`);
--> statement-breakpoint
CREATE TABLE `attendance_config` (
	`id` text PRIMARY KEY NOT NULL,
	`data_json` text NOT NULL,
	`version` integer NOT NULL,
	`updated_at` text NOT NULL
);

--> statement-breakpoint
CREATE TABLE `attendance_corrections` (
	`id` text PRIMARY KEY NOT NULL,
	`employee_id` text NOT NULL,
	`session_id` text,
	`business_date` text NOT NULL,
	`proposal_json` text NOT NULL,
	`reason` text NOT NULL,
	`status` text NOT NULL,
	`decision_note` text DEFAULT '' NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`employee_id`) REFERENCES `employees`(`employee_id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`session_id`) REFERENCES `attendance_sessions`(`id`) ON UPDATE no action ON DELETE no action
);

--> statement-breakpoint
CREATE INDEX `attendance_correction_status` ON `attendance_corrections` (`status`,`created_at`);
--> statement-breakpoint
CREATE INDEX `attendance_correction_employee` ON `attendance_corrections` (`employee_id`,`business_date`);
--> statement-breakpoint
CREATE TABLE `attendance_events` (
	`id` text PRIMARY KEY NOT NULL,
	`employee_id` text NOT NULL,
	`session_id` text NOT NULL,
	`action` text NOT NULL,
	`occurred_at` text NOT NULL,
	`detail_json` text NOT NULL,
	FOREIGN KEY (`employee_id`) REFERENCES `employees`(`employee_id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`session_id`) REFERENCES `attendance_sessions`(`id`) ON UPDATE no action ON DELETE no action
);

--> statement-breakpoint
CREATE INDEX `attendance_event_session` ON `attendance_events` (`session_id`,`occurred_at`);
--> statement-breakpoint
CREATE INDEX `attendance_event_employee` ON `attendance_events` (`employee_id`,`occurred_at`);
--> statement-breakpoint
CREATE TABLE `attendance_notifications` (
	`id` text PRIMARY KEY NOT NULL,
	`employee_id` text NOT NULL,
	`message` text NOT NULL,
	`created_at` text NOT NULL,
	`read_at` text,
	FOREIGN KEY (`employee_id`) REFERENCES `employees`(`employee_id`) ON UPDATE no action ON DELETE no action
);

--> statement-breakpoint
CREATE INDEX `attendance_notification_employee` ON `attendance_notifications` (`employee_id`,`created_at`);
--> statement-breakpoint
CREATE TABLE `attendance_presence` (
	`id` text PRIMARY KEY NOT NULL,
	`employee_id` text NOT NULL,
	`session_id` text NOT NULL,
	`requested_at` text NOT NULL,
	`expires_at` text NOT NULL,
	`acknowledged_at` text,
	`photo_key` text,
	FOREIGN KEY (`employee_id`) REFERENCES `employees`(`employee_id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`session_id`) REFERENCES `attendance_sessions`(`id`) ON UPDATE no action ON DELETE no action
);

--> statement-breakpoint
CREATE INDEX `attendance_presence_employee` ON `attendance_presence` (`employee_id`,`requested_at`);
--> statement-breakpoint
CREATE TABLE `attendance_reports` (
	`id` text PRIMARY KEY NOT NULL,
	`period` text NOT NULL,
	`employee_id` text NOT NULL,
	`metrics_json` text NOT NULL,
	`approved_by` text NOT NULL,
	`approved_at` text NOT NULL,
	FOREIGN KEY (`employee_id`) REFERENCES `employees`(`employee_id`) ON UPDATE no action ON DELETE no action
);

--> statement-breakpoint
CREATE UNIQUE INDEX `attendance_report_employee_period` ON `attendance_reports` (`employee_id`,`period`);
--> statement-breakpoint
CREATE TABLE `attendance_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`employee_id` text NOT NULL,
	`business_date` text NOT NULL,
	`clock_in` text NOT NULL,
	`clock_out` text,
	`break_start` text,
	`break_seconds` integer DEFAULT 0 NOT NULL,
	`context` text NOT NULL,
	`rule_json` text NOT NULL,
	`flags_json` text DEFAULT '[]' NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`employee_id`) REFERENCES `employees`(`employee_id`) ON UPDATE no action ON DELETE no action
);

--> statement-breakpoint
CREATE UNIQUE INDEX `attendance_one_open` ON `attendance_sessions` (`employee_id`) WHERE clock_out IS NULL;
--> statement-breakpoint
CREATE INDEX `attendance_employee_date` ON `attendance_sessions` (`employee_id`,`business_date`);
--> statement-breakpoint
CREATE INDEX `attendance_date` ON `attendance_sessions` (`business_date`);
--> statement-breakpoint
CREATE TABLE `attendance_trace` (
	`id` text PRIMARY KEY NOT NULL,
	`employee_id` text NOT NULL,
	`session_id` text NOT NULL,
	`recorded_at` text NOT NULL,
	`active_seconds` integer DEFAULT 0 NOT NULL,
	`idle_seconds` integer DEFAULT 0 NOT NULL,
	`status` text NOT NULL,
	`task` text DEFAULT '' NOT NULL,
	FOREIGN KEY (`employee_id`) REFERENCES `employees`(`employee_id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`session_id`) REFERENCES `attendance_sessions`(`id`) ON UPDATE no action ON DELETE no action
);

--> statement-breakpoint
CREATE INDEX `attendance_trace_session` ON `attendance_trace` (`session_id`,`recorded_at`);
