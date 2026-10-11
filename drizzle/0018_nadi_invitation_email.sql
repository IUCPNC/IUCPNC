CREATE TABLE `nadi_auth_invitations` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`account_version` integer NOT NULL,
	`email` text NOT NULL,
	`payload` text,
	`status` text NOT NULL,
	`expires_ms` integer NOT NULL,
	`lease` text,
	`lease_until` integer,
	`created_at` text NOT NULL,
	`sent_at` text,
	FOREIGN KEY (`account_id`) REFERENCES `nadi_auth_accounts`(`id`) ON UPDATE no action ON DELETE no action
);

--> statement-breakpoint
CREATE UNIQUE INDEX `nadi_auth_invitation_version` ON `nadi_auth_invitations` (`account_id`,`account_version`);
--> statement-breakpoint
CREATE INDEX `nadi_auth_invitation_status` ON `nadi_auth_invitations` (`status`);
