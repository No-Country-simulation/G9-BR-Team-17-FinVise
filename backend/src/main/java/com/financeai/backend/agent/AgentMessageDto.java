package com.financeai.backend.agent;

import java.time.Instant;
import java.util.UUID;

public record AgentMessageDto(
    UUID id,
    UUID conversationId,
    String role,
    String content,
    String toolCalls,
    String ragSources,
    Instant createdAt
) {
}
