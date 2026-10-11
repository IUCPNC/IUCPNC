CREATE TABLE `academic_allocations` (
	`id` text PRIMARY KEY NOT NULL,
	`offering_id` text NOT NULL,
	`employee_id` text NOT NULL,
	`student_group` text NOT NULL,
	`status` text DEFAULT 'Assigned' NOT NULL,
	`data_json` text NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`updated_at` text NOT NULL,
	`updated_by` text NOT NULL,
	FOREIGN KEY (`offering_id`) REFERENCES `academic_records`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`employee_id`) REFERENCES `employees`(`employee_id`) ON UPDATE no action ON DELETE no action
);

--> statement-breakpoint
CREATE UNIQUE INDEX `academic_allocation_unique` ON `academic_allocations` (`offering_id`,`employee_id`,`student_group`);
--> statement-breakpoint
CREATE INDEX `academic_allocation_employee` ON `academic_allocations` (`employee_id`,`status`);
--> statement-breakpoint
CREATE TABLE `academic_student_attendance` (
	`id` text PRIMARY KEY NOT NULL,
	`session_id` text NOT NULL,
	`roster_id` text NOT NULL,
	`status` text NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`updated_by` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`session_id`) REFERENCES `academic_sessions`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`roster_id`) REFERENCES `academic_rosters`(`id`) ON UPDATE no action ON DELETE no action
);

--> statement-breakpoint
CREATE UNIQUE INDEX `academic_attendance_session_student` ON `academic_student_attendance` (`session_id`,`roster_id`);
--> statement-breakpoint
CREATE TABLE `academic_atomic_checks` (
	`id` text PRIMARY KEY NOT NULL,
	`ok` integer NOT NULL,
	CONSTRAINT "academic_atomic_ok" CHECK("academic_atomic_checks"."ok"=1)
);

--> statement-breakpoint
CREATE TABLE `academic_delivery` (
	`session_id` text PRIMARY KEY NOT NULL,
	`employee_id` text NOT NULL,
	`started_at` text,
	`ended_at` text,
	`minutes` integer DEFAULT 0 NOT NULL,
	`remarks` text DEFAULT '' NOT NULL,
	`status` text NOT NULL,
	`verifier` text,
	`verified_at` text,
	`version` integer DEFAULT 1 NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`session_id`) REFERENCES `academic_sessions`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`employee_id`) REFERENCES `employees`(`employee_id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "academic_delivery_minutes" CHECK("academic_delivery"."minutes">=0 AND "academic_delivery"."minutes"<=1440)
);

--> statement-breakpoint
CREATE INDEX `academic_delivery_employee` ON `academic_delivery` (`employee_id`,`status`);
--> statement-breakpoint
CREATE TABLE `academic_document_links` (
	`document_id` text PRIMARY KEY NOT NULL,
	`resource_id` text NOT NULL,
	`employee_id` text NOT NULL,
	`programme_id` text NOT NULL,
	FOREIGN KEY (`document_id`) REFERENCES `document_assets`(`document_id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`employee_id`) REFERENCES `employees`(`employee_id`) ON UPDATE no action ON DELETE no action
);

--> statement-breakpoint
CREATE INDEX `academic_document_resource` ON `academic_document_links` (`resource_id`);
--> statement-breakpoint
CREATE TABLE `academic_evidence` (
	`id` text PRIMARY KEY NOT NULL,
	`employee_id` text NOT NULL,
	`programme_id` text NOT NULL,
	`source_id` text NOT NULL,
	`source_version` integer NOT NULL,
	`month` text NOT NULL,
	`category` text NOT NULL,
	`measured_value` text NOT NULL,
	`verification` text NOT NULL,
	`verified_at` text NOT NULL,
	`verifier` text NOT NULL,
	`kpi_reference` text,
	`sync_status` text NOT NULL,
	`data_json` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`employee_id`) REFERENCES `employees`(`employee_id`) ON UPDATE no action ON DELETE no action
);

--> statement-breakpoint
CREATE UNIQUE INDEX `academic_evidence_source` ON `academic_evidence` (`source_id`,`category`);
--> statement-breakpoint
CREATE INDEX `academic_evidence_month` ON `academic_evidence` (`employee_id`,`month`,`sync_status`);
--> statement-breakpoint
CREATE TABLE `academic_grants` (
	`id` text PRIMARY KEY NOT NULL,
	`employee_id` text NOT NULL,
	`role` text NOT NULL,
	`scope` text NOT NULL,
	`appointment_id` text,
	`effective_from` text NOT NULL,
	`effective_to` text,
	`version` integer DEFAULT 1 NOT NULL,
	`updated_by` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`employee_id`) REFERENCES `employees`(`employee_id`) ON UPDATE no action ON DELETE no action
);

