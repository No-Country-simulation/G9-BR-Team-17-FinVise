package com.financeai.backend.auth;


import com.financeai.backend.user.User;

import java.time.Instant;
import java.util.UUID;


public record RegisterResponse(
        UUID userId,
        String email,
        boolean isEmailVerified,
        Instant createdAt
) {
    public static RegisterResponse from(User user) {
        return new RegisterResponse(user.getId(), user.getEmail(), false, user.getCreatedAt());
    }
}