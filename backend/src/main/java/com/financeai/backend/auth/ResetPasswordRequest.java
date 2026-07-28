package com.financeai.backend.auth;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record ResetPasswordRequest(

        @NotBlank
        @Size(min = 8, message = "A senha deve ter no mínimo 8 caracteres.")
        String newPassword
) {
}