package com.financeai.backend.user;

import java.util.List;

public record FinancialAnalysisHistoryPageResponse(
    List<FinancialAnalysisHistoryDto> content,
    long totalElements,
    int totalPages,
    int size,
    int number
) {
}
