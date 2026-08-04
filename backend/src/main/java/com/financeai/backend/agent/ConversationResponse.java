package com.financeai.backend.agent;

import java.time.Instant;
import java.util.List;
import java.util.UUID;
import com.financeai.backend.transaction.TransactionSource;

public record ConversationResponse(
    UUID id,
    UUID userId,
    String title,
    ConversationStatus status,
    TransactionSource source,
    List<UUID> sourceIds,
    int topK,
    List<AgentMessageDto> messages,
    long totalMessages,
    int messagePage,
    int messageSize,
    boolean hasOlderMessages,
    Instant createdAt
) {
}
