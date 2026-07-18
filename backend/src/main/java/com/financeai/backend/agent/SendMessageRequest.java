package com.financeai.backend.agent;

import jakarta.validation.constraints.NotBlank;

public record SendMessageRequest(
    @NotBlank(message = "Conteúdo da mensagem é obrigatório")
    String content
) {
}
