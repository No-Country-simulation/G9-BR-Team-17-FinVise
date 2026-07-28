package com.financeai.backend.auth;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;

public record ValidateResetCodeRequest(
        @NotBlank
        @Email
        String email,

        @NotBlank
        @Pattern(regexp = "\\d{6}", message = "O código deve conter exatamente 6 dígitos numéricos.")
        String code
) {
}
