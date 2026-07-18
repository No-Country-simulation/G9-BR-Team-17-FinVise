package com.financeai.backend.analysis;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface FinancialAnalysisRepository extends JpaRepository<FinancialAnalysis, UUID> {

    List<FinancialAnalysis> findByUserIdOrderByCreatedAtDesc(UUID userId);

    Optional<FinancialAnalysis> findTopByUserIdOrderByCreatedAtDesc(UUID userId);

    Optional<FinancialAnalysis> findByIdAndUserId(UUID id, UUID userId);
}
