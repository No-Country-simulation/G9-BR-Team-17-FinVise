package com.financeai.backend.auth;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;

import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

@Service
public class ResendPasswordResetEmailSender implements PasswordResetEmailSender {

    private static final Logger log = LoggerFactory.getLogger(ResendPasswordResetEmailSender.class);
    private static final String RESEND_API_URL = "https://api.resend.com/emails";

    private final RestClient restClient;
    private final String fromAddress;

    public ResendPasswordResetEmailSender(
            @Value("${resend-email.api-key:re_dummy_key}") String apiKey,
            @Value("${resend-email.from-address:onboarding@resend.dev}") String fromAddress
    ) {
        this.fromAddress = fromAddress;
        this.restClient = RestClient.builder()
                .baseUrl(RESEND_API_URL)
                .defaultHeader("Authorization", "Bearer " + apiKey)
                .defaultHeader("Content-Type", MediaType.APPLICATION_JSON_VALUE)
                .build();
    }

    @Override
    @Async
    public void sendResetCode(String toEmail, String code) {
        try {
            Map<String, Object> payload = Map.of(
                    "from", fromAddress,
                    "to", java.util.List.of(toEmail),
                    "subject", "Seu código de recuperação de senha — Finance AI",
                    "html", buildHtmlBody(code)
            );

            restClient.post()
                    .body(payload)
                    .retrieve()
                    .toBodilessEntity();

            // Nunca logar o código em si — apenas confirmação de envio (security.md)
            log.info("E-mail de recuperação de senha enviado com sucesso.");
        } catch (Exception e) {
            // Falha no envio não deve derrubar o fluxo do endpoint (já é assíncrono),
            // mas precisa ficar visível para alerta/monitoramento.
            log.error("Falha ao enviar e-mail de recuperação de senha via Resend.", e);
        }
    }

    private String buildHtmlBody(String code) {
        return """
                <div style="font-family: sans-serif; max-width: 480px; margin: auto;">
                    <h2>Recuperação de senha — Finance AI</h2>
                    <p>Use o código abaixo para continuar a redefinição da sua senha:</p>
                    <p style="font-size: 32px; font-weight: bold; letter-spacing: 6px;">%s</p>
                    <p>Este código expira em 5 minutos. Se você não solicitou essa alteração,
                    ignore este e-mail.</p>
                </div>
                """.formatted(code);
    }
}
