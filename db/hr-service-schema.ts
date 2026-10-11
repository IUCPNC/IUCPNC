import {sqliteTable,text,integer,index,uniqueIndex} from 'drizzle-orm/sqlite-core';
import {employees} from './schema.ts';
export const hrServiceRequests=sqliteTable('hr_service_requests',{
 letterJson:text('letter_json').notNull().default(''),
 id:text('id').primaryKey(),reference:text('reference').notNull(),employeeId:text('employee_id').notNull().references(()=>employees.employeeId),createdBy:text('created_by').notNull(),requestType:text('request_type').notNull(),subject:text('subject').notNull(),details:text('details').notNull(),recipient:text('recipient').notNull().default(''),neededBy:text('needed_by'),status:text('status').notNull().default('Submitted'),version:integer('version').notNull().default(1),draftReply:text('draft_reply').notNull().default(''),internalNotes:text('internal_notes').notNull().default(''),approvedBy:text('approved_by'),approvedAt:text('approved_at'),issuedBy:text('issued_by'),issuedAt:text('issued_at'),lastOperation:text('last_operation').notNull(),submissionKey:text('submission_key').notNull(),submissionHash:text('submission_hash').notNull(),createdAt:text('created_at').notNull(),updatedAt:text('updated_at').notNull(),
},t=>[uniqueIndex('hr_service_reference_unique').on(t.reference),uniqueIndex('hr_service_submission_unique').on(t.employeeId,t.submissionKey),index('hr_service_employee_idx').on(t.employeeId,t.createdAt),index('hr_service_status_idx').on(t.status,t.updatedAt)]);
export const hrServiceEvents=sqliteTable('hr_service_events',{
 id:text('id').primaryKey(),requestId:text('request_id').notNull().references(()=>hrServiceRequests.id),actorId:text('actor_id').notNull(),actorEmail:text('actor_email').notNull(),actorRole:text('actor_role').notNull(),eventType:text('event_type').notNull(),message:text('message').notNull().default(''),createdAt:text('created_at').notNull(),
},t=>[index('hr_service_event_request_idx').on(t.requestId,t.createdAt)]);
export const hrServiceFiles=sqliteTable('hr_service_files',{
 generated:integer('generated').notNull().default(0),
 id:text('id').primaryKey(),requestId:text('request_id').notNull().references(()=>hrServiceRequests.id),originalFilename:text('original_filename').notNull(),mimeType:text('mime_type').notNull(),bytes:integer('bytes').notNull(),sha256:text('sha256').notNull(),storageKey:text('storage_key').notNull(),uploadedBy:text('uploaded_by').notNull(),createdAt:text('created_at').notNull(),removedAt:text('removed_at'),
},t=>[index('hr_service_file_request_idx').on(t.requestId)]);
