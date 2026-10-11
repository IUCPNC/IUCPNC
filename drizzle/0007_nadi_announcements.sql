CREATE TABLE IF NOT EXISTS nadi_announcements (
 id TEXT PRIMARY KEY NOT NULL,
 title TEXT NOT NULL,
 body TEXT NOT NULL,
 category TEXT NOT NULL DEFAULT 'University update',
 published_at TEXT NOT NULL,
 published_by TEXT NOT NULL,
 archived_at TEXT,
 archived_by TEXT
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS nadi_announcements_recent ON nadi_announcements (published_at DESC) WHERE archived_at IS NULL;
