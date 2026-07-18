package com.financeai.backend.analysis;

import com.financeai.backend.common.validation.ValidEnum;
import com.financeai.backend.transaction.TransactionDto;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.PositiveOrZero;

import java.math.BigDecimal;
import java.util.List;

public record CreateAnalysisRequest(
    @NotNull(message = "Renda mensal é obrigatória")
    @Positive(message = "Renda mensal deve ser positiva")
    BigDecimal monthlyIncome,

    @NotNull(message = "Nível de endividamento é obrigatório")
    @PositiveOrZero(message = "Nível de endividamento não pode ser negativo")
    BigDecimal debtLevelPercentage,

    @NotNull(message = "Frequência de poupança é obrigatória")
    @ValidEnum(enumClass = SavingFrequency.class, message = "Frequência de poupança inválida")
    String savingFrequency,

    @NotNull(message = "Reserva financeira é obrigatória")
    @PositiveOrZero(message = "Reserva financeira não pode ser negativa")
    BigDecimal financialReserve,

    @NotEmpty(message = "A lista de transações é obrigatória")
    @Valid
    List<TransactionDto> transactions
) {
}
