package com.financeai.backend.analysis;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

@Repository
public interface FinancialAnalysisRepository extends JpaRepository<FinancialAnalysis, UUID> {

    Optional<FinancialAnalysis> findTopByUserIdOrderByCreatedAtDesc(UUID userId);

    Optional<FinancialAnalysis> findByIdAndUserId(UUID id, UUID userId);

    @Query(value = """
        SELECT analysis.*
        FROM financial_analyses analysis
        WHERE analysis.user_id = :userId
          AND (CAST(:source AS text) IS NULL
               OR analysis.model_versions ->> 'transactionSource' = CAST(:source AS text))
        ORDER BY analysis.created_at DESC
        """, countQuery = """
        SELECT COUNT(*)
        FROM financial_analyses analysis
        WHERE analysis.user_id = :userId
          AND (CAST(:source AS text) IS NULL
               OR analysis.model_versions ->> 'transactionSource' = CAST(:source AS text))
        """, nativeQuery = true)
    Page<FinancialAnalysis> findPageByUserAndSource(
        @Param("userId") UUID userId,
        @Param("source") String source,
        Pageable pageable);

    @Query(value = """
        SELECT analysis.*
        FROM financial_analyses analysis
        WHERE analysis.user_id = :userId
          AND (CAST(:source AS text) IS NULL
               OR analysis.model_versions ->> 'transactionSource' = CAST(:source AS text))
          AND (CAST(:importSourceId AS text) IS NULL
               OR analysis.model_versions ->> 'importSourceId' = CAST(:importSourceId AS text))
        ORDER BY analysis.created_at DESC
        LIMIT 1
        """, nativeQuery = true)
    Optional<FinancialAnalysis> findLatestByUserAndSource(
        @Param("userId") UUID userId,
        @Param("source") String source,
        @Param("importSourceId") String importSourceId);
}
