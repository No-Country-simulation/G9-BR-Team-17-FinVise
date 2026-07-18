package com.financeai.backend.openfinance;

import com.financeai.backend.analysis.ProfileAnalysisModel;
import jakarta.validation.constraints.NotNull;

public record OpenFinanceSyncRequest(
    @NotNull ProfileAnalysisModel model
) {
}
