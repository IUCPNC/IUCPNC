CREATE TABLE `document_screenings` (
 `id` text PRIMARY KEY NOT NULL,
 `document_id` text NOT NULL REFERENCES document_assets(document_id),
 `bytes` integer NOT NULL,
 `status` text NOT NULL DEFAULT 'uploaded',
 `employee_id` text,
 `result_json` text,
 `applied_json` text NOT NULL DEFAULT '[]',
 `error_code` text,
 `created_by` text NOT NULL,
 `created_at` text NOT NULL,
 `updated_at` text NOT NULL,
 `lock_until` text
);
