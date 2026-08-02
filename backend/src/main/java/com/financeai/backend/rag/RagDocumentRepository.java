package com.financeai.backend.rag;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Set;
import java.util.UUID;

public interface RagDocumentRepository extends JpaRepository<RagDocument, UUID> {

    List<RagDocument> findByUserIdOrderByCreatedAtDesc(UUID userId);

    void deleteByUserIdAndSourceTypeAndSourceId(UUID userId, String sourceType, String sourceId);

    @Modifying
    @Query("""
        delete from RagDocument r
        where r.userId = :userId
          and r.sourceType = :sourceType
          and r.sourceId = :sourceId
          and r.chunkType <> :chunkType
        """)
    int deleteDerivedChunks(@Param("userId") UUID userId,
                            @Param("sourceType") String sourceType,
                            @Param("sourceId") String sourceId,
                            @Param("chunkType") String chunkType);

    @Query("""
        select r.transactionId
        from RagDocument r
        where r.userId = :userId
          and r.sourceType = :sourceType
          and r.sourceId = :sourceId
          and r.transactionId is not null
        """)
    Set<UUID> findTransactionIdsBySource(@Param("userId") UUID userId,
                                         @Param("sourceType") String sourceType,
                                         @Param("sourceId") String sourceId);

    long countByUserId(UUID userId);

    long countByUserIdAndIndexStatus(UUID userId, RagIndexStatus indexStatus);

    long countByUserIdAndSourceIdIn(UUID userId, List<String> sourceIds);

    long countByUserIdAndSourceIdInAndIndexStatus(
        UUID userId, List<String> sourceIds, RagIndexStatus indexStatus);

    void deleteByUserId(UUID userId);
}
