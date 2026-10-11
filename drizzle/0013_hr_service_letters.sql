ALTER TABLE `hr_service_files` ADD `generated` integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE `hr_service_requests` ADD `letter_json` text DEFAULT '' NOT NULL;
