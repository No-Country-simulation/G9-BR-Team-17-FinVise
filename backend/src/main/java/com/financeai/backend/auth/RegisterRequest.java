package com.financeai.backend.auth;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record RegisterRequest(

        @NotBlank(message = "Nome é obrigatório")
        @Size(min = 2, max = 150)
        String fullName,

        @NotBlank(message = "E-mail é obrigatório")
        @Email
        String email,

        @NotBlank(message = "Senha é obrigatória")
        @Size(min = 8, max = 100)
        String password
) {
}
