package com.financeai.backend.rag;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface RagDocumentRepository extends JpaRepository<RagDocument, UUID> {

    List<RagDocument> findByUserIdOrderByCreatedAtDesc(UUID userId);

    void deleteByUserIdAndSourceTypeAndSourceId(UUID userId, String sourceType, String sourceId);

    void deleteByUserId(UUID userId);
}
