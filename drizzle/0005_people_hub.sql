CREATE TABLE `employee_import_records` (
	`id` text PRIMARY KEY NOT NULL,
	`employee_id` text,
	`identity_name` text NOT NULL,
	`section` text NOT NULL,
	`data_json` text NOT NULL,
	`source_json` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`result_json` text,
	`created_by` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);

--> statement-breakpoint
CREATE TABLE `organisation_state` (
	`id` text PRIMARY KEY NOT NULL,
	`version` integer NOT NULL,
	`data_json` text NOT NULL,
	`updated_by` text NOT NULL,
	`updated_at` text NOT NULL
);

