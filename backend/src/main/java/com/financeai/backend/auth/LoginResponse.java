package com.financeai.backend.auth;

import java.util.UUID;

public record LoginResponse(
    String token,
    String type,
    UUID userId,
    String email,
    Long expiresInMs
) {
}
