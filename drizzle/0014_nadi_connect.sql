CREATE TABLE `connect_audience` (
	`post_id` text NOT NULL,
	`employee_id` text NOT NULL,
	PRIMARY KEY(`post_id`, `employee_id`),
	FOREIGN KEY (`post_id`) REFERENCES `connect_posts`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`employee_id`) REFERENCES `employees`(`employee_id`) ON UPDATE no action ON DELETE no action
);

--> statement-breakpoint
CREATE TABLE `connect_audit` (
	`id` text PRIMARY KEY NOT NULL,
	`actor_id` text NOT NULL,
	`action` text NOT NULL,
	`resource_id` text NOT NULL,
	`detail_json` text NOT NULL,
	`created_at` text NOT NULL
);

--> statement-breakpoint
CREATE TABLE `connect_badge_awards` (
	`id` text PRIMARY KEY NOT NULL,
	`badge_id` text NOT NULL,
	`employee_id` text NOT NULL,
	`reason` text NOT NULL,
	`issued_by` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`badge_id`) REFERENCES `connect_badge_definitions`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`employee_id`) REFERENCES `employees`(`employee_id`) ON UPDATE no action ON DELETE no action
);

--> statement-breakpoint
CREATE TABLE `connect_badge_definitions` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`criteria` text NOT NULL,
	`reward` text,
	`active` integer DEFAULT 1 NOT NULL
);

--> statement-breakpoint
CREATE TABLE `connect_comments` (
	`id` text PRIMARY KEY NOT NULL,
	`post_id` text NOT NULL,
	`author_id` text NOT NULL,
	`body` text NOT NULL,
	`status` text DEFAULT 'visible' NOT NULL,
	`operation` text,
	`version` integer DEFAULT 1 NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`post_id`) REFERENCES `connect_posts`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`author_id`) REFERENCES `employees`(`employee_id`) ON UPDATE no action ON DELETE no action
);

--> statement-breakpoint
CREATE INDEX `connect_comment_post` ON `connect_comments` (`post_id`,`created_at`);
--> statement-breakpoint
CREATE TABLE `connect_eligibility` (
	`employee_id` text NOT NULL,
	`activity` text NOT NULL,
	`issued` integer DEFAULT 1 NOT NULL,
	PRIMARY KEY(`employee_id`, `activity`),
	FOREIGN KEY (`employee_id`) REFERENCES `employees`(`employee_id`) ON UPDATE no action ON DELETE no action
);

--> statement-breakpoint
CREATE TABLE `connect_images` (
	`id` text PRIMARY KEY NOT NULL,
	`post_id` text NOT NULL,
	`storage_key` text NOT NULL,
	`mime_type` text NOT NULL,
	`bytes` integer NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`post_id`) REFERENCES `connect_posts`(`id`) ON UPDATE no action ON DELETE no action
);

--> statement-breakpoint
CREATE TABLE `connect_mentions` (
	`post_id` text NOT NULL,
	`employee_id` text NOT NULL,
	PRIMARY KEY(`post_id`, `employee_id`),
	FOREIGN KEY (`post_id`) REFERENCES `connect_posts`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`employee_id`) REFERENCES `employees`(`employee_id`) ON UPDATE no action ON DELETE no action
);

--> statement-breakpoint
CREATE TABLE `connect_moods` (
	`id` text PRIMARY KEY NOT NULL,
	`period` text NOT NULL,
	`cohort` text,
	`mood` text NOT NULL,
	`comment` text
);

