package com.financeai.backend.analysis;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import com.financeai.backend.transaction.TransactionSource;

public record AnalyzeStoredTransactionsRequest(
    @NotNull(message = "O modelo de análise é obrigatório")
    ProfileAnalysisModel model,

    @NotNull
    TransactionSource source,

    UUID importSourceId,

    @Size(max = 10, message = "O lote pode conter no máximo 10 fontes")
    List<UUID> importSourceIds,

    LocalDate startDate,
    LocalDate endDate
) {
}
