package com.financeai.backend.openfinance;

import com.financeai.backend.analysis.AnalysisResponse;

public record OpenFinanceSyncResponse(
    int importedCount,
    int skippedCount,
    AnalysisResponse analysis
) {
}
