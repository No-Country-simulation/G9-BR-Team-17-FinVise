package com.financeai.backend.recommendation;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface RecommendationRepository extends JpaRepository<Recommendation, UUID> {

    List<Recommendation> findByAnalysisIdOrderByPriorityDesc(UUID analysisId);

    List<Recommendation> findByAnalysis_UserIdOrderByCreatedAtDesc(UUID userId);
}
