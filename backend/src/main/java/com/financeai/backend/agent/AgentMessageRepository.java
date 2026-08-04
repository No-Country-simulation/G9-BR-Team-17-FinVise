package com.financeai.backend.agent;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface AgentMessageRepository extends JpaRepository<AgentMessage, UUID> {

    @Query("""
        SELECT message
        FROM AgentMessage message
        WHERE message.conversation.id = :conversationId
        ORDER BY message.createdAt ASC, message.id ASC
        """)
    List<AgentMessage> findByConversationIdOrderByCreatedAtAsc(
        @Param("conversationId") UUID conversationId);

    Page<AgentMessage> findByConversationId(UUID conversationId, Pageable pageable);

    @Query(value = """
        SELECT * FROM agent_messages message
        WHERE message.conversation_id = :conversationId
          AND (:afterCreatedAt IS NULL
               OR message.created_at > :afterCreatedAt
               OR (message.created_at = :afterCreatedAt AND message.id > :afterMessageId))
          AND (message.created_at < :beforeCreatedAt
               OR (message.created_at = :beforeCreatedAt AND message.id < :beforeMessageId))
        ORDER BY message.created_at ASC, message.id ASC
        """, nativeQuery = true)
    List<AgentMessage> findSummaryCandidates(
        @Param("conversationId") UUID conversationId,
        @Param("afterCreatedAt") java.time.Instant afterCreatedAt,
        @Param("afterMessageId") UUID afterMessageId,
        @Param("beforeCreatedAt") java.time.Instant beforeCreatedAt,
        @Param("beforeMessageId") UUID beforeMessageId,
        Pageable pageable);
}
