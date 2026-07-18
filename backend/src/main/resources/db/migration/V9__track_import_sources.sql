ALTER TABLE imported_files
    ADD COLUMN IF NOT EXISTS processed_count INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS categorized_count INTEGER NOT NULL DEFAULT 0;

ALTER TABLE open_finance_connections
    ADD COLUMN IF NOT EXISTS display_name VARCHAR(255);
