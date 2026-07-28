package com.financeai.backend.auth;

public interface PasswordResetEmailSender {
    void sendResetCode(String toEmail, String code);
}
