PRAGMA foreign_keys = ON;
--> statement-breakpoint

-- Canonical identity. Module tables must reference person_id instead of copying
-- names or using an email address as the permanent key.
CREATE TABLE `people` (
	`person_id` text PRIMARY KEY NOT NULL,
	`legal_name` text NOT NULL,
	`preferred_name` text,
	`primary_email` text,
	`primary_phone` text,
	`lifecycle_status` text DEFAULT 'prospect' NOT NULL CHECK (`lifecycle_status` IN ('prospect','candidate','employee','former_employee','archived')),
	`data_classification` text DEFAULT 'confidential' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`archived_at` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `people_primary_email_unique` ON `people` (lower(`primary_email`)) WHERE `primary_email` IS NOT NULL;
--> statement-breakpoint
CREATE INDEX `people_lifecycle_status_idx` ON `people` (`lifecycle_status`);
--> statement-breakpoint

CREATE TABLE `person_identifiers` (
	`identifier_id` text PRIMARY KEY NOT NULL,
	`person_id` text NOT NULL,
	`identifier_type` text NOT NULL,
	`identifier_value` text NOT NULL,
	`issuer` text,
	`verified_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`person_id`) REFERENCES `people`(`person_id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE UNIQUE INDEX `person_identifier_type_value_unique` ON `person_identifiers` (`identifier_type`,`identifier_value`);
--> statement-breakpoint
CREATE INDEX `person_identifier_person_idx` ON `person_identifiers` (`person_id`);
--> statement-breakpoint

CREATE TABLE `departments` (
	`department_id` text PRIMARY KEY NOT NULL,
	`department_code` text,
	`department_name` text NOT NULL,
	`parent_department_id` text,
	`active` integer DEFAULT 1 NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`parent_department_id`) REFERENCES `departments`(`department_id`) ON DELETE SET NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `departments_name_unique` ON `departments` (lower(`department_name`));
--> statement-breakpoint
CREATE UNIQUE INDEX `departments_code_unique` ON `departments` (`department_code`) WHERE `department_code` IS NOT NULL;
--> statement-breakpoint

CREATE TABLE `positions` (
	`position_id` text PRIMARY KEY NOT NULL,
	`position_code` text,
	`position_title` text NOT NULL,
	`job_family` text,
	`grade` text,
	`active` integer DEFAULT 1 NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `positions_title_unique` ON `positions` (lower(`position_title`));
--> statement-breakpoint
CREATE UNIQUE INDEX `positions_code_unique` ON `positions` (`position_code`) WHERE `position_code` IS NOT NULL;
--> statement-breakpoint

-- Employment is effective-dated so transfers and rehires preserve history.
CREATE TABLE `employment_records` (
	`employment_id` text PRIMARY KEY NOT NULL,
	`employee_id` text NOT NULL,
	`person_id` text NOT NULL,
	`work_email` text,
	`department_id` text,
	`position_id` text,
	`manager_employment_id` text,
	`employment_type` text,
	`employment_status` text DEFAULT 'pending' NOT NULL CHECK (`employment_status` IN ('pending','active','leave','suspended','ended','cancelled')),
	`start_date` text,
	`end_date` text,
	`source_application_id` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`person_id`) REFERENCES `people`(`person_id`) ON DELETE RESTRICT,
	FOREIGN KEY (`department_id`) REFERENCES `departments`(`department_id`) ON DELETE SET NULL,
	FOREIGN KEY (`position_id`) REFERENCES `positions`(`position_id`) ON DELETE SET NULL,
	FOREIGN KEY (`manager_employment_id`) REFERENCES `employment_records`(`employment_id`) ON DELETE SET NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `employment_employee_id_unique` ON `employment_records` (`employee_id`);
--> statement-breakpoint
CREATE UNIQUE INDEX `employment_work_email_unique` ON `employment_records` (lower(`work_email`)) WHERE `work_email` IS NOT NULL;
--> statement-breakpoint
CREATE INDEX `employment_person_idx` ON `employment_records` (`person_id`);
--> statement-breakpoint
CREATE INDEX `employment_org_idx` ON `employment_records` (`department_id`,`position_id`);
--> statement-breakpoint
CREATE INDEX `employment_status_idx` ON `employment_records` (`employment_status`);
--> statement-breakpoint

CREATE TABLE `candidates` (
	`candidate_id` text PRIMARY KEY NOT NULL,
	`person_id` text NOT NULL,
	`candidate_status` text DEFAULT 'active' NOT NULL,
	`talent_source` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`person_id`) REFERENCES `people`(`person_id`) ON DELETE RESTRICT
);
--> statement-breakpoint
CREATE UNIQUE INDEX `candidate_person_unique` ON `candidates` (`person_id`);
--> statement-breakpoint

CREATE TABLE `recruitment_applications` (
	`application_id` text PRIMARY KEY NOT NULL,
	`candidate_id` text NOT NULL,
	`position_id` text,
	`department_id` text,
	`application_status` text DEFAULT 'draft' NOT NULL,
	`submitted_at` text,
	`decision_at` text,
	`converted_employment_id` text,
	`source_module` text DEFAULT 'talent' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`candidate_id`) REFERENCES `candidates`(`candidate_id`) ON DELETE RESTRICT,
	FOREIGN KEY (`position_id`) REFERENCES `positions`(`position_id`) ON DELETE SET NULL,
	FOREIGN KEY (`department_id`) REFERENCES `departments`(`department_id`) ON DELETE SET NULL,
	FOREIGN KEY (`converted_employment_id`) REFERENCES `employment_records`(`employment_id`) ON DELETE SET NULL
);
--> statement-breakpoint
CREATE INDEX `application_candidate_idx` ON `recruitment_applications` (`candidate_id`);
--> statement-breakpoint
CREATE INDEX `application_status_idx` ON `recruitment_applications` (`application_status`);
--> statement-breakpoint

-- Files live in protected object/document storage. This table stores metadata only.
CREATE TABLE `document_assets` (
	`document_id` text PRIMARY KEY NOT NULL,
	`person_id` text,
	`module_code` text NOT NULL,
	`document_type` text NOT NULL,
	`storage_provider` text NOT NULL,
	`storage_key` text NOT NULL,
	`original_filename` text,
	`mime_type` text,
	`sha256` text,
	`classification` text DEFAULT 'restricted' NOT NULL,
	`retention_until` text,
	`created_by` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`deleted_at` text,
	FOREIGN KEY (`person_id`) REFERENCES `people`(`person_id`) ON DELETE SET NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `document_storage_key_unique` ON `document_assets` (`storage_provider`,`storage_key`);
--> statement-breakpoint
CREATE INDEX `document_person_idx` ON `document_assets` (`person_id`);
--> statement-breakpoint
CREATE INDEX `document_module_type_idx` ON `document_assets` (`module_code`,`document_type`);
--> statement-breakpoint

CREATE TABLE `employment_letters` (
	`letter_id` text PRIMARY KEY NOT NULL,
	`person_id` text NOT NULL,
	`employment_id` text,
	`application_id` text,
	`letter_type` text NOT NULL,
	`reference_number` text,
	`letter_status` text DEFAULT 'draft' NOT NULL CHECK (`letter_status` IN ('draft','reviewed','approved','issued','accepted','declined','cancelled')),
	`template_version` text NOT NULL,
	`document_id` text,
	`issued_at` text,
	`accepted_at` text,
	`created_by` text NOT NULL,
	`approved_by` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`person_id`) REFERENCES `people`(`person_id`) ON DELETE RESTRICT,
	FOREIGN KEY (`employment_id`) REFERENCES `employment_records`(`employment_id`) ON DELETE SET NULL,
	FOREIGN KEY (`application_id`) REFERENCES `recruitment_applications`(`application_id`) ON DELETE SET NULL,
	FOREIGN KEY (`document_id`) REFERENCES `document_assets`(`document_id`) ON DELETE SET NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `letter_reference_unique` ON `employment_letters` (`reference_number`) WHERE `reference_number` IS NOT NULL;
--> statement-breakpoint
CREATE INDEX `letter_person_idx` ON `employment_letters` (`person_id`);
--> statement-breakpoint
CREATE INDEX `letter_status_idx` ON `employment_letters` (`letter_status`);
--> statement-breakpoint

-- Central authorization. Authentication subject is provider-scoped; email is
-- display/contact data and is not the authorization key.
CREATE TABLE `access_subjects` (
	`subject_id` text PRIMARY KEY NOT NULL,
	`identity_provider` text NOT NULL,
	`provider_subject` text NOT NULL,
	`person_id` text,
	`email` text,
	`active` integer DEFAULT 1 NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`person_id`) REFERENCES `people`(`person_id`) ON DELETE SET NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `access_provider_subject_unique` ON `access_subjects` (`identity_provider`,`provider_subject`);
--> statement-breakpoint
CREATE INDEX `access_subject_person_idx` ON `access_subjects` (`person_id`);
--> statement-breakpoint

CREATE TABLE `role_assignments` (
	`assignment_id` text PRIMARY KEY NOT NULL,
	`subject_id` text NOT NULL,
	`role_code` text NOT NULL,
	`scope_type` text DEFAULT 'organization' NOT NULL,
	`scope_id` text DEFAULT 'IUC' NOT NULL,
	`valid_from` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`valid_until` text,
	`granted_by` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`subject_id`) REFERENCES `access_subjects`(`subject_id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE UNIQUE INDEX `role_assignment_unique` ON `role_assignments` (`subject_id`,`role_code`,`scope_type`,`scope_id`);
--> statement-breakpoint
CREATE INDEX `role_assignment_lookup_idx` ON `role_assignments` (`role_code`,`scope_type`,`scope_id`);
--> statement-breakpoint

-- Outbox events let future modules integrate without sharing raw DB credentials.
CREATE TABLE `integration_events` (
	`event_id` text PRIMARY KEY NOT NULL,
	`event_type` text NOT NULL,
	`aggregate_type` text NOT NULL,
	`aggregate_id` text NOT NULL,
	`source_module` text NOT NULL,
	`schema_version` integer DEFAULT 1 NOT NULL,
	`payload_json` text NOT NULL,
	`correlation_id` text,
	`occurred_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`published_at` text
);
--> statement-breakpoint
CREATE INDEX `integration_event_unpublished_idx` ON `integration_events` (`published_at`,`occurred_at`);
--> statement-breakpoint
CREATE INDEX `integration_event_aggregate_idx` ON `integration_events` (`aggregate_type`,`aggregate_id`);
--> statement-breakpoint

CREATE TABLE `idempotency_keys` (
	`module_code` text NOT NULL,
	`idempotency_key` text NOT NULL,
	`request_hash` text NOT NULL,
	`response_status` integer,
	`response_json` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`expires_at` text NOT NULL,
	PRIMARY KEY (`module_code`,`idempotency_key`)
);
--> statement-breakpoint

CREATE TABLE `audit_events` (
	`audit_id` text PRIMARY KEY NOT NULL,
	`occurred_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`actor_subject_id` text,
	`actor_email` text,
	`module_code` text NOT NULL,
	`action` text NOT NULL,
	`resource_type` text NOT NULL,
	`resource_id` text NOT NULL,
	`person_id` text,
	`purpose` text,
	`before_json` text,
	`after_json` text,
	`correlation_id` text,
	`ip_hash` text,
	`user_agent` text,
	FOREIGN KEY (`actor_subject_id`) REFERENCES `access_subjects`(`subject_id`) ON DELETE SET NULL,
	FOREIGN KEY (`person_id`) REFERENCES `people`(`person_id`) ON DELETE SET NULL
);
--> statement-breakpoint
CREATE INDEX `audit_resource_idx` ON `audit_events` (`resource_type`,`resource_id`,`occurred_at`);
--> statement-breakpoint
CREATE INDEX `audit_person_idx` ON `audit_events` (`person_id`,`occurred_at`);
--> statement-breakpoint
CREATE INDEX `audit_actor_idx` ON `audit_events` (`actor_subject_id`,`occurred_at`);
--> statement-breakpoint

-- Compatibility bridge: current MPC code continues to use employees while new
-- modules use people/employment_records. Backfill is performed by the protected
-- master-database route after this schema migration has been applied.
ALTER TABLE `employees` ADD COLUMN `person_id` text;
--> statement-breakpoint
ALTER TABLE `employees` ADD COLUMN `employment_id` text;
--> statement-breakpoint
CREATE UNIQUE INDEX `employees_person_id_unique` ON `employees` (`person_id`);
--> statement-breakpoint
CREATE UNIQUE INDEX `employees_employment_id_unique` ON `employees` (`employment_id`);
--> statement-breakpoint

PRAGMA optimize;
