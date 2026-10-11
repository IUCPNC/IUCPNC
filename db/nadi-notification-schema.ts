import {sqliteTable,text,integer,index,uniqueIndex} from 'drizzle-orm/sqlite-core';
export const nadiNotifications=sqliteTable('nadi_notifications',{
 id:text('id').primaryKey(),sourceKey:text('source_key').notNull(),employeeId:text('employee_id'),email:text('email').notNull(),
 kind:text('kind').notNull(),message:text('message').notNull(),link:text('link').notNull(),createdAt:text('created_at').notNull(),readAt:text('read_at'),
 mailStatus:text('mail_status').notNull().default('queued'),lease:text('lease'),leaseUntil:integer('lease_until'),sentAt:text('sent_at'),
},t=>[uniqueIndex('nadi_notification_source_recipient').on(t.sourceKey,t.email),uniqueIndex('nadi_notification_source_employee').on(t.sourceKey,t.employeeId),index('nadi_notification_recipient').on(t.email,t.createdAt),index('nadi_notification_mail').on(t.mailStatus,t.createdAt)]);