--> statement-breakpoint
CREATE INDEX `connect_mood_period` ON `connect_moods` (`period`,`cohort`);
--> statement-breakpoint
CREATE TABLE `connect_nominations` (
	`id` text PRIMARY KEY NOT NULL,
	`period` text NOT NULL,
	`category` text NOT NULL,
	`nominator_id` text NOT NULL,
	`recipient_id` text NOT NULL,
	`reason` text NOT NULL,
	`value` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`period`) REFERENCES `connect_periods`(`period`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`nominator_id`) REFERENCES `employees`(`employee_id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`recipient_id`) REFERENCES `employees`(`employee_id`) ON UPDATE no action ON DELETE no action
);

--> statement-breakpoint
CREATE UNIQUE INDEX `connect_nomination_once` ON `connect_nominations` (`period`,`category`,`nominator_id`,`recipient_id`);
--> statement-breakpoint
CREATE TABLE `connect_notifications` (
	`id` text PRIMARY KEY NOT NULL,
	`employee_id` text NOT NULL,
	`kind` text NOT NULL,
	`message` text NOT NULL,
	`link` text NOT NULL,
	`created_at` text NOT NULL,
	`read_at` text,
	FOREIGN KEY (`employee_id`) REFERENCES `employees`(`employee_id`) ON UPDATE no action ON DELETE no action
);

--> statement-breakpoint
CREATE INDEX `connect_notification_employee` ON `connect_notifications` (`employee_id`,`created_at`);
--> statement-breakpoint
CREATE TABLE `connect_periods` (
	`period` text PRIMARY KEY NOT NULL,
	`status` text DEFAULT 'Open' NOT NULL,
	`categories_json` text NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`updated_at` text NOT NULL,
	`updated_by` text NOT NULL
);

--> statement-breakpoint
CREATE TABLE `connect_posts` (
	`id` text PRIMARY KEY NOT NULL,
	`author_id` text,
	`kind` text NOT NULL,
	`body` text NOT NULL,
	`visibility` text NOT NULL,
	`department` text,
	`team_id` text,
	`subject_id` text,
	`metadata_json` text DEFAULT '{}' NOT NULL,
	`status` text DEFAULT 'visible' NOT NULL,
	`operation` text,
	`version` integer DEFAULT 1 NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`author_id`) REFERENCES `employees`(`employee_id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`team_id`) REFERENCES `employees`(`employee_id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`subject_id`) REFERENCES `employees`(`employee_id`) ON UPDATE no action ON DELETE no action
);

--> statement-breakpoint
CREATE INDEX `connect_post_created` ON `connect_posts` (`created_at`);
--> statement-breakpoint
CREATE INDEX `connect_post_scope` ON `connect_posts` (`visibility`,`department`,`team_id`);
--> statement-breakpoint
CREATE TABLE `connect_preferences` (
	`employee_id` text PRIMARY KEY NOT NULL,
	`birthday` integer DEFAULT 0 NOT NULL,
	`anniversary` integer DEFAULT 0 NOT NULL,
	`stories` integer DEFAULT 0 NOT NULL,
	`notifications` integer DEFAULT 1 NOT NULL,
	FOREIGN KEY (`employee_id`) REFERENCES `employees`(`employee_id`) ON UPDATE no action ON DELETE no action
);

--> statement-breakpoint
CREATE TABLE `connect_reactions` (
	`post_id` text NOT NULL,
	`employee_id` text NOT NULL,
	`reaction` text NOT NULL,
	PRIMARY KEY(`post_id`, `employee_id`),
	FOREIGN KEY (`post_id`) REFERENCES `connect_posts`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`employee_id`) REFERENCES `employees`(`employee_id`) ON UPDATE no action ON DELETE no action
);

--> statement-breakpoint
CREATE TABLE `connect_recognition` (
	`id` text PRIMARY KEY NOT NULL,
	`post_id` text NOT NULL,
	`sender_id` text NOT NULL,
	`recipient_id` text NOT NULL,
	`category` text NOT NULL,
	`value` text,
	`reason` text NOT NULL,
	`reason_hash` text NOT NULL,
	`stars` integer DEFAULT 0 NOT NULL,
	`period` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`post_id`) REFERENCES `connect_posts`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`sender_id`) REFERENCES `employees`(`employee_id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`recipient_id`) REFERENCES `employees`(`employee_id`) ON UPDATE no action ON DELETE no action
);

