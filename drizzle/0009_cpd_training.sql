CREATE TABLE `cpd_activities` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`activity_type` text NOT NULL,
	`category` text NOT NULL,
	`scope` text NOT NULL,
	`provider` text NOT NULL,
	`venue` text NOT NULL,
	`delivery_mode` text NOT NULL,
	`starts_at` text NOT NULL,
	`ends_at` text NOT NULL,
	`duration_hours` real NOT NULL,
	`cpd_hours` real NOT NULL,
	`department` text NOT NULL,
	`target_group` text NOT NULL,
	`max_participants` integer,
	`mandatory` integer DEFAULT 0 NOT NULL,
	`certificate_provided` integer DEFAULT 0 NOT NULL,
	`description` text NOT NULL,
	`status` text DEFAULT 'Draft' NOT NULL,
	`qr_token` text,
	`qr_active` integer DEFAULT 0 NOT NULL,
	`created_by` text NOT NULL,
	`created_email` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);

--> statement-breakpoint
CREATE INDEX `cpd_activity_status_start` ON `cpd_activities` (`status`,`starts_at`);
--> statement-breakpoint
CREATE UNIQUE INDEX `cpd_activity_qr_token_unique` ON `cpd_activities` (`qr_token`);
--> statement-breakpoint
CREATE TABLE `cpd_attendance` (
	`id` text PRIMARY KEY NOT NULL,
	`activity_id` text NOT NULL,
	`employee_id` text NOT NULL,
	`attended_at` text NOT NULL,
	`credited_hours` real NOT NULL,
	`source` text NOT NULL,
	`created_by` text NOT NULL,
	`created_email` text NOT NULL,
	`voided_at` text,
	`voided_by` text,
	FOREIGN KEY (`activity_id`) REFERENCES `cpd_activities`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`employee_id`) REFERENCES `employees`(`employee_id`) ON UPDATE no action ON DELETE no action
);

--> statement-breakpoint
CREATE UNIQUE INDEX `cpd_attendance_activity_employee_unique` ON `cpd_attendance` (`activity_id`,`employee_id`);
--> statement-breakpoint
CREATE INDEX `cpd_attendance_employee_date` ON `cpd_attendance` (`employee_id`,`attended_at`);
--> statement-breakpoint
CREATE TABLE `cpd_audit` (
	`id` text PRIMARY KEY NOT NULL,
	`actor_id` text NOT NULL,
	`actor_email` text NOT NULL,
	`action` text NOT NULL,
	`activity_id` text,
	`request_id` text,
	`employee_id` text,
	`detail_json` text NOT NULL,
	`created_at` text NOT NULL
);

--> statement-breakpoint
CREATE INDEX `cpd_audit_created` ON `cpd_audit` (`created_at`);
--> statement-breakpoint
CREATE INDEX `cpd_audit_activity` ON `cpd_audit` (`activity_id`);
--> statement-breakpoint
CREATE INDEX `cpd_audit_request` ON `cpd_audit` (`request_id`);
--> statement-breakpoint
CREATE TABLE `cpd_credits` (
	`id` text PRIMARY KEY NOT NULL,
	`employee_id` text NOT NULL,
	`source_type` text NOT NULL,
	`source_id` text NOT NULL,
	`title` text NOT NULL,
	`provider` text NOT NULL,
	`attended_at` text NOT NULL,
	`hours` real NOT NULL,
	`category` text NOT NULL,
	`created_by` text NOT NULL,
	`created_email` text NOT NULL,
	`created_at` text NOT NULL,
	`voided_at` text,
	`voided_by` text,
	FOREIGN KEY (`employee_id`) REFERENCES `employees`(`employee_id`) ON UPDATE no action ON DELETE no action
);

--> statement-breakpoint
CREATE UNIQUE INDEX `cpd_credit_source_unique` ON `cpd_credits` (`employee_id`,`source_type`,`source_id`);
--> statement-breakpoint
CREATE INDEX `cpd_credit_employee_date` ON `cpd_credits` (`employee_id`,`attended_at`);
--> statement-breakpoint
CREATE TABLE `cpd_requests` (
	`id` text PRIMARY KEY NOT NULL,
	`employee_id` text NOT NULL,
	`activity_id` text,
	`title` text NOT NULL,
	`activity_type` text NOT NULL,
	`category` text NOT NULL,
	`scope` text NOT NULL,
	`provider` text NOT NULL,
	`venue` text NOT NULL,
	`delivery_mode` text NOT NULL,
	`starts_at` text NOT NULL,
	`ends_at` text NOT NULL,
	`estimated_hours` real NOT NULL,
	`fee` real DEFAULT 0 NOT NULL,
	`other_costs` real DEFAULT 0 NOT NULL,
	`funding_source` text NOT NULL,
	`purpose` text NOT NULL,
	`relevance` text NOT NULL,
	`justification` text NOT NULL,
	`attachment_id` text,
	`status` text NOT NULL,
	`supervisor_id` text,
	`decision_note` text DEFAULT '' NOT NULL,
	`completed_at` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`employee_id`) REFERENCES `employees`(`employee_id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`activity_id`) REFERENCES `cpd_activities`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`supervisor_id`) REFERENCES `employees`(`employee_id`) ON UPDATE no action ON DELETE no action
);

--> statement-breakpoint
CREATE INDEX `cpd_request_employee_status` ON `cpd_requests` (`employee_id`,`status`);
--> statement-breakpoint
CREATE INDEX `cpd_request_status_time` ON `cpd_requests` (`status`,`created_at`);
