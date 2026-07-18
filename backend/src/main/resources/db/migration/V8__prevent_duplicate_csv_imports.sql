ALTER TABLE imported_files
    ADD COLUMN IF NOT EXISTS content_hash VARCHAR(64);

CREATE UNIQUE INDEX IF NOT EXISTS uq_imported_files_user_content_hash
    ON imported_files(user_id, content_hash)
    WHERE content_hash IS NOT NULL;
