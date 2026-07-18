package com.financeai.backend.importation;

import java.util.List;
import java.util.UUID;

public record ImportResultResponse(
    UUID id,
    String originalName,
    String storedName,
    ImportStatus status,
    int processedCount,
    int categorizedCount,
    String classificationModel,
    List<String> errors
) {
}
