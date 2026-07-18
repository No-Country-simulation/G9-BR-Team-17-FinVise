package com.financeai.backend.indicator;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

@Repository
public interface FinancialIndicatorRepository extends JpaRepository<FinancialIndicator, UUID> {

    Optional<FinancialIndicator> findByAnalysisId(UUID analysisId);
}
