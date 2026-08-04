package com.financeai.backend.openfinance;

import com.financeai.backend.transaction.Transaction;
import org.springframework.jdbc.core.ConnectionCallback;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import java.sql.Date;
import java.sql.Timestamp;
import java.sql.Types;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Repository
public class OpenFinanceTransactionWriter {

    private static final int BATCH_SIZE = 500;

    private final JdbcTemplate jdbcTemplate;

    public OpenFinanceTransactionWriter(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    public void lockConnection(String provider, String externalItemId) {
        jdbcTemplate.execute((ConnectionCallback<Void>) connection -> {
            try (var statement = connection.prepareStatement(
                "SELECT pg_advisory_xact_lock(hashtextextended(?, 0))")) {
                statement.setString(1, provider + ":" + externalItemId);
                statement.execute();
            }
            return null;
        });
    }

    public int insertIgnoringConflicts(UUID userId,
                                       UUID importSourceId,
                                       List<Transaction> transactions) {
        if (transactions.isEmpty()) {
            return 0;
        }

        String sql = """
            INSERT INTO transactions (
                id, user_id, category_id, description, amount, transaction_date,
                type, payment_method, recurrent, source, external_id,
                import_source_id, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT DO NOTHING
            """;
        Instant now = Instant.now();
        int[][] results = jdbcTemplate.batchUpdate(
            sql,
            transactions,
            BATCH_SIZE,
            (statement, transaction) -> {
                UUID transactionId = UUID.randomUUID();
                transaction.setId(transactionId);
                statement.setObject(1, transactionId);
                statement.setObject(2, userId);
                if (transaction.getCategoryId() != null) {
                    statement.setObject(3, transaction.getCategoryId());
                } else {
                    statement.setNull(3, Types.OTHER);
                }
                statement.setString(4, transaction.getDescription());
                statement.setBigDecimal(5, transaction.getAmount());
                statement.setDate(6, Date.valueOf(transaction.getTransactionDate()));
                statement.setString(7, transaction.getType().name());
                if (transaction.getPaymentMethod() != null) {
                    statement.setString(8, transaction.getPaymentMethod());
                } else {
                    statement.setNull(8, Types.VARCHAR);
                }
                statement.setBoolean(9, Boolean.TRUE.equals(transaction.getRecurrent()));
                statement.setString(10, transaction.getSource());
                statement.setString(11, transaction.getExternalId());
                statement.setObject(12, importSourceId);
                statement.setTimestamp(13, Timestamp.from(now));
                statement.setTimestamp(14, Timestamp.from(now));
            });

        int inserted = 0;
        for (int[] batch : results) {
            for (int result : batch) {
                if (result > 0 || result == java.sql.Statement.SUCCESS_NO_INFO) {
                    inserted++;
                }
            }
        }
        return inserted;
    }
}
