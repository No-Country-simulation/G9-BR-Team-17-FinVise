package com.financeai.backend.rag;

import java.util.UUID;

public record RagIndexJob(
    UUID id,
    UUID userId,
    UUID lockToken,
    int attempts
) {
}
