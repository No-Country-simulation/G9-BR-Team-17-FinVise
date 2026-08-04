package com.financeai.backend.analysis;

import java.util.List;

public record AnalysisPageResponse(
    List<AnalysisResponse> content,
    long totalElements,
    int totalPages,
    int size,
    int number
) {
}
