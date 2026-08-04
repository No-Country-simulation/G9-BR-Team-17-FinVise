package com.financeai.backend.indicator;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Collection;
import java.util.List;
import java.util.UUID;

@Repository
public interface SpendingSummaryRepository extends JpaRepository<SpendingSummary, UUID> {

    List<SpendingSummary> findByAnalysisId(UUID analysisId);

    @Query("""
        SELECT
            summary.analysis.id AS analysisId,
            summary.categoryCode AS categoryCode,
            summary.amount AS amount,
            summary.percentage AS percentage
        FROM SpendingSummary summary
        WHERE summary.analysis.id IN :analysisIds
        """)
    List<SpendingSummaryView> findViewsByAnalysisIds(
        @Param("analysisIds") Collection<UUID> analysisIds);
}
