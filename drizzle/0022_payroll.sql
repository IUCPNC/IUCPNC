CREATE TABLE `payroll_challenges` (
	`id` text PRIMARY KEY NOT NULL,
	`actor_email` text NOT NULL,
	`account_id` text NOT NULL,
	`account_version` integer NOT NULL,
	`action` text NOT NULL,
	`resource` text NOT NULL,
	`expires_ms` integer NOT NULL,
	`used` integer DEFAULT 0 NOT NULL
);

--> statement-breakpoint
CREATE INDEX `payroll_challenge_expiry` ON `payroll_challenges` (`expires_ms`);
--> statement-breakpoint
CREATE TABLE `payroll_checks` (
	`id` text PRIMARY KEY NOT NULL,
	`ok` integer NOT NULL,
	CONSTRAINT "payroll_atomic_check" CHECK("payroll_checks"."ok"=1)
);

--> statement-breakpoint
CREATE TABLE `payroll_config` (
	`id` text PRIMARY KEY NOT NULL,
	`data_json` text NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`updated_by` text NOT NULL,
	`updated_at` text NOT NULL
);

--> statement-breakpoint
CREATE TABLE `payroll_decisions` (
	`id` text PRIMARY KEY NOT NULL,
	`run_id` text NOT NULL,
	`step` text NOT NULL,
	`decision` text NOT NULL,
	`actor_email` text NOT NULL,
	`data_json` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`run_id`) REFERENCES `payroll_runs`(`id`) ON UPDATE no action ON DELETE no action
);

--> statement-breakpoint
CREATE INDEX `payroll_decision_run` ON `payroll_decisions` (`run_id`,`created_at`);
--> statement-breakpoint
CREATE TABLE `payroll_documents` (
	`id` text PRIMARY KEY NOT NULL,
	`employee_id` text NOT NULL,
	`storage_key` text NOT NULL,
	`name` text NOT NULL,
	`mime` text NOT NULL,
	`size` integer NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`employee_id`) REFERENCES `employees`(`employee_id`) ON UPDATE no action ON DELETE no action
);

--> statement-breakpoint
CREATE INDEX `payroll_document_employee` ON `payroll_documents` (`employee_id`);
--> statement-breakpoint
CREATE TABLE `payroll_enquiries` (
	`id` text PRIMARY KEY NOT NULL,
	`employee_id` text NOT NULL,
	`category` text NOT NULL,
	`status` text NOT NULL,
	`data_json` text NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`employee_id`) REFERENCES `employees`(`employee_id`) ON UPDATE no action ON DELETE no action
);

--> statement-breakpoint
CREATE INDEX `payroll_enquiry_employee` ON `payroll_enquiries` (`employee_id`,`updated_at`);
--> statement-breakpoint
CREATE TABLE `payroll_grants` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`role` text NOT NULL,
	`entity` text NOT NULL,
	`expires` text,
	`created_by` text NOT NULL,
	`created_at` text NOT NULL,
	`version` integer DEFAULT 1 NOT NULL
);

--> statement-breakpoint
CREATE UNIQUE INDEX `payroll_grant_scope` ON `payroll_grants` (`email`,`role`,`entity`);
--> statement-breakpoint
CREATE TABLE `payroll_lines` (
	`id` text PRIMARY KEY NOT NULL,
	`run_id` text NOT NULL,
	`employee_id` text NOT NULL,
	`snapshot_json` text NOT NULL,
	`fingerprint` text NOT NULL,
	`gross_sen` integer NOT NULL,
	`net_sen` integer NOT NULL,
	`cost_sen` integer NOT NULL,
	`critical` integer NOT NULL,
	`published_at` text,
	FOREIGN KEY (`run_id`) REFERENCES `payroll_runs`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`employee_id`) REFERENCES `employees`(`employee_id`) ON UPDATE no action ON DELETE no action
);

