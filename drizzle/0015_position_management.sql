CREATE TABLE `position_acknowledgements` (
	`id` text PRIMARY KEY NOT NULL,
	`assignment_id` text NOT NULL,
	`document_id` text NOT NULL,
	`employee_id` text NOT NULL,
	`user_id` text NOT NULL,
	`acknowledged_at` text NOT NULL,
	`document_hash` text NOT NULL,
	`user_agent` text,
	`statement` text NOT NULL,
	FOREIGN KEY (`assignment_id`) REFERENCES `position_assignments`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`document_id`) REFERENCES `position_documents`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`employee_id`) REFERENCES `employees`(`employee_id`) ON UPDATE no action ON DELETE no action
);

--> statement-breakpoint
CREATE UNIQUE INDEX `position_ack_once` ON `position_acknowledgements` (`assignment_id`,`document_id`);
--> statement-breakpoint
CREATE TABLE `position_assignments` (
	`id` text PRIMARY KEY NOT NULL,
	`employee_id` text NOT NULL,
	`role_id` text NOT NULL,
	`is_primary` integer DEFAULT 0 NOT NULL,
	`start_date` text NOT NULL,
	`end_date` text,
	`status` text DEFAULT 'Assigned' NOT NULL,
	`visibility` text DEFAULT 'Internal' NOT NULL,
	`publish_card` integer DEFAULT 0 NOT NULL,
	`data_json` text DEFAULT '{}' NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`created_at` text NOT NULL,
	`created_by` text NOT NULL,
	FOREIGN KEY (`employee_id`) REFERENCES `employees`(`employee_id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`role_id`) REFERENCES `position_library`(`id`) ON UPDATE no action ON DELETE no action
);

--> statement-breakpoint
CREATE INDEX `position_assignment_employee` ON `position_assignments` (`employee_id`,`start_date`);
--> statement-breakpoint
CREATE INDEX `position_assignment_role` ON `position_assignments` (`role_id`,`status`);
--> statement-breakpoint
CREATE TABLE `position_audit` (
	`id` text PRIMARY KEY NOT NULL,
	`actor_id` text NOT NULL,
	`actor_email` text NOT NULL,
	`action` text NOT NULL,
	`entity_id` text NOT NULL,
	`employee_id` text,
	`before_json` text,
	`after_json` text,
	`created_at` text NOT NULL
);

--> statement-breakpoint
CREATE INDEX `position_audit_entity` ON `position_audit` (`entity_id`,`created_at`);
--> statement-breakpoint
CREATE TABLE `position_document_reads` (
	`id` text PRIMARY KEY NOT NULL,
	`document_id` text NOT NULL,
	`assignment_id` text NOT NULL,
	`user_id` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`document_id`) REFERENCES `position_documents`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`assignment_id`) REFERENCES `position_assignments`(`id`) ON UPDATE no action ON DELETE no action
);

--> statement-breakpoint
CREATE TABLE `position_documents` (
	`id` text PRIMARY KEY NOT NULL,
	`role_id` text NOT NULL,
	`version` integer NOT NULL,
	`kind` text NOT NULL,
	`title` text NOT NULL,
	`body_json` text NOT NULL,
	`status` text DEFAULT 'Draft' NOT NULL,
	`effective_date` text,
	`review_date` text,
	`expiry_date` text,
	`approved_by` text,
	`approved_at` text,
	`storage_key` text,
	`filename` text,
	`mime_type` text,
	`content_hash` text NOT NULL,
	`created_at` text NOT NULL,
	`created_by` text NOT NULL,
	FOREIGN KEY (`role_id`) REFERENCES `position_library`(`id`) ON UPDATE no action ON DELETE no action
);

--> statement-breakpoint
CREATE UNIQUE INDEX `position_document_version` ON `position_documents` (`role_id`,`version`);
--> statement-breakpoint
CREATE TABLE `position_entities` (
	`id` text PRIMARY KEY NOT NULL,
	`code` text NOT NULL,
	`name` text NOT NULL,
	`kind` text NOT NULL,
	`status` text DEFAULT 'Draft' NOT NULL,
	`data_json` text DEFAULT '{}' NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`updated_at` text NOT NULL,
	`updated_by` text NOT NULL
);

--> statement-breakpoint
CREATE UNIQUE INDEX `position_entities_code_unique` ON `position_entities` (`code`);
--> statement-breakpoint
CREATE TABLE `position_library` (
	`id` text PRIMARY KEY NOT NULL,
	`code` text NOT NULL,
	`title` text NOT NULL,
	`type` text NOT NULL,
	`department` text NOT NULL,
	`status` text DEFAULT 'Draft' NOT NULL,
	`data_json` text DEFAULT '{}' NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`updated_at` text NOT NULL,
	`updated_by` text NOT NULL
);

--> statement-breakpoint
CREATE UNIQUE INDEX `position_library_code_unique` ON `position_library` (`code`);
--> statement-breakpoint
CREATE INDEX `position_library_status` ON `position_library` (`status`,`department`);
--> statement-breakpoint
CREATE TABLE `position_notifications` (
	`id` text PRIMARY KEY NOT NULL,
	`employee_id` text NOT NULL,
	`assignment_id` text NOT NULL,
	`document_id` text,
	`kind` text NOT NULL,
	`message` text NOT NULL,
	`created_at` text NOT NULL,
	`read_at` text,
	FOREIGN KEY (`employee_id`) REFERENCES `employees`(`employee_id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`assignment_id`) REFERENCES `position_assignments`(`id`) ON UPDATE no action ON DELETE no action
);

--> statement-breakpoint
CREATE INDEX `position_notification_employee` ON `position_notifications` (`employee_id`,`created_at`);
--> statement-breakpoint
CREATE TABLE `position_settings` (
	`id` text PRIMARY KEY NOT NULL,
	`data_json` text NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`updated_at` text NOT NULL,
	`updated_by` text NOT NULL
);

--> statement-breakpoint
CREATE TABLE `position_types` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`active` integer DEFAULT 1 NOT NULL
);

--> statement-breakpoint
CREATE UNIQUE INDEX `position_types_name_unique` ON `position_types` (`name`);
