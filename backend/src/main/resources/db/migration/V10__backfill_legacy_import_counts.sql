WITH single_file_users AS (
    SELECT user_id, MIN(id::text)::uuid AS file_id
    FROM imported_files
    GROUP BY user_id
    HAVING COUNT(*) = 1
), transaction_counts AS (
    SELECT
        single_file_users.file_id,
        COUNT(transactions.id)::integer AS processed_count,
        COUNT(transactions.category_id)::integer AS categorized_count
    FROM single_file_users
    LEFT JOIN transactions
        ON transactions.user_id = single_file_users.user_id
        AND transactions.source = 'CSV_IMPORT'
    GROUP BY single_file_users.file_id
)
UPDATE imported_files
SET
    processed_count = transaction_counts.processed_count,
    categorized_count = transaction_counts.categorized_count
FROM transaction_counts
WHERE imported_files.id = transaction_counts.file_id
  AND imported_files.processed_count = 0;
