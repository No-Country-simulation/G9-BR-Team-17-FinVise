package com.financeai.backend.agent;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface AgentConversationRepository extends JpaRepository<AgentConversation, UUID> {

    List<AgentConversation> findByUserIdOrderByCreatedAtDesc(UUID userId);

    Optional<AgentConversation> findByIdAndUserId(UUID id, UUID userId);
}
