package com.financeai.backend.rag;

import java.util.List;
import java.util.UUID;

public record RagIndexRequestedEvent(
    UUID userId,
    List<String> sourceIds
) {
}
