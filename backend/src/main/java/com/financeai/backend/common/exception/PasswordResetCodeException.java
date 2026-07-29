package com.financeai.backend.common.exception;

public class PasswordResetCodeException {

    public static class InvalidResetCodeException extends BusinessException {
        public InvalidResetCodeException() {
            super("CODE_INVALID", "Código inválido.");
        }
    }

    public static class ResetCodeExpiredException extends BusinessException {
        public ResetCodeExpiredException() {
            super("CODE_EXPIRED", "O código expirou. Solicite um novo.");
        }
    }

    public static class TooManyAttemptsException extends BusinessException {
        public TooManyAttemptsException() {
            super("TOO_MANY_ATTEMPTS",
                    "Número máximo de tentativas excedido. Tente novamente mais tarde.");
        }
    }

    public static class InvalidResetTokenException extends BusinessException {
        public InvalidResetTokenException() {
            super("TOKEN_INVALID", "Token de redefinição inválido ou já utilizado.");
        }
    }

    public static class ResetTokenExpiredException extends BusinessException {
        public ResetTokenExpiredException() {
            super("TOKEN_EXPIRED", "O token de redefinição expirou.");
        }
    }

    private PasswordResetCodeException() {
    }
}