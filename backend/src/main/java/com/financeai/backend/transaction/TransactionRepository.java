package com.financeai.backend.transaction;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.math.BigDecimal;
import java.util.List;
import java.util.Set;
import java.util.UUID;

@Repository
public interface TransactionRepository extends JpaRepository<Transaction, UUID>, JpaSpecificationExecutor<Transaction> {

    interface TotalsProjection {
        BigDecimal getTotalIncome();
        BigDecimal getTotalExpense();
    }

    interface MonthlyTotalsProjection {
        String getMonthValue();
        BigDecimal getIncome();
        BigDecimal getExpense();
    }

    interface CategoryTotalProjection {
        String getCategoryCode();
        BigDecimal getAmount();
    }

    List<Transaction> findByUserIdOrderByTransactionDateDesc(UUID userId);

    List<Transaction> findByUserIdAndSourceOrderByTransactionDateDesc(UUID userId, String source);

    List<Transaction> findByUserIdAndSourceAndImportSourceIdInOrderByTransactionDateDesc(
        UUID userId, String source, List<UUID> importSourceIds);

    List<Transaction> findByUserIdAndImportSourceIdOrderByTransactionDateDesc(UUID userId, UUID importSourceId);

    List<Transaction> findByUserIdAndTransactionDateBetweenOrderByTransactionDateDesc(
        UUID userId, LocalDate start, LocalDate end);

    List<Transaction> findByUserIdAndSourceAndTransactionDateBetweenOrderByTransactionDateDesc(
        UUID userId, String source, LocalDate start, LocalDate end);

    @Query("SELECT t FROM Transaction t WHERE t.user.id = :userId AND t.categoryId IS NULL")
    List<Transaction> findUnclassifiedByUserId(@Param("userId") UUID userId);

    List<Transaction> findByUserIdAndType(UUID userId, TransactionType type);

    List<Transaction> findByUserIdAndSourceAndCategoryId(UUID userId, String source, UUID categoryId);

    boolean existsByUserIdAndSourceAndExternalId(UUID userId, String source, String externalId);

    boolean existsByUserIdAndSource(UUID userId, String source);

    boolean existsByUserId(UUID userId);

    @Query("SELECT t.externalId FROM Transaction t WHERE t.user.id = :userId " +
        "AND t.source = :source AND t.externalId IN :externalIds")
    Set<String> findExistingExternalIds(@Param("userId") UUID userId,
                                        @Param("source") String source,
                                        @Param("externalIds") List<String> externalIds);

    long deleteByUserIdAndImportSourceId(UUID userId, UUID importSourceId);

    @Query("SELECT COUNT(t) FROM Transaction t WHERE t.user.id = :userId " +
        "AND t.source = :source AND t.externalId LIKE CONCAT(:itemId, ':%')")
    long countByOpenFinanceItem(@Param("userId") UUID userId,
                                @Param("source") String source,
                                @Param("itemId") String itemId);

    @Query(value = """
        SELECT
            COALESCE(SUM(t.amount) FILTER (WHERE t.type = 'INCOME'), 0) AS "totalIncome",
            COALESCE(SUM(t.amount) FILTER (WHERE t.type = 'EXPENSE'), 0) AS "totalExpense"
        FROM transactions t
        WHERE t.user_id = :userId
          AND (CAST(:source AS text) IS NULL OR t.source = CAST(:source AS text))
          AND (CAST(:importSourceId AS text) IS NULL
               OR t.import_source_id = CAST(:importSourceId AS uuid))
        """, nativeQuery = true)
    TotalsProjection summarize(@Param("userId") UUID userId,
                               @Param("source") String source,
                               @Param("importSourceId") String importSourceId);

    @Query(value = """
        SELECT
            TO_CHAR(DATE_TRUNC('month', t.transaction_date), 'YYYY-MM') AS "monthValue",
            COALESCE(SUM(t.amount) FILTER (WHERE t.type = 'INCOME'), 0) AS "income",
            COALESCE(SUM(t.amount) FILTER (WHERE t.type = 'EXPENSE'), 0) AS "expense"
        FROM transactions t
        WHERE t.user_id = :userId
          AND (CAST(:source AS text) IS NULL OR t.source = CAST(:source AS text))
          AND (CAST(:importSourceId AS text) IS NULL
               OR t.import_source_id = CAST(:importSourceId AS uuid))
        GROUP BY DATE_TRUNC('month', t.transaction_date)
        ORDER BY DATE_TRUNC('month', t.transaction_date)
        """, nativeQuery = true)
    List<MonthlyTotalsProjection> summarizeByMonth(@Param("userId") UUID userId,
                                                   @Param("source") String source,
                                                   @Param("importSourceId") String importSourceId);

    @Query(value = """
        SELECT
            COALESCE(category.code, 'OUTROS') AS "categoryCode",
            COALESCE(SUM(t.amount), 0) AS "amount"
        FROM transactions t
        LEFT JOIN transaction_categories category ON category.id = t.category_id
        WHERE t.user_id = :userId
          AND t.type = 'EXPENSE'
          AND (CAST(:source AS text) IS NULL OR t.source = CAST(:source AS text))
          AND (CAST(:importSourceId AS text) IS NULL
               OR t.import_source_id = CAST(:importSourceId AS uuid))
        GROUP BY COALESCE(category.code, 'OUTROS')
        ORDER BY COALESCE(SUM(t.amount), 0) DESC
        """, nativeQuery = true)
    List<CategoryTotalProjection> summarizeExpensesByCategory(
        @Param("userId") UUID userId,
        @Param("source") String source,
        @Param("importSourceId") String importSourceId);
}
