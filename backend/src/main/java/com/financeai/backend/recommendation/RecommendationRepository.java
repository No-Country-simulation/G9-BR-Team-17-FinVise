package com.financeai.backend.recommendation;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Collection;
import java.util.List;
import java.util.UUID;

@Repository
public interface RecommendationRepository extends JpaRepository<Recommendation, UUID> {

    List<Recommendation> findByAnalysisIdOrderByPriorityDesc(UUID analysisId);

    List<Recommendation> findByAnalysis_UserIdOrderByCreatedAtDesc(UUID userId);

    @Query("""
        SELECT
            recommendation.analysis.id AS analysisId,
            recommendation.id AS id,
            recommendation.title AS title,
            recommendation.description AS description,
            recommendation.reason AS reason,
            recommendation.priority AS priority,
            recommendation.category AS category,
            recommendation.expectedImpact AS expectedImpact,
            recommendation.suggestedAmount AS suggestedAmount,
            recommendation.relatedIndicator AS relatedIndicator,
            recommendation.createdAt AS createdAt
        FROM Recommendation recommendation
        WHERE recommendation.analysis.id IN :analysisIds
        """)
    List<RecommendationView> findViewsByAnalysisIds(
        @Param("analysisIds") Collection<UUID> analysisIds);
}