--> statement-breakpoint
CREATE UNIQUE INDEX `connect_recognition_post_id_unique` ON `connect_recognition` (`post_id`);
--> statement-breakpoint
CREATE UNIQUE INDEX `connect_recognition_duplicate` ON `connect_recognition` (`sender_id`,`recipient_id`,`period`,`reason_hash`);
--> statement-breakpoint
CREATE INDEX `connect_recognition_budget` ON `connect_recognition` (`sender_id`,`period`);
--> statement-breakpoint
CREATE INDEX `connect_recognition_recipient` ON `connect_recognition` (`recipient_id`,`period`);
--> statement-breakpoint
CREATE TABLE `connect_reports` (
	`id` text PRIMARY KEY NOT NULL,
	`employee_id` text NOT NULL,
	`post_id` text NOT NULL,
	`comment_id` text,
	`reason` text NOT NULL,
	`status` text DEFAULT 'Open' NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`employee_id`) REFERENCES `employees`(`employee_id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`post_id`) REFERENCES `connect_posts`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`comment_id`) REFERENCES `connect_comments`(`id`) ON UPDATE no action ON DELETE no action
);

--> statement-breakpoint
CREATE TABLE `connect_selections` (
	`id` text PRIMARY KEY NOT NULL,
	`period` text NOT NULL,
	`category` text NOT NULL,
	`recipient_id` text NOT NULL,
	`scores_json` text NOT NULL,
	`weighted_score` real NOT NULL,
	`rationale` text NOT NULL,
	`citation` text NOT NULL,
	`approved_by` text NOT NULL,
	`published_post_id` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`period`) REFERENCES `connect_periods`(`period`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`recipient_id`) REFERENCES `employees`(`employee_id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`published_post_id`) REFERENCES `connect_posts`(`id`) ON UPDATE no action ON DELETE no action
);

--> statement-breakpoint
CREATE UNIQUE INDEX `connect_award_category` ON `connect_selections` (`period`,`category`);
--> statement-breakpoint
CREATE TABLE `connect_settings` (
	`id` text PRIMARY KEY NOT NULL,
	`data_json` text NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`updated_at` text NOT NULL,
	`updated_by` text NOT NULL
);

--> statement-breakpoint
CREATE TABLE `connect_survey_responses` (
	`id` text PRIMARY KEY NOT NULL,
	`survey_id` text NOT NULL,
	`period` text NOT NULL,
	`cohort` text,
	`answers_json` text NOT NULL,
	FOREIGN KEY (`survey_id`) REFERENCES `connect_surveys`(`id`) ON UPDATE no action ON DELETE no action
);

--> statement-breakpoint
CREATE INDEX `connect_survey_response` ON `connect_survey_responses` (`survey_id`,`cohort`);
--> statement-breakpoint
CREATE TABLE `connect_surveys` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`questions_json` text NOT NULL,
	`starts_on` text NOT NULL,
	`ends_on` text NOT NULL,
	`status` text DEFAULT 'Published' NOT NULL,
	`created_by` text NOT NULL,
	`operation` text,
	`version` integer DEFAULT 1 NOT NULL
);

--> statement-breakpoint
CREATE TABLE `connect_tickets` (
	`token_hash` text PRIMARY KEY NOT NULL,
	`activity` text NOT NULL,
	`cohort` text,
	`period` text NOT NULL,
	`expires_at` text NOT NULL,
	`operation` text
);

--> statement-breakpoint
CREATE INDEX `connect_ticket_expiry` ON `connect_tickets` (`expires_at`);
--> statement-breakpoint
CREATE TABLE `connect_voice` (
	`id` text PRIMARY KEY NOT NULL,
	`employee_id` text,
	`receipt_hash` text,
	`anonymous` integer NOT NULL,
	`category` text NOT NULL,
	`subject` text NOT NULL,
	`body` text NOT NULL,
	`status` text DEFAULT 'Received' NOT NULL,
	`period` text NOT NULL,
	`updated_period` text NOT NULL,
	`response` text,
	`public_summary` text,
	`public_action` text,
	`operation` text,
	`version` integer DEFAULT 1 NOT NULL,
	FOREIGN KEY (`employee_id`) REFERENCES `employees`(`employee_id`) ON UPDATE no action ON DELETE no action
);

--> statement-breakpoint
CREATE UNIQUE INDEX `connect_voice_receipt_hash_unique` ON `connect_voice` (`receipt_hash`);
--> statement-breakpoint
CREATE INDEX `connect_voice_period` ON `connect_voice` (`period`);
--> statement-breakpoint
CREATE TABLE `connect_voice_updates` (
	`id` text PRIMARY KEY NOT NULL,
	`voice_id` text NOT NULL,
	`status` text NOT NULL,
	`message` text NOT NULL,
	`period` text NOT NULL,
	FOREIGN KEY (`voice_id`) REFERENCES `connect_voice`(`id`) ON UPDATE no action ON DELETE no action
);

