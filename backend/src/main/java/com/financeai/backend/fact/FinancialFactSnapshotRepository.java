package com.financeai.backend.fact;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface FinancialFactSnapshotRepository
    extends JpaRepository<FinancialFactSnapshot, UUID> {

    Optional<FinancialFactSnapshot> findByUserIdAndSourceTypeAndSourceId(
        UUID userId, String sourceType, UUID sourceId);

    long deleteByUserIdAndSourceTypeAndSourceId(
        UUID userId, String sourceType, UUID sourceId);
}
