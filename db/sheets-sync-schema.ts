import {sqliteTable,text,integer} from 'drizzle-orm/sqlite-core';
export const sheetSyncState=sqliteTable('sheet_sync_state',{
 id:text('id').primaryKey(),enabled:integer('enabled').notNull().default(0),
 leaseId:text('lease_id'),leaseUntil:integer('lease_until').notNull().default(0),
 lastAttempt:text('last_attempt'),lastSuccess:text('last_success'),runnerSeen:text('runner_seen'),
 lastError:text('last_error'),failures:integer('failures').notNull().default(0),
 nextAttempt:integer('next_attempt').notNull().default(0),updatedBy:text('updated_by'),
});
export const sheetSyncRecords=sqliteTable('sheet_sync_records',{
 key:text('key').primaryKey(),baseJson:text('base_json'),siteJson:text('site_json'),sheetJson:text('sheet_json'),
 issue:text('issue'),resolution:text('resolution'),resolvedBy:text('resolved_by'),updatedAt:text('updated_at').notNull(),
});
export const sheetSyncRuns=sqliteTable('sheet_sync_runs',{
 id:text('id').primaryKey(),startedAt:text('started_at').notNull(),finishedAt:text('finished_at'),
 status:text('status').notNull(),countsJson:text('counts_json'),error:text('error'),actor:text('actor').notNull(),
});
