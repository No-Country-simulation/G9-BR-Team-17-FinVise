package com.financeai.backend.openfinance;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface OpenFinanceConnectionRepository extends JpaRepository<OpenFinanceConnection, UUID> {
    Optional<OpenFinanceConnection> findByProviderAndExternalItemId(String provider, String externalItemId);

    @Query("SELECT c.user.id FROM OpenFinanceConnection c " +
        "WHERE c.provider = :provider AND c.externalItemId = :externalItemId")
    Optional<UUID> findOwnerIdByProviderAndExternalItemId(
        @Param("provider") String provider,
        @Param("externalItemId") String externalItemId);
    List<OpenFinanceConnection> findByUserIdOrderByCreatedAtDesc(UUID userId);
    Optional<OpenFinanceConnection> findByIdAndUserId(UUID id, UUID userId);

    @Modifying
    @Query("UPDATE OpenFinanceConnection c SET c.defaultSource = false WHERE c.user.id = :userId")
    void clearDefaultForUser(@Param("userId") UUID userId);
}
