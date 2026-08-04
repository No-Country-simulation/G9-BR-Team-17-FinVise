package com.financeai.backend.agent;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
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
}
