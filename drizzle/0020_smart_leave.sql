CREATE TABLE `leave_accounts` (
	`id` text PRIMARY KEY NOT NULL,
	`employee_id` text NOT NULL,
	`leave_type` text NOT NULL,
	`year` integer NOT NULL,
	`policy_id` text NOT NULL,
	`allocated` integer DEFAULT 0 NOT NULL,
	`accrued` integer DEFAULT 0 NOT NULL,
	`carried` integer DEFAULT 0 NOT NULL,
	`expired` integer DEFAULT 0 NOT NULL,
	`adjustment` integer DEFAULT 0 NOT NULL,
	`reserved` integer DEFAULT 0 NOT NULL,
	`used` integer DEFAULT 0 NOT NULL,
	`reserved_carry` integer DEFAULT 0 NOT NULL,
	`used_carry` integer DEFAULT 0 NOT NULL,
	`expired_carry` integer DEFAULT 0 NOT NULL,
	`carry_expiry` text,
	`calculation_json` text DEFAULT '{}' NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`updated_at` text NOT NULL,
	CONSTRAINT "leave_account_integrity" CHECK("leave_accounts"."allocated">=0 AND "leave_accounts"."accrued">=0 AND "leave_accounts"."carried">=0 AND "leave_accounts"."expired">="leave_accounts"."expired_carry" AND "leave_accounts"."accrued"+"leave_accounts"."adjustment"-"leave_accounts"."used"+"leave_accounts"."used_carry"-"leave_accounts"."reserved"+"leave_accounts"."reserved_carry"-"leave_accounts"."expired"+"leave_accounts"."expired_carry">=0 AND "leave_accounts"."reserved">=0 AND "leave_accounts"."used">=0 AND "leave_accounts"."expired">=0 AND "leave_accounts"."reserved_carry">=0 AND "leave_accounts"."used_carry">=0 AND "leave_accounts"."expired_carry">=0 AND "leave_accounts"."reserved_carry"<="leave_accounts"."reserved" AND "leave_accounts"."used_carry"<="leave_accounts"."used" AND "leave_accounts"."reserved_carry"+"leave_accounts"."used_carry"+"leave_accounts"."expired_carry"<="leave_accounts"."carried" AND "leave_accounts"."accrued"+"leave_accounts"."carried"+"leave_accounts"."adjustment"-"leave_accounts"."expired"-"leave_accounts"."used"-"leave_accounts"."reserved">=0)
);

--> statement-breakpoint
CREATE UNIQUE INDEX `leave_account_employee_type_year` ON `leave_accounts` (`employee_id`,`leave_type`,`year`);
--> statement-breakpoint
CREATE TABLE `leave_assignments` (
	`employee_id` text PRIMARY KEY NOT NULL,
	`data_json` text NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`updated_by` text NOT NULL,
	`updated_at` text NOT NULL
);

--> statement-breakpoint
CREATE TABLE `leave_attachments` (
	`id` text PRIMARY KEY NOT NULL,
	`employee_id` text NOT NULL,
	`request_id` text,
	`name` text NOT NULL,
	`storage_key` text NOT NULL,
	`mime` text NOT NULL,
	`size` integer NOT NULL,
	`created_at` text NOT NULL
);

--> statement-breakpoint
CREATE INDEX `leave_attachment_request` ON `leave_attachments` (`request_id`);
--> statement-breakpoint
CREATE TABLE `leave_imports` (
	`id` text PRIMARY KEY NOT NULL,
	`status` text NOT NULL,
	`data_json` text NOT NULL,
	`created_by` text NOT NULL,
	`created_at` text NOT NULL,
	`version` integer DEFAULT 1 NOT NULL
);

--> statement-breakpoint
CREATE TABLE `leave_ledger` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`reference` text NOT NULL,
	`action` text NOT NULL,
	`data_json` text NOT NULL,
	`actor_email` text NOT NULL,
	`created_at` text NOT NULL
);

--> statement-breakpoint
CREATE UNIQUE INDEX `leave_ledger_reference` ON `leave_ledger` (`account_id`,`reference`);
--> statement-breakpoint
CREATE INDEX `leave_ledger_account` ON `leave_ledger` (`account_id`,`created_at`);
--> statement-breakpoint
CREATE TABLE `leave_policies` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`leave_type` text NOT NULL,
	`kind` text NOT NULL,
	`effective_from` text NOT NULL,
	`effective_to` text,
	`status` text NOT NULL,
	`data_json` text NOT NULL,
	`created_by` text NOT NULL,
	`created_at` text NOT NULL
);

--> statement-breakpoint
CREATE INDEX `leave_policy_effective` ON `leave_policies` (`leave_type`,`effective_from`);
--> statement-breakpoint
CREATE TABLE `leave_requests` (
	`id` text PRIMARY KEY NOT NULL,
	`employee_id` text NOT NULL,
	`leave_type` text NOT NULL,
	`status` text NOT NULL,
	`mode` text NOT NULL,
	`start_date` text NOT NULL,
	`end_date` text NOT NULL,
	`units` integer NOT NULL,
	`source_reference` text,
	`data_json` text NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`approved_at` text
);

--> statement-breakpoint
CREATE UNIQUE INDEX `leave_request_source` ON `leave_requests` (`source_reference`);
--> statement-breakpoint
CREATE INDEX `leave_request_employee_dates` ON `leave_requests` (`employee_id`,`start_date`);
--> statement-breakpoint
CREATE INDEX `leave_request_status` ON `leave_requests` (`status`,`updated_at`);
--> statement-breakpoint
CREATE TABLE `leave_settings` (
	`id` text PRIMARY KEY NOT NULL,
	`data_json` text NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`updated_by` text NOT NULL,
	`updated_at` text NOT NULL
);

--> statement-breakpoint
CREATE TABLE `leave_slots` (
	`id` text PRIMARY KEY NOT NULL,
	`request_id` text NOT NULL,
	`employee_id` text NOT NULL,
	`date` text NOT NULL,
	`slot` text NOT NULL
);

--> statement-breakpoint
CREATE UNIQUE INDEX `leave_slot_employee_date` ON `leave_slots` (`employee_id`,`date`,`slot`);
--> statement-breakpoint
CREATE INDEX `leave_slot_request` ON `leave_slots` (`request_id`);
