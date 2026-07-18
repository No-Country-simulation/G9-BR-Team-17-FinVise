package com.financeai.backend.transaction;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;

public record TransactionDto(
    UUID id,

    @NotBlank(message = "Descrição é obrigatória")
    String description,

    @NotNull(message = "Valor é obrigatório")
    @Positive(message = "Valor deve ser positivo")
    BigDecimal amount,

    @NotNull(message = "Data é obrigatória")
    LocalDate date,

    @NotNull(message = "Tipo é obrigatório")
    TransactionType type,

    String categoryCode,

    String paymentMethod,

    Boolean recurrent,

    String source
) {
}
