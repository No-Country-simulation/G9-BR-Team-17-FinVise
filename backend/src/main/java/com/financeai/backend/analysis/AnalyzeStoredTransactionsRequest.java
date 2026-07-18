package com.financeai.backend.analysis;

import jakarta.validation.constraints.NotNull;

import java.time.LocalDate;
import java.util.UUID;
import com.financeai.backend.transaction.TransactionSource;

public record AnalyzeStoredTransactionsRequest(
    @NotNull(message = "O modelo de análise é obrigatório")
    ProfileAnalysisModel model,

    @NotNull
    TransactionSource source,

    UUID importSourceId,

    LocalDate startDate,
    LocalDate endDate
) {
}