--> statement-breakpoint
CREATE UNIQUE INDEX `payroll_line_employee` ON `payroll_lines` (`run_id`,`employee_id`);
--> statement-breakpoint
CREATE INDEX `payroll_line_self` ON `payroll_lines` (`employee_id`,`published_at`);
--> statement-breakpoint
CREATE TABLE `payroll_payments` (
	`id` text PRIMARY KEY NOT NULL,
	`run_id` text NOT NULL,
	`line_id` text NOT NULL,
	`batch_reference` text NOT NULL,
	`status` text NOT NULL,
	`amount_sen` integer NOT NULL,
	`bank_cipher` text NOT NULL,
	`data_json` text NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`run_id`) REFERENCES `payroll_runs`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`line_id`) REFERENCES `payroll_lines`(`id`) ON UPDATE no action ON DELETE no action
);

--> statement-breakpoint
CREATE UNIQUE INDEX `payroll_payment_line` ON `payroll_payments` (`line_id`);
--> statement-breakpoint
CREATE INDEX `payroll_payment_run` ON `payroll_payments` (`run_id`,`status`);
--> statement-breakpoint
CREATE TABLE `payroll_periods` (
	`id` text PRIMARY KEY NOT NULL,
	`entity` text NOT NULL,
	`period` text NOT NULL,
	`data_json` text NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`created_by` text NOT NULL,
	`created_at` text NOT NULL
);

--> statement-breakpoint
CREATE UNIQUE INDEX `payroll_period_entity` ON `payroll_periods` (`entity`,`period`);
--> statement-breakpoint
CREATE TABLE `payroll_profiles` (
	`employee_id` text PRIMARY KEY NOT NULL,
	`data_json` text NOT NULL,
	`bank_cipher` text,
	`version` integer DEFAULT 1 NOT NULL,
	`updated_by` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`employee_id`) REFERENCES `employees`(`employee_id`) ON UPDATE no action ON DELETE no action
);

--> statement-breakpoint
CREATE TABLE `payroll_remuneration` (
	`id` text PRIMARY KEY NOT NULL,
	`employee_id` text NOT NULL,
	`code` text NOT NULL,
	`kind` text NOT NULL,
	`amount_sen` integer NOT NULL,
	`effective_from` text NOT NULL,
	`effective_to` text,
	`appointment_id` text,
	`status` text NOT NULL,
	`data_json` text NOT NULL,
	`initiator` text NOT NULL,
	`approver` text,
	`approved_at` text,
	`version` integer DEFAULT 1 NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`employee_id`) REFERENCES `employees`(`employee_id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "payroll_remuneration_amount" CHECK("payroll_remuneration"."amount_sen">=0)
);

--> statement-breakpoint
CREATE INDEX `payroll_remuneration_employee` ON `payroll_remuneration` (`employee_id`,`status`,`effective_from`);
--> statement-breakpoint
CREATE TABLE `payroll_runs` (
	`id` text PRIMARY KEY NOT NULL,
	`period_id` text NOT NULL,
	`cycle` text NOT NULL,
	`mode` text NOT NULL,
	`status` text NOT NULL,
	`data_json` text NOT NULL,
	`initiator` text NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`period_id`) REFERENCES `payroll_periods`(`id`) ON UPDATE no action ON DELETE no action
);

--> statement-breakpoint
CREATE UNIQUE INDEX `payroll_run_cycle` ON `payroll_runs` (`period_id`,`cycle`);
--> statement-breakpoint
CREATE TABLE `payroll_transactions` (
	`id` text PRIMARY KEY NOT NULL,
	`employee_id` text NOT NULL,
	`source_module` text NOT NULL,
	`source_reference` text NOT NULL,
	`source_revision` integer NOT NULL,
	`category` text NOT NULL,
	`effective_date` text NOT NULL,
	`approved_at` text,
	`payroll_period` text NOT NULL,
	`status` text NOT NULL,
	`data_json` text NOT NULL,
	`processed_run` text,
	`version` integer DEFAULT 1 NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`employee_id`) REFERENCES `employees`(`employee_id`) ON UPDATE no action ON DELETE no action
);

--> statement-breakpoint
CREATE UNIQUE INDEX `payroll_transaction_source` ON `payroll_transactions` (`source_module`,`source_reference`,`source_revision`);
--> statement-breakpoint
CREATE INDEX `payroll_transaction_cycle` ON `payroll_transactions` (`payroll_period`,`status`,`employee_id`);
