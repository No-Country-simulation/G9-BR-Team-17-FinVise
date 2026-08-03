package com.financeai.backend.rag;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.UUID;

public interface RagDocumentRepository extends JpaRepository<RagDocument, UUID> {

    List<RagDocument> findByUserIdOrderByCreatedAtDesc(UUID userId);

    void deleteByUserIdAndSourceTypeAndSourceId(UUID userId, String sourceType, String sourceId);

    List<RagDocument> findByUserIdAndSourceTypeAndSourceId(
        UUID userId, String sourceType, String sourceId);

    @Query("""
        select new com.financeai.backend.rag.RagIndexStatusCount(r.indexStatus, count(r))
        from RagDocument r
        where r.userId = :userId
        group by r.indexStatus
        """)
    List<RagIndexStatusCount> summarizeIndexStatusByUserId(
        @Param("userId") UUID userId);

    @Query("""
        select new com.financeai.backend.rag.RagIndexStatusCount(r.indexStatus, count(r))
        from RagDocument r
        where r.userId = :userId
          and r.sourceId in :sourceIds
        group by r.indexStatus
        """)
    List<RagIndexStatusCount> summarizeIndexStatusByUserIdAndSourceIdIn(
        @Param("userId") UUID userId,
        @Param("sourceIds") List<String> sourceIds);

    void deleteByUserId(UUID userId);
}
