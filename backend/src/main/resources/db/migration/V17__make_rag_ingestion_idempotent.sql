ALTER TABLE rag_documents
    ADD COLUMN IF NOT EXISTS transaction_id UUID;

UPDATE rag_documents
SET transaction_id = (metadata ->> 'transactionId')::UUID
WHERE transaction_id IS NULL
  AND metadata ->> 'transactionId' ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$';

WITH duplicate_documents AS (
    SELECT id,
           ROW_NUMBER() OVER (
               PARTITION BY user_id, source_type, source_id, transaction_id
               ORDER BY created_at, id
           ) AS duplicate_number
    FROM rag_documents
    WHERE transaction_id IS NOT NULL
)
DELETE FROM rag_documents
WHERE id IN (
    SELECT id
    FROM duplicate_documents
    WHERE duplicate_number > 1
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_rag_documents_transaction
    ON rag_documents(user_id, source_type, source_id, transaction_id)
    WHERE transaction_id IS NOT NULL;
