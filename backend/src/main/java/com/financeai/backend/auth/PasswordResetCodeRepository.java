package com.financeai.backend.auth;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

import java.time.Instant;
import java.util.Optional;
import java.util.UUID;

public interface PasswordResetCodeRepository extends JpaRepository<PasswordResetCode, UUID> {

    Optional<PasswordResetCode> findFirstByUserIdAndUsedAtIsNullOrderByCreatedAtDesc(UUID userId);

    @Modifying
    @Query("UPDATE PasswordResetCode p SET p.usedAt = :now WHERE p.userId = :userId AND p.usedAt IS NULL")
    void invalidateActiveCodes(UUID userId, Instant now);
}
