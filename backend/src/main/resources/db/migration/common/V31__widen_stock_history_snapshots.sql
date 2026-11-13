-- A 100-line document and its immutable before/after snapshots can exceed MySQL TEXT's 64 KiB limit.
ALTER TABLE stock_documents MODIFY COLUMN current_snapshot LONGTEXT NOT NULL;
ALTER TABLE stock_revisions MODIFY COLUMN before_snapshot LONGTEXT NULL;
ALTER TABLE stock_revisions MODIFY COLUMN snapshot LONGTEXT NOT NULL;
ALTER TABLE stock_revisions MODIFY COLUMN effects LONGTEXT NOT NULL;
ALTER TABLE stock_commands MODIFY COLUMN result_snapshot LONGTEXT NOT NULL;
