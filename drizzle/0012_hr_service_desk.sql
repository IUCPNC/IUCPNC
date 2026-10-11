CREATE TABLE `hr_service_events` (
	`id` text PRIMARY KEY NOT NULL,
	`request_id` text NOT NULL,
	`actor_id` text NOT NULL,
	`actor_email` text NOT NULL,
	`actor_role` text NOT NULL,
	`event_type` text NOT NULL,
	`message` text DEFAULT '' NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`request_id`) REFERENCES `hr_service_requests`(`id`) ON UPDATE no action ON DELETE no action
);

--> statement-breakpoint
CREATE INDEX `hr_service_event_request_idx` ON `hr_service_events` (`request_id`,`created_at`);
--> statement-breakpoint
CREATE TABLE `hr_service_files` (
	`id` text PRIMARY KEY NOT NULL,
	`request_id` text NOT NULL,
	`original_filename` text NOT NULL,
	`mime_type` text NOT NULL,
	`bytes` integer NOT NULL,
	`sha256` text NOT NULL,
	`storage_key` text NOT NULL,
	`uploaded_by` text NOT NULL,
	`created_at` text NOT NULL,
	`removed_at` text,
	FOREIGN KEY (`request_id`) REFERENCES `hr_service_requests`(`id`) ON UPDATE no action ON DELETE no action
);

--> statement-breakpoint
CREATE INDEX `hr_service_file_request_idx` ON `hr_service_files` (`request_id`);
--> statement-breakpoint
CREATE TABLE `hr_service_requests` (
	`id` text PRIMARY KEY NOT NULL,
	`reference` text NOT NULL,
	`employee_id` text NOT NULL,
	`created_by` text NOT NULL,
	`request_type` text NOT NULL,
	`subject` text NOT NULL,
	`details` text NOT NULL,
	`recipient` text DEFAULT '' NOT NULL,
	`needed_by` text,
	`status` text DEFAULT 'Submitted' NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`draft_reply` text DEFAULT '' NOT NULL,
	`internal_notes` text DEFAULT '' NOT NULL,
	`approved_by` text,
	`approved_at` text,
	`issued_by` text,
	`issued_at` text,
	`last_operation` text NOT NULL,
	`submission_key` text NOT NULL,
	`submission_hash` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`employee_id`) REFERENCES `employees`(`employee_id`) ON UPDATE no action ON DELETE no action
);

--> statement-breakpoint
CREATE UNIQUE INDEX `hr_service_reference_unique` ON `hr_service_requests` (`reference`);
--> statement-breakpoint
CREATE UNIQUE INDEX `hr_service_submission_unique` ON `hr_service_requests` (`employee_id`,`submission_key`);
--> statement-breakpoint
CREATE INDEX `hr_service_employee_idx` ON `hr_service_requests` (`employee_id`,`created_at`);
--> statement-breakpoint
CREATE INDEX `hr_service_status_idx` ON `hr_service_requests` (`status`,`updated_at`);
