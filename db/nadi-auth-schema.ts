import {sqliteTable,text,integer,primaryKey,index,uniqueIndex} from 'drizzle-orm/sqlite-core';
import {employees} from './schema.ts';
export const nadiAccounts=sqliteTable('nadi_auth_accounts',{
 id:text('id').primaryKey(),employeeId:text('employee_id').references(()=>employees.employeeId),
 email:text('email').notNull(),canonicalUserId:text('canonical_user_id').notNull(),
 passwordHash:text('password_hash').notNull(),enabled:integer('enabled').notNull().default(1),
 mustChange:integer('must_change').notNull().default(1),temporaryExpires:integer('temporary_expires'),
 version:integer('version').notNull().default(1),createdAt:text('created_at').notNull(),updatedAt:text('updated_at').notNull(),
},t=>[uniqueIndex('nadi_auth_email_unique').on(t.email),uniqueIndex('nadi_auth_employee_unique').on(t.employeeId),uniqueIndex('nadi_auth_identity_unique').on(t.canonicalUserId)]);
export const nadiSessions=sqliteTable('nadi_auth_sessions',{
 tokenHash:text('token_hash').primaryKey(),accountId:text('account_id').notNull().references(()=>nadiAccounts.id),
 accountVersion:integer('account_version').notNull(),createdMs:integer('created_ms').notNull(),
 expiresMs:integer('expires_ms').notNull(),seenMs:integer('seen_ms').notNull(),
},t=>[index('nadi_auth_sessions_account').on(t.accountId),index('nadi_auth_sessions_expiry').on(t.expiresMs)]);
export const nadiAuthSettings=sqliteTable('nadi_auth_settings',{key:text('key').primaryKey(),value:text('value').notNull(),updatedBy:text('updated_by').notNull(),updatedAt:text('updated_at').notNull()});
export const nadiAuthAudit=sqliteTable('nadi_auth_audit',{
 id:text('id').primaryKey(),actorId:text('actor_id').notNull(),actorEmail:text('actor_email').notNull(),
 action:text('action').notNull(),accountId:text('account_id'),employeeId:text('employee_id'),
 detailJson:text('detail_json').notNull(),createdAt:text('created_at').notNull(),
},t=>[index('nadi_auth_audit_created').on(t.createdAt)]);
export const nadiAuthLimits=sqliteTable('nadi_auth_limits',{
 bucket:text('bucket').notNull(),windowMs:integer('window_ms').notNull(),attempts:integer('attempts').notNull().default(0),
 expiresMs:integer('expires_ms').notNull(),
},t=>[primaryKey({columns:[t.bucket,t.windowMs]}),index('nadi_auth_limits_expiry').on(t.expiresMs)]);
export const nadiCalendarCache=sqliteTable('nadi_calendar_cache',{
 source:text('source').notNull(),month:text('month').notNull(),eventsJson:text('events_json').notNull(),updatedAt:text('updated_at').notNull(),
},t=>[primaryKey({columns:[t.source,t.month]})]);

export const nadiInvitations=sqliteTable('nadi_auth_invitations',{
 id:text('id').primaryKey(),accountId:text('account_id').notNull().references(()=>nadiAccounts.id),accountVersion:integer('account_version').notNull(),
 email:text('email').notNull(),payload:text('payload'),status:text('status').notNull(),expiresMs:integer('expires_ms').notNull(),
 lease:text('lease'),leaseUntil:integer('lease_until'),createdAt:text('created_at').notNull(),sentAt:text('sent_at'),
 tokenHash:text('token_hash'),consumedMs:integer('consumed_ms'),auditId:text('audit_id'),format:text('format').notNull().default('legacy'),
},t=>[uniqueIndex('nadi_auth_invitation_version').on(t.accountId,t.accountVersion),index('nadi_auth_invitation_status').on(t.status)]);

export const nadiHrMail=sqliteTable('nadi_auth_hr_mail',{
 id:text('id').primaryKey(),auditId:text('audit_id').notNull(),accountId:text('account_id').notNull(),accountVersion:integer('account_version').notNull(),
 status:text('status').notNull().default('queued'),lease:text('lease'),leaseUntil:integer('lease_until'),createdAt:text('created_at').notNull(),sentAt:text('sent_at'),
},t=>[uniqueIndex('nadi_auth_hr_mail_audit').on(t.auditId),index('nadi_auth_hr_mail_status').on(t.status)]);
