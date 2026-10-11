CREATE TABLE `nadi_notifications` (
	`id` text PRIMARY KEY NOT NULL,
	`source_key` text NOT NULL,
	`employee_id` text,
	`email` text NOT NULL,
	`kind` text NOT NULL,
	`message` text NOT NULL,
	`link` text NOT NULL,
	`created_at` text NOT NULL,
	`read_at` text,
	`mail_status` text DEFAULT 'queued' NOT NULL,
	`lease` text,
	`lease_until` integer,
	`sent_at` text
);

--> statement-breakpoint
CREATE UNIQUE INDEX `nadi_notification_source_recipient` ON `nadi_notifications` (`source_key`,`email`);
--> statement-breakpoint
CREATE UNIQUE INDEX `nadi_notification_source_employee` ON `nadi_notifications` (`source_key`,`employee_id`);
--> statement-breakpoint
CREATE INDEX `nadi_notification_recipient` ON `nadi_notifications` (`email`,`created_at`);
--> statement-breakpoint
CREATE INDEX `nadi_notification_mail` ON `nadi_notifications` (`mail_status`,`created_at`);
--> statement-breakpoint
INSERT INTO nadi_auth_settings (key,value,updated_by,updated_at) VALUES ('notifications_started',strftime('%Y-%m-%dT%H:%M:%fZ','now'),'notification-activation',strftime('%Y-%m-%dT%H:%M:%fZ','now')) ON CONFLICT(key) DO NOTHING;
