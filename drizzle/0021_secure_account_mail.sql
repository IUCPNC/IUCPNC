CREATE TABLE `nadi_auth_hr_mail` (
	`id` text PRIMARY KEY NOT NULL,
	`audit_id` text NOT NULL,
	`account_id` text NOT NULL,
	`account_version` integer NOT NULL,
	`status` text DEFAULT 'queued' NOT NULL,
	`lease` text,
	`lease_until` integer,
	`created_at` text NOT NULL,
	`sent_at` text
);

--> statement-breakpoint
CREATE UNIQUE INDEX `nadi_auth_hr_mail_audit` ON `nadi_auth_hr_mail` (`audit_id`);
--> statement-breakpoint
CREATE INDEX `nadi_auth_hr_mail_status` ON `nadi_auth_hr_mail` (`status`);
--> statement-breakpoint
ALTER TABLE `nadi_auth_invitations` ADD `token_hash` text;
--> statement-breakpoint
ALTER TABLE `nadi_auth_invitations` ADD `consumed_ms` integer;
--> statement-breakpoint
ALTER TABLE `nadi_auth_invitations` ADD `audit_id` text;
--> statement-breakpoint
ALTER TABLE `nadi_auth_invitations` ADD `format` text DEFAULT 'legacy' NOT NULL;
