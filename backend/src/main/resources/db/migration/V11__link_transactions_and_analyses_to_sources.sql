ALTER TABLE transactions
    ADD COLUMN IF NOT EXISTS import_source_id UUID;

ALTER TABLE imported_files
    ADD COLUMN IF NOT EXISTS is_default BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE open_finance_connections
    ADD COLUMN IF NOT EXISTS is_default BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_transactions_user_import_source
    ON transactions(user_id, import_source_id, transaction_date DESC);

UPDATE transactions txn
SET import_source_id = imported_file.id
FROM imported_files imported_file
WHERE txn.import_source_id IS NULL
  AND txn.source = 'CSV_IMPORT'
  AND txn.user_id = imported_file.user_id
  AND txn.created_at BETWEEN imported_file.created_at AND imported_file.updated_at + INTERVAL '2 seconds';

UPDATE transactions txn
SET import_source_id = connection.id
FROM open_finance_connections connection
WHERE txn.import_source_id IS NULL
  AND txn.source = 'OPEN_FINANCE_PLUGGY'
  AND txn.user_id = connection.user_id
  AND txn.external_id LIKE connection.external_item_id || ':%';

WITH csv_analysis_matches AS (
    SELECT
        analysis.id AS analysis_id,
        (
            SELECT imported_file.id
            FROM imported_files imported_file
            WHERE imported_file.user_id = analysis.user_id
              AND imported_file.updated_at <= analysis.created_at
            ORDER BY imported_file.updated_at DESC
            LIMIT 1
        ) AS source_id
    FROM financial_analyses analysis
    WHERE analysis.model_versions ->> 'transactionSource' = 'CSV_IMPORT'
      AND NOT analysis.model_versions ? 'importSourceId'
)
UPDATE financial_analyses analysis
SET model_versions = jsonb_set(
    COALESCE(analysis.model_versions, '{}'::jsonb),
    '{importSourceId}',
    to_jsonb(matches.source_id::text)
)
FROM csv_analysis_matches matches
WHERE analysis.id = matches.analysis_id
  AND matches.source_id IS NOT NULL;

WITH open_finance_analysis_matches AS (
    SELECT
        analysis.id AS analysis_id,
        (
            SELECT connection.id
            FROM open_finance_connections connection
            WHERE connection.user_id = analysis.user_id
              AND connection.last_sync_at <= analysis.created_at
            ORDER BY connection.last_sync_at DESC
            LIMIT 1
        ) AS source_id
    FROM financial_analyses analysis
    WHERE analysis.model_versions ->> 'transactionSource' = 'OPEN_FINANCE_PLUGGY'
      AND NOT analysis.model_versions ? 'importSourceId'
)
UPDATE financial_analyses analysis
SET model_versions = jsonb_set(
    COALESCE(analysis.model_versions, '{}'::jsonb),
    '{importSourceId}',
    to_jsonb(matches.source_id::text)
)
FROM open_finance_analysis_matches matches
WHERE analysis.id = matches.analysis_id
  AND matches.source_id IS NOT NULL;
