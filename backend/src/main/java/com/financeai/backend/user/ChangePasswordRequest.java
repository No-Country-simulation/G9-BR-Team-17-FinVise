package com.financeai.backend.user;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record ChangePasswordRequest(
    @NotBlank(message = "Senha atual é obrigatória")
    String currentPassword,

    @NotBlank(message = "Nova senha é obrigatória")
    @Size(min = 8, max = 100, message = "A nova senha deve ter entre 8 e 100 caracteres")
    String newPassword
) {
}
