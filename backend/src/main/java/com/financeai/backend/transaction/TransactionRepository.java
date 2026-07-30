package com.financeai.backend.transaction;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

@Repository
public interface TransactionRepository extends JpaRepository<Transaction, UUID>, JpaSpecificationExecutor<Transaction> {

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

    long deleteByUserIdAndImportSourceId(UUID userId, UUID importSourceId);

    @Query("SELECT COUNT(t) FROM Transaction t WHERE t.user.id = :userId " +
        "AND t.source = :source AND t.externalId LIKE CONCAT(:itemId, ':%')")
    long countByOpenFinanceItem(@Param("userId") UUID userId,
                                @Param("source") String source,
                                @Param("itemId") String itemId);
}
