CREATE TABLE `position_employee_sync` (
	`employee_id` text PRIMARY KEY NOT NULL,
	`assignment_id` text,
	`base_json` text NOT NULL,
	`applied_json` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`employee_id`) REFERENCES `employees`(`employee_id`) ON UPDATE no action ON DELETE no action
);

