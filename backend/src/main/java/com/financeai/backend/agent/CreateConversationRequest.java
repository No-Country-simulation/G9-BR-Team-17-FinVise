package com.financeai.backend.agent;

import com.financeai.backend.transaction.TransactionSource;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Size;

import java.util.List;
import java.util.UUID;

public record CreateConversationRequest(
    @NotNull
    TransactionSource source,

    String title,

    @Size(max = 100)
    List<UUID> sourceIds,

    @Min(1)
    @Max(20)
    Integer topK
) {
}
