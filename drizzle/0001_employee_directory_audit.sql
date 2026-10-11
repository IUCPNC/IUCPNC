CREATE TABLE `employee_directory_events` (
	`id` text PRIMARY KEY NOT NULL,
	`employee_id` text NOT NULL,
	`actor_user_id` text NOT NULL,
	`actor_email` text NOT NULL,
	`event_type` text NOT NULL,
	`before_json` text,
	`after_json` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `directory_event_employee_idx` ON `employee_directory_events` (`employee_id`);
--> statement-breakpoint
CREATE INDEX `directory_event_created_idx` ON `employee_directory_events` (`created_at`);
--> statement-breakpoint
PRAGMA optimize;
