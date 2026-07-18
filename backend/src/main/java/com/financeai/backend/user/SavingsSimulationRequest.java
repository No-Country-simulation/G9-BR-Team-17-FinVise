package com.financeai.backend.user;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.PositiveOrZero;

import java.math.BigDecimal;

public record SavingsSimulationRequest(
    @NotNull(message = "Renda mensal é obrigatória")
    @Positive(message = "Renda mensal deve ser positiva")
    BigDecimal monthlyIncome,

    @NotNull(message = "Taxa atual de poupança é obrigatória")
    @PositiveOrZero(message = "Taxa atual de poupança não pode ser negativa")
    BigDecimal currentSavingsRate,

    @NotNull(message = "Taxa desejada de poupança é obrigatória")
    @Positive(message = "Taxa desejada de poupança deve ser positiva")
    BigDecimal targetSavingsRate,

    @NotNull(message = "Prazo em meses é obrigatório")
    @Positive(message = "Prazo em meses deve ser positivo")
    Integer months
) {
}
