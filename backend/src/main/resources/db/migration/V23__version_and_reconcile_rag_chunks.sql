ALTER TABLE rag_documents
    ADD COLUMN IF NOT EXISTS chunk_key VARCHAR(200),
    ADD COLUMN IF NOT EXISTS schema_version VARCHAR(20) NOT NULL DEFAULT '2.0';

UPDATE rag_documents
SET chunk_key = CASE
    WHEN transaction_id IS NOT NULL THEN 'transaction:' || transaction_id::text
    WHEN chunk_type = 'MONTHLY_SUMMARY' THEN
        'monthly-summary:' || COALESCE(metadata ->> 'period', id::text)
    WHEN chunk_type = 'CATEGORY_SUMMARY' THEN
        'category-summary:' || COALESCE(metadata ->> 'period', 'unknown') || ':'
            || md5(COALESCE(metadata ->> 'category', id::text))
    WHEN chunk_type = 'FINANCIAL_OVERVIEW' THEN 'financial-overview'
    WHEN chunk_type = 'MONTHLY_FACT' THEN
        'monthly-fact:' || COALESCE(metadata ->> 'period', id::text)
    WHEN chunk_type = 'CATEGORY_FACT' THEN
        'category-fact:' || COALESCE(metadata ->> 'categoryCode', id::text)
    WHEN chunk_type = 'FINANCIAL_RANKING' THEN 'financial-ranking'
    ELSE 'legacy:' || id::text
END
WHERE chunk_key IS NULL;

WITH duplicate_chunks AS (
    SELECT id,
           ROW_NUMBER() OVER (
               PARTITION BY user_id, source_type, source_id, chunk_key
               ORDER BY created_at DESC, id DESC
           ) AS duplicate_number
    FROM rag_documents
)
DELETE FROM rag_documents
WHERE id IN (
    SELECT id
    FROM duplicate_chunks
    WHERE duplicate_number > 1
);

ALTER TABLE rag_documents
    ALTER COLUMN chunk_key SET NOT NULL;

DROP INDEX IF EXISTS uq_rag_documents_derived_chunk;

CREATE UNIQUE INDEX IF NOT EXISTS uq_rag_documents_chunk_key
    ON rag_documents(user_id, source_type, source_id, chunk_key);
