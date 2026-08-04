UPDATE rag_index_jobs job
SET status = 'COMPLETED',
    attempts = 0,
    rerun_requested = FALSE,
    locked_at = NULL,
    lock_token = NULL,
    last_error = NULL,
    updated_at = CURRENT_TIMESTAMP
WHERE job.status = 'FAILED'
  AND NOT EXISTS (
      SELECT 1
      FROM rag_documents document
      WHERE document.user_id = job.user_id
        AND document.index_status <> 'INDEXED'
  );
