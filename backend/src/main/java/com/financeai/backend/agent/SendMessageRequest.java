package com.financeai.backend.agent;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.util.UUID;

public record SendMessageRequest(
    @NotBlank(message = "Conteúdo da mensagem é obrigatório")
    String content,
    @NotNull(message = "Identificador idempotente da mensagem é obrigatório")
    UUID clientMessageId
) {
}
