package com.financeai.backend.agent;

import java.util.List;

public record ConversationPageResponse(
    List<ConversationResponse> content,
    long totalElements,
    int totalPages,
    int size,
    int number
) {
}
