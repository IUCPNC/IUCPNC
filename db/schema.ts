import { sql } from "drizzle-orm";
import { index, integer, primaryKey, real, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const employees = sqliteTable("employees", {
  employeeId: text("employee_id").primaryKey(),
  accountUserId: text("account_user_id").unique(),
  email: text("email").notNull().unique(),
  employeeName: text("employee_name").notNull(),
  position: text("position").notNull().default(""),
  department: text("department").notNull().default(""),
  appraiser: text("appraiser").notNull().default(""),
  personId: text("person_id").unique(),
  employmentId: text("employment_id").unique(),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [index("employees_department_idx").on(table.department)]);

export const submissions = sqliteTable("mpc_submissions", {
  id: text("id").primaryKey(),
  authenticatedUserId: text("authenticated_user_id").notNull(),
  authenticatedEmail: text("authenticated_email").notNull(),
  employeeId: text("employee_id").notNull(),
  employeeName: text("employee_name").notNull(),
  employeeEmail: text("employee_email").notNull(),
  position: text("position").notNull().default(""),
  department: text("department").notNull().default(""),
  appraiser: text("appraiser").notNull().default(""),
  reportingYear: integer("reporting_year").notNull(),
  month: integer("month").notNull(),
  kpiScore: real("kpi_score"),
  valuesRating: real("values_rating"),
  cpdRating: real("cpd_rating"),
  socialRating: real("social_rating"),
  overallScore: real("overall_score"),
  performanceBand: text("performance_band").notNull(),
  checkInStatus: text("check_in_status").notNull(),
  cpdHours: real("cpd_hours").notNull().default(0),
  socialLinks: integer("social_links").notNull().default(0),
  employeeAcknowledgment: text("employee_acknowledgment").notNull(),
  appraiserConfirmation: text("appraiser_confirmation").notNull(),
  missingComponents: text("missing_components").notNull(),
  numberMissing: integer("number_missing").notNull(),
  scoreBelow299: integer("score_below_299", { mode: "boolean" }).notNull().default(false),
  socialLinksCompliant: integer("social_links_compliant", { mode: "boolean" }).notNull().default(false),
  employeeAcknowledged: integer("employee_acknowledged", { mode: "boolean" }).notNull().default(false),
  ruleVersion: text("rule_version").notNull().default("2026.1"),
  payloadJson: text("payload_json").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  submittedAt: text("submitted_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  uniqueIndex("submission_employee_period_unique").on(table.employeeId, table.reportingYear, table.month),
  index("submission_period_idx").on(table.reportingYear, table.month),
  index("submission_department_idx").on(table.department),
  index("submission_status_idx").on(table.checkInStatus),
]);

export const submissionEvents = sqliteTable("mpc_submission_events", {
  id: text("id").primaryKey(),
  submissionId: text("submission_id").notNull().references(() => submissions.id, { onDelete: "cascade" }),
  actorUserId: text("actor_user_id").notNull(),
  actorEmail: text("actor_email").notNull(),
  eventType: text("event_type").notNull(),
  snapshotJson: text("snapshot_json").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [index("submission_event_submission_idx").on(table.submissionId)]);

export const employeeDirectoryEvents = sqliteTable("employee_directory_events", {
  id: text("id").primaryKey(),
  employeeId: text("employee_id").notNull(),
  actorUserId: text("actor_user_id").notNull(),
  actorEmail: text("actor_email").notNull(),
  eventType: text("event_type").notNull(),
  beforeJson: text("before_json"),
  afterJson: text("after_json"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  index("directory_event_employee_idx").on(table.employeeId),
  index("directory_event_created_idx").on(table.createdAt),
]);

// Shared IUC People master data. Existing MPC tables remain available while
// modules migrate to canonical person and employment identifiers.
export const people = sqliteTable("people", {
  personId: text("person_id").primaryKey(),
  legalName: text("legal_name").notNull(),
  preferredName: text("preferred_name"),
  primaryEmail: text("primary_email"),
  primaryPhone: text("primary_phone"),
  lifecycleStatus: text("lifecycle_status").notNull().default("prospect"),
  dataClassification: text("data_classification").notNull().default("confidential"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  archivedAt: text("archived_at"),
}, (table) => [index("people_lifecycle_status_idx").on(table.lifecycleStatus)]);

export const personIdentifiers = sqliteTable("person_identifiers", {
  identifierId: text("identifier_id").primaryKey(),
  personId: text("person_id").notNull().references(() => people.personId, { onDelete: "cascade" }),
  identifierType: text("identifier_type").notNull(),
  identifierValue: text("identifier_value").notNull(),
  issuer: text("issuer"),
  verifiedAt: text("verified_at"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  uniqueIndex("person_identifier_type_value_unique").on(table.identifierType, table.identifierValue),
  index("person_identifier_person_idx").on(table.personId),
]);

export const departments = sqliteTable("departments", {
  departmentId: text("department_id").primaryKey(),
  departmentCode: text("department_code").unique(),
  departmentName: text("department_name").notNull(),
  parentDepartmentId: text("parent_department_id"),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const positions = sqliteTable("positions", {
  positionId: text("position_id").primaryKey(),
  positionCode: text("position_code").unique(),
  positionTitle: text("position_title").notNull(),
  jobFamily: text("job_family"),
  grade: text("grade"),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const employmentRecords = sqliteTable("employment_records", {
  employmentId: text("employment_id").primaryKey(),
  employeeId: text("employee_id").notNull().unique(),
  personId: text("person_id").notNull().references(() => people.personId, { onDelete: "restrict" }),
  workEmail: text("work_email"),
  departmentId: text("department_id").references(() => departments.departmentId, { onDelete: "set null" }),
  positionId: text("position_id").references(() => positions.positionId, { onDelete: "set null" }),
  managerEmploymentId: text("manager_employment_id"),
  employmentType: text("employment_type"),
  employmentStatus: text("employment_status").notNull().default("pending"),
  startDate: text("start_date"),
  endDate: text("end_date"),
  sourceApplicationId: text("source_application_id"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  index("employment_person_idx").on(table.personId),
  index("employment_org_idx").on(table.departmentId, table.positionId),
  index("employment_status_idx").on(table.employmentStatus),
]);

export const candidates = sqliteTable("candidates", {
  candidateId: text("candidate_id").primaryKey(),
  personId: text("person_id").notNull().unique().references(() => people.personId, { onDelete: "restrict" }),
  candidateStatus: text("candidate_status").notNull().default("active"),
  talentSource: text("talent_source"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const recruitmentApplications = sqliteTable("recruitment_applications", {
  applicationId: text("application_id").primaryKey(),
  candidateId: text("candidate_id").notNull().references(() => candidates.candidateId, { onDelete: "restrict" }),
  positionId: text("position_id").references(() => positions.positionId, { onDelete: "set null" }),
  departmentId: text("department_id").references(() => departments.departmentId, { onDelete: "set null" }),
  applicationStatus: text("application_status").notNull().default("draft"),
  submittedAt: text("submitted_at"),
  decisionAt: text("decision_at"),
  convertedEmploymentId: text("converted_employment_id").references(() => employmentRecords.employmentId, { onDelete: "set null" }),
  sourceModule: text("source_module").notNull().default("talent"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  index("application_candidate_idx").on(table.candidateId),
  index("application_status_idx").on(table.applicationStatus),
]);

export const documentAssets = sqliteTable("document_assets", {
  documentId: text("document_id").primaryKey(),
  personId: text("person_id").references(() => people.personId, { onDelete: "set null" }),
  moduleCode: text("module_code").notNull(),
  documentType: text("document_type").notNull(),
  storageProvider: text("storage_provider").notNull(),
  storageKey: text("storage_key").notNull(),
  originalFilename: text("original_filename"),
  mimeType: text("mime_type"),
  sha256: text("sha256"),
  classification: text("classification").notNull().default("restricted"),
  retentionUntil: text("retention_until"),
  createdBy: text("created_by").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  deletedAt: text("deleted_at"),
}, (table) => [
  uniqueIndex("document_storage_key_unique").on(table.storageProvider, table.storageKey),
  index("document_person_idx").on(table.personId),
  index("document_module_type_idx").on(table.moduleCode, table.documentType),
]);

export const employmentLetters = sqliteTable("employment_letters", {
  letterId: text("letter_id").primaryKey(),
  personId: text("person_id").notNull().references(() => people.personId, { onDelete: "restrict" }),
  employmentId: text("employment_id").references(() => employmentRecords.employmentId, { onDelete: "set null" }),
  applicationId: text("application_id").references(() => recruitmentApplications.applicationId, { onDelete: "set null" }),
  letterType: text("letter_type").notNull(),
  referenceNumber: text("reference_number").unique(),
  letterStatus: text("letter_status").notNull().default("draft"),
  templateVersion: text("template_version").notNull(),
  documentId: text("document_id").references(() => documentAssets.documentId, { onDelete: "set null" }),
  issuedAt: text("issued_at"),
  acceptedAt: text("accepted_at"),
  createdBy: text("created_by").notNull(),
  approvedBy: text("approved_by"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [index("letter_person_idx").on(table.personId), index("letter_status_idx").on(table.letterStatus)]);

export const accessSubjects = sqliteTable("access_subjects", {
  subjectId: text("subject_id").primaryKey(),
  identityProvider: text("identity_provider").notNull(),
  providerSubject: text("provider_subject").notNull(),
  personId: text("person_id").references(() => people.personId, { onDelete: "set null" }),
  email: text("email"),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  uniqueIndex("access_provider_subject_unique").on(table.identityProvider, table.providerSubject),
  index("access_subject_person_idx").on(table.personId),
]);

export const roleAssignments = sqliteTable("role_assignments", {
  assignmentId: text("assignment_id").primaryKey(),
  subjectId: text("subject_id").notNull().references(() => accessSubjects.subjectId, { onDelete: "cascade" }),
  roleCode: text("role_code").notNull(),
  scopeType: text("scope_type").notNull().default("organization"),
  scopeId: text("scope_id").notNull().default("IUC"),
  validFrom: text("valid_from").notNull().default(sql`CURRENT_TIMESTAMP`),
  validUntil: text("valid_until"),
  grantedBy: text("granted_by").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  uniqueIndex("role_assignment_unique").on(table.subjectId, table.roleCode, table.scopeType, table.scopeId),
  index("role_assignment_lookup_idx").on(table.roleCode, table.scopeType, table.scopeId),
]);

export const integrationEvents = sqliteTable("integration_events", {
  eventId: text("event_id").primaryKey(),
  eventType: text("event_type").notNull(),
  aggregateType: text("aggregate_type").notNull(),
  aggregateId: text("aggregate_id").notNull(),
  sourceModule: text("source_module").notNull(),
  schemaVersion: integer("schema_version").notNull().default(1),
  payloadJson: text("payload_json").notNull(),
  correlationId: text("correlation_id"),
  occurredAt: text("occurred_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  publishedAt: text("published_at"),
}, (table) => [
  index("integration_event_unpublished_idx").on(table.publishedAt, table.occurredAt),
  index("integration_event_aggregate_idx").on(table.aggregateType, table.aggregateId),
]);

export const idempotencyKeys = sqliteTable("idempotency_keys", {
  moduleCode: text("module_code").notNull(),
  idempotencyKey: text("idempotency_key").notNull(),
  requestHash: text("request_hash").notNull(),
  responseStatus: integer("response_status"),
  responseJson: text("response_json"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  expiresAt: text("expires_at").notNull(),
}, (table) => [primaryKey({ columns: [table.moduleCode, table.idempotencyKey] })]);

export const auditEvents = sqliteTable("audit_events", {
  auditId: text("audit_id").primaryKey(),
  occurredAt: text("occurred_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  actorSubjectId: text("actor_subject_id").references(() => accessSubjects.subjectId, { onDelete: "set null" }),
  actorEmail: text("actor_email"),
  moduleCode: text("module_code").notNull(),
  action: text("action").notNull(),
  resourceType: text("resource_type").notNull(),
  resourceId: text("resource_id").notNull(),
  personId: text("person_id").references(() => people.personId, { onDelete: "set null" }),
  purpose: text("purpose"),
  beforeJson: text("before_json"),
  afterJson: text("after_json"),
  correlationId: text("correlation_id"),
  ipHash: text("ip_hash"),
  userAgent: text("user_agent"),
}, (table) => [
  index("audit_resource_idx").on(table.resourceType, table.resourceId, table.occurredAt),
  index("audit_person_idx").on(table.personId, table.occurredAt),
  index("audit_actor_idx").on(table.actorSubjectId, table.occurredAt),
]);