--> statement-breakpoint
CREATE UNIQUE INDEX `academic_grant_scope` ON `academic_grants` (`employee_id`,`role`,`scope`);
--> statement-breakpoint
CREATE INDEX `academic_grant_employee` ON `academic_grants` (`employee_id`,`effective_from`);
--> statement-breakpoint
CREATE TABLE `academic_payment_evidence` (
	`id` text PRIMARY KEY NOT NULL,
	`session_id` text NOT NULL,
	`employee_id` text NOT NULL,
	`source_version` integer NOT NULL,
	`status` text NOT NULL,
	`data_json` text NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`updated_by` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`session_id`) REFERENCES `academic_sessions`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`employee_id`) REFERENCES `employees`(`employee_id`) ON UPDATE no action ON DELETE no action
);

--> statement-breakpoint
CREATE UNIQUE INDEX `academic_payment_evidence_session_id_unique` ON `academic_payment_evidence` (`session_id`);
--> statement-breakpoint
CREATE INDEX `academic_payment_employee` ON `academic_payment_evidence` (`employee_id`,`status`);
--> statement-breakpoint
CREATE TABLE `academic_records` (
	`id` text PRIMARY KEY NOT NULL,
	`kind` text NOT NULL,
	`programme_id` text,
	`employee_id` text,
	`code` text NOT NULL,
	`title` text NOT NULL,
	`status` text DEFAULT 'Draft' NOT NULL,
	`data_json` text NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`created_by` text NOT NULL,
	`updated_by` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`employee_id`) REFERENCES `employees`(`employee_id`) ON UPDATE no action ON DELETE no action
);

--> statement-breakpoint
CREATE UNIQUE INDEX `academic_record_code` ON `academic_records` (`kind`,`code`);
--> statement-breakpoint
CREATE INDEX `academic_record_scope` ON `academic_records` (`kind`,`programme_id`,`status`);
--> statement-breakpoint
CREATE INDEX `academic_record_employee` ON `academic_records` (`employee_id`,`kind`);
--> statement-breakpoint
CREATE TABLE `academic_rosters` (
	`id` text PRIMARY KEY NOT NULL,
	`allocation_id` text NOT NULL,
	`student_reference` text NOT NULL,
	`display_name` text NOT NULL,
	`source_reference` text NOT NULL,
	`active` integer DEFAULT 1 NOT NULL,
	FOREIGN KEY (`allocation_id`) REFERENCES `academic_allocations`(`id`) ON UPDATE no action ON DELETE no action
);

--> statement-breakpoint
CREATE UNIQUE INDEX `academic_roster_reference` ON `academic_rosters` (`allocation_id`,`student_reference`);
--> statement-breakpoint
CREATE TABLE `academic_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`allocation_id` text NOT NULL,
	`programme_id` text NOT NULL,
	`period_id` text NOT NULL,
	`employee_id` text NOT NULL,
	`root_id` text,
	`date` text NOT NULL,
	`start_time` text NOT NULL,
	`end_time` text NOT NULL,
	`venue_id` text,
	`student_group` text NOT NULL,
	`mode` text NOT NULL,
	`activity_type` text NOT NULL,
	`publication` text DEFAULT 'Draft' NOT NULL,
	`status` text DEFAULT 'Scheduled' NOT NULL,
	`data_json` text NOT NULL,
	`revision_json` text,
	`version` integer DEFAULT 1 NOT NULL,
	`updated_by` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`allocation_id`) REFERENCES `academic_allocations`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`programme_id`) REFERENCES `academic_records`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`period_id`) REFERENCES `academic_records`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`employee_id`) REFERENCES `employees`(`employee_id`) ON UPDATE no action ON DELETE no action
);

--> statement-breakpoint
CREATE UNIQUE INDEX `academic_session_duplicate` ON `academic_sessions` (`allocation_id`,`date`,`start_time`);
--> statement-breakpoint
CREATE INDEX `academic_session_lecturer_date` ON `academic_sessions` (`employee_id`,`date`);
--> statement-breakpoint
CREATE INDEX `academic_session_programme_date` ON `academic_sessions` (`programme_id`,`date`);
--> statement-breakpoint
CREATE INDEX `academic_session_venue_date` ON `academic_sessions` (`venue_id`,`date`);
--> statement-breakpoint
CREATE INDEX `academic_session_root` ON `academic_sessions` (`root_id`,`status`);
