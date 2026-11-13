-- Preserve the issue purpose on each immutable movement, including revisions.
ALTER TABLE stock_ledger ADD COLUMN issue_type VARCHAR(30) NULL;
ALTER TABLE stock_documents ADD COLUMN total_value DECIMAL(24,6) NOT NULL DEFAULT 0;
