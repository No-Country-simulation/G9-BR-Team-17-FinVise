package com.financeai.backend.auth;


import com.financeai.backend.user.User;

import java.time.Instant;

public record RegisterResponse(
        String email,
        boolean isEmailVerified,
        Instant createdAt
) {
    public static RegisterResponse from(User user) {
        return new RegisterResponse(
                user.getEmail(),
                false,
                user.getCreatedAt()
        );
    }
}