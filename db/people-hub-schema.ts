import {sqliteTable,text,integer} from 'drizzle-orm/sqlite-core';
export const organisationState=sqliteTable('organisation_state',{
 id:text('id').primaryKey(), version:integer('version').notNull(), dataJson:text('data_json').notNull(), updatedBy:text('updated_by').notNull(),updatedAt:text('updated_at').notNull(),
});
export const employeeImportRecords=sqliteTable('employee_import_records',{
 id:text('id').primaryKey(), employeeId:text('employee_id'), identityName:text('identity_name').notNull(), section:text('section').notNull(),
 dataJson:text('data_json').notNull(),sourceJson:text('source_json').notNull(),status:text('status').notNull().default('pending'),
 resultJson:text('result_json'),createdBy:text('created_by').notNull(),createdAt:text('created_at').notNull(),updatedAt:text('updated_at').notNull(),
});
