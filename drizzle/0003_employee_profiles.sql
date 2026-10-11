CREATE TABLE `employee_profile_sections` (
	`employee_id` text NOT NULL,
	`section` text NOT NULL,
	`data_json` text NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`updated_at` text NOT NULL,
	`updated_by` text NOT NULL,
	PRIMARY KEY(`employee_id`, `section`),
	FOREIGN KEY (`employee_id`) REFERENCES `employees`(`employee_id`) ON UPDATE no action ON DELETE no action
);

--> statement-breakpoint
CREATE TABLE `profile_audit` (
	`id` text PRIMARY KEY NOT NULL,
	`employee_id` text NOT NULL,
	`actor_id` text NOT NULL,
	`actor_email` text NOT NULL,
	`action` text NOT NULL,
	`section` text NOT NULL,
	`detail_json` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`employee_id`) REFERENCES `employees`(`employee_id`) ON UPDATE no action ON DELETE no action
);

--> statement-breakpoint
CREATE INDEX `profile_audit_employee_date` ON `profile_audit` (`employee_id`,`created_at`);
--> statement-breakpoint
CREATE TABLE `profile_documents` (
	`document_id` text PRIMARY KEY NOT NULL,
	`employee_id` text NOT NULL,
	`category` text NOT NULL,
	`visibility` text DEFAULT 'hr' NOT NULL,
	`bytes` integer NOT NULL,
	FOREIGN KEY (`document_id`) REFERENCES `document_assets`(`document_id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`employee_id`) REFERENCES `employees`(`employee_id`) ON UPDATE no action ON DELETE no action
);

--> statement-breakpoint
CREATE INDEX `profile_documents_employee` ON `profile_documents` (`employee_id`);
--> statement-breakpoint
CREATE TABLE `profile_revisions` (
	`id` text PRIMARY KEY NOT NULL,
	`employee_id` text NOT NULL,
	`section` text NOT NULL,
	`version` integer NOT NULL,
	`data_json` text NOT NULL,
	`created_at` text NOT NULL,
	`created_by` text NOT NULL,
	FOREIGN KEY (`employee_id`) REFERENCES `employees`(`employee_id`) ON UPDATE no action ON DELETE no action
);

--> statement-breakpoint
CREATE UNIQUE INDEX `profile_revision_unique` ON `profile_revisions` (`employee_id`,`section`,`version`);
