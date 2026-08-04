package com.financeai.backend.agent;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

@Repository
public interface AgentConversationRepository extends JpaRepository<AgentConversation, UUID> {

    Page<AgentConversation> findByUserId(UUID userId, Pageable pageable);

    Optional<AgentConversation> findByIdAndUserId(UUID id, UUID userId);
}
