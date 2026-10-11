import {sqliteTable,text,integer,primaryKey} from 'drizzle-orm/sqlite-core';
import {employees} from './schema.ts';
export const managementGrants=sqliteTable('management_grants',{
 employeeId:text('employee_id').notNull().references(()=>employees.employeeId),
 role:text('role').notNull(),version:integer('version').notNull().default(1),
 updatedBy:text('updated_by').notNull(),updatedAt:text('updated_at').notNull(),
},t=>[primaryKey({columns:[t.employeeId,t.role]})]);
export const managementReports=sqliteTable('management_reports',{
 employeeId:text('employee_id').primaryKey().references(()=>employees.employeeId),
 managerId:text('manager_id').notNull().references(()=>employees.employeeId),
});
export const managementAudit=sqliteTable('management_audit',{
 id:text('id').primaryKey(),actorId:text('actor_id').notNull(),actorEmail:text('actor_email').notNull(),
 action:text('action').notNull(),detailJson:text('detail_json').notNull(),createdAt:text('created_at').notNull(),
});
