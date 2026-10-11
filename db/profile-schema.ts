import { sqliteTable, text, integer, primaryKey, index, uniqueIndex } from 'drizzle-orm/sqlite-core';
import { employees, documentAssets } from './schema.ts';
export const employeeProfileSections=sqliteTable('employee_profile_sections',{
 employeeId:text('employee_id').notNull().references(()=>employees.employeeId),section:text('section').notNull(),dataJson:text('data_json').notNull(),version:integer('version').notNull().default(1),updatedAt:text('updated_at').notNull(),updatedBy:text('updated_by').notNull(),
},t=>[primaryKey({columns:[t.employeeId,t.section]})]);
export const profileRevisions=sqliteTable('profile_revisions',{
 id:text('id').primaryKey(),employeeId:text('employee_id').notNull().references(()=>employees.employeeId),section:text('section').notNull(),version:integer('version').notNull(),dataJson:text('data_json').notNull(),createdAt:text('created_at').notNull(),createdBy:text('created_by').notNull(),
},t=>[uniqueIndex('profile_revision_unique').on(t.employeeId,t.section,t.version)]);
export const profileAudit=sqliteTable('profile_audit',{
 id:text('id').primaryKey(),employeeId:text('employee_id').notNull().references(()=>employees.employeeId),actorId:text('actor_id').notNull(),actorEmail:text('actor_email').notNull(),action:text('action').notNull(),section:text('section').notNull(),detailJson:text('detail_json').notNull(),createdAt:text('created_at').notNull(),
},t=>[index('profile_audit_employee_date').on(t.employeeId,t.createdAt)]);
export const profileDocuments=sqliteTable('profile_documents',{
 documentId:text('document_id').primaryKey().references(()=>documentAssets.documentId),employeeId:text('employee_id').notNull().references(()=>employees.employeeId),category:text('category').notNull(),visibility:text('visibility').notNull().default('hr'),bytes:integer('bytes').notNull(),
},t=>[index('profile_documents_employee').on(t.employeeId)]);
