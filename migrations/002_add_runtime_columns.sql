ALTER TABLE projects ADD COLUMN figma_url TEXT;
ALTER TABLE projects ADD COLUMN repo_url TEXT;
ALTER TABLE audit_runs ADD COLUMN reference_sync_mode TEXT;
ALTER TABLE audit_runs ADD COLUMN reference_snapshot_source_type TEXT;
ALTER TABLE audit_runs ADD COLUMN source_pr_url TEXT;
ALTER TABLE audit_runs ADD COLUMN source_pr_updated_at TEXT;
ALTER TABLE audit_runs ADD COLUMN pr_selection_mode TEXT;
