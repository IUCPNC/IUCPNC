CREATE TABLE `payroll_annual_statements` (
	`id` text PRIMARY KEY NOT NULL,
	`employee_id` text NOT NULL,
	`year` integer NOT NULL,
	`status` text NOT NULL,
	`data_json` text NOT NULL,
	`initiator` text NOT NULL,
	`approver` text,
	`document_id` text,
	`version` integer DEFAULT 1 NOT NULL,
	`created_at` text NOT NULL,
	`issued_at` text,
	FOREIGN KEY (`employee_id`) REFERENCES `employees`(`employee_id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`document_id`) REFERENCES `payroll_documents`(`id`) ON UPDATE no action ON DELETE no action
);

--> statement-breakpoint
CREATE UNIQUE INDEX `payroll_annual_employee_year` ON `payroll_annual_statements` (`employee_id`,`year`);
--> statement-breakpoint
CREATE TABLE `payroll_remittances` (
	`id` text PRIMARY KEY NOT NULL,
	`run_id` text NOT NULL,
	`kind` text NOT NULL,
	`status` text NOT NULL,
	`amount_sen` integer NOT NULL,
	`data_json` text NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`run_id`) REFERENCES `payroll_runs`(`id`) ON UPDATE no action ON DELETE no action
);

--> statement-breakpoint
CREATE UNIQUE INDEX `payroll_remittance_run_kind` ON `payroll_remittances` (`run_id`,`kind`);
