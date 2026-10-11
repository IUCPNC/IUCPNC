import {sql} from 'drizzle-orm';
import {sqliteTable,text,integer,index,uniqueIndex,check} from 'drizzle-orm/sqlite-core';
import {employees,documentAssets} from './schema.ts';

// Module permissions are explicit, dated, scoped grants; employment titles confer no access.
export const academicGrants=sqliteTable('academic_grants',{
 id:text('id').primaryKey(),employeeId:text('employee_id').notNull().references(()=>employees.employeeId),role:text('role').notNull(),scope:text('scope').notNull(),appointmentId:text('appointment_id'),effective:text('effective_from').notNull(),expires:text('effective_to'),version:integer('version').notNull().default(1),updatedBy:text('updated_by').notNull(),updatedAt:text('updated_at').notNull(),
},t=>[uniqueIndex('academic_grant_scope').on(t.employeeId,t.role,t.scope),index('academic_grant_employee').on(t.employeeId,t.effective)]);
// Academic-only reference/configuration entities. No employee, JD, leave or KPI masters.
export const academicRecords=sqliteTable('academic_records',{
 id:text('id').primaryKey(),kind:text('kind').notNull(),programmeId:text('programme_id'),employeeId:text('employee_id').references(()=>employees.employeeId),code:text('code').notNull(),title:text('title').notNull(),status:text('status').notNull().default('Draft'),data:text('data_json').notNull(),version:integer('version').notNull().default(1),createdBy:text('created_by').notNull(),updatedBy:text('updated_by').notNull(),updatedAt:text('updated_at').notNull(),
},t=>[uniqueIndex('academic_record_code').on(t.kind,t.code),index('academic_record_scope').on(t.kind,t.programmeId,t.status),index('academic_record_employee').on(t.employeeId,t.kind)]);
export const academicAllocations=sqliteTable('academic_allocations',{
 id:text('id').primaryKey(),offeringId:text('offering_id').notNull().references(()=>academicRecords.id),employeeId:text('employee_id').notNull().references(()=>employees.employeeId),group:text('student_group').notNull(),status:text('status').notNull().default('Assigned'),data:text('data_json').notNull(),version:integer('version').notNull().default(1),updatedAt:text('updated_at').notNull(),updatedBy:text('updated_by').notNull(),
},t=>[uniqueIndex('academic_allocation_unique').on(t.offeringId,t.employeeId,t.group),index('academic_allocation_employee').on(t.employeeId,t.status)]);
export const academicSessions=sqliteTable('academic_sessions',{
 id:text('id').primaryKey(),allocationId:text('allocation_id').notNull().references(()=>academicAllocations.id),programmeId:text('programme_id').notNull().references(()=>academicRecords.id),periodId:text('period_id').notNull().references(()=>academicRecords.id),employeeId:text('employee_id').notNull().references(()=>employees.employeeId),rootId:text('root_id'),date:text('date').notNull(),start:text('start_time').notNull(),end:text('end_time').notNull(),venueId:text('venue_id'),group:text('student_group').notNull(),mode:text('mode').notNull(),activityType:text('activity_type').notNull(),publication:text('publication').notNull().default('Draft'),status:text('status').notNull().default('Scheduled'),data:text('data_json').notNull(),revision:text('revision_json'),version:integer('version').notNull().default(1),updatedBy:text('updated_by').notNull(),updatedAt:text('updated_at').notNull(),
},t=>[uniqueIndex('academic_session_duplicate').on(t.allocationId,t.date,t.start),index('academic_session_lecturer_date').on(t.employeeId,t.date),index('academic_session_programme_date').on(t.programmeId,t.date),index('academic_session_venue_date').on(t.venueId,t.date),index('academic_session_root').on(t.rootId,t.status)]);
export const academicDelivery=sqliteTable('academic_delivery',{
 sessionId:text('session_id').primaryKey().references(()=>academicSessions.id),employeeId:text('employee_id').notNull().references(()=>employees.employeeId),startedAt:text('started_at'),endedAt:text('ended_at'),minutes:integer('minutes').notNull().default(0),remarks:text('remarks').notNull().default(''),status:text('status').notNull(),verifier:text('verifier'),verifiedAt:text('verified_at'),version:integer('version').notNull().default(1),updatedAt:text('updated_at').notNull(),
},t=>[index('academic_delivery_employee').on(t.employeeId,t.status),check('academic_delivery_minutes',sql`${t.minutes}>=0 AND ${t.minutes}<=1440`)]);
export const academicEvidence=sqliteTable('academic_evidence',{
 id:text('id').primaryKey(),employeeId:text('employee_id').notNull().references(()=>employees.employeeId),programmeId:text('programme_id').notNull(),sourceId:text('source_id').notNull(),sourceVersion:integer('source_version').notNull(),month:text('month').notNull(),category:text('category').notNull(),measuredValue:text('measured_value').notNull(),verification:text('verification').notNull(),verifiedAt:text('verified_at').notNull(),verifier:text('verifier').notNull(),kpiReference:text('kpi_reference'),syncStatus:text('sync_status').notNull(),data:text('data_json').notNull(),updatedAt:text('updated_at').notNull(),
},t=>[uniqueIndex('academic_evidence_source').on(t.sourceId,t.category),index('academic_evidence_month').on(t.employeeId,t.month,t.syncStatus)]);
export const academicDocuments=sqliteTable('academic_document_links',{
 documentId:text('document_id').primaryKey().references(()=>documentAssets.documentId),resourceId:text('resource_id').notNull(),employeeId:text('employee_id').notNull().references(()=>employees.employeeId),programmeId:text('programme_id').notNull(),
},t=>[index('academic_document_resource').on(t.resourceId)]);
export const academicRosters=sqliteTable('academic_rosters',{
 id:text('id').primaryKey(),allocationId:text('allocation_id').notNull().references(()=>academicAllocations.id),studentReference:text('student_reference').notNull(),displayName:text('display_name').notNull(),source:text('source_reference').notNull(),active:integer('active').notNull().default(1),
},t=>[uniqueIndex('academic_roster_reference').on(t.allocationId,t.studentReference)]);
export const academicAttendance=sqliteTable('academic_student_attendance',{
 id:text('id').primaryKey(),sessionId:text('session_id').notNull().references(()=>academicSessions.id),rosterId:text('roster_id').notNull().references(()=>academicRosters.id),status:text('status').notNull(),version:integer('version').notNull().default(1),updatedBy:text('updated_by').notNull(),updatedAt:text('updated_at').notNull(),
},t=>[uniqueIndex('academic_attendance_session_student').on(t.sessionId,t.rosterId)]);
export const academicPayments=sqliteTable('academic_payment_evidence',{
 id:text('id').primaryKey(),sessionId:text('session_id').notNull().unique().references(()=>academicSessions.id),employeeId:text('employee_id').notNull().references(()=>employees.employeeId),sourceVersion:integer('source_version').notNull(),status:text('status').notNull(),data:text('data_json').notNull(),version:integer('version').notNull().default(1),updatedBy:text('updated_by').notNull(),updatedAt:text('updated_at').notNull(),
},t=>[index('academic_payment_employee').on(t.employeeId,t.status)]);
export const academicChecks=sqliteTable('academic_atomic_checks',{id:text('id').primaryKey(),ok:integer('ok').notNull()},t=>[check('academic_atomic_ok',sql`${t.ok}=1`)]);
