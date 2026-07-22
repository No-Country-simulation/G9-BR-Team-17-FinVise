package com.financeai.backend.common.exception;

public class EmailAlreadyExistsException extends BusinessException {
    public EmailAlreadyExistsException(String email) {
        super("EMAIL_ALREADY_EXISTS", "Já existe uma conta cadastrada com o e-mail: " + email);
    }
}