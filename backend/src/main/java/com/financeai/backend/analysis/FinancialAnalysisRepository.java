package com.financeai.backend.analysis;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
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

    @Modifying
    @Query(value = """
        WITH target_analyses AS (
            SELECT id FROM financial_analyses
            WHERE user_id = :userId
              AND model_versions ->> 'importSourceId' = CAST(:importSourceId AS text)
        ),
        deleted_indicators AS (
            DELETE FROM financial_indicators WHERE analysis_id IN (SELECT id FROM target_analyses)
        ),
        deleted_summaries AS (
            DELETE FROM spending_summaries WHERE analysis_id IN (SELECT id FROM target_analyses)
        ),
        deleted_recommendations AS (
            DELETE FROM recommendations WHERE analysis_id IN (SELECT id FROM target_analyses)
        )
        DELETE FROM financial_analyses WHERE id IN (SELECT id FROM target_analyses)
        """, nativeQuery = true)
    void deleteByUserIdAndImportSourceId(
        @Param("userId") UUID userId,
        @Param("importSourceId") String importSourceId);
}
