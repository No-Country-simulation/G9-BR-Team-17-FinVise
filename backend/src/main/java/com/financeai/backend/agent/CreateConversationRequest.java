package com.financeai.backend.agent;

import com.financeai.backend.transaction.TransactionSource;
import jakarta.validation.constraints.NotNull;

public record CreateConversationRequest(
    @NotNull
    TransactionSource source,

    String title
) {
}
