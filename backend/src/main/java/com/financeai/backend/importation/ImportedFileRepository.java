package com.financeai.backend.importation;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.UUID;
import java.util.List;
import java.util.Optional;

@Repository
public interface ImportedFileRepository extends JpaRepository<ImportedFile, UUID> {
    boolean existsByUserIdAndContentHash(UUID userId, String contentHash);
    List<ImportedFile> findByUserIdOrderByCreatedAtDesc(UUID userId);
    Optional<ImportedFile> findByIdAndUserId(UUID id, UUID userId);

    @Modifying
    @Query("UPDATE ImportedFile f SET f.defaultSource = false WHERE f.user.id = :userId")
    void clearDefaultForUser(@Param("userId") UUID userId);
}
