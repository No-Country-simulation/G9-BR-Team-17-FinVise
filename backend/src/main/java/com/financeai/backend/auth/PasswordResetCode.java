package com.financeai.backend.auth;

import jakarta.persistence.*;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "password_reset_codes")
public class PasswordResetCode {

    @Id
    @GeneratedValue
    private UUID id;

    @Column(name = "user_id", nullable = false)
    private UUID userId;

    @Column(name = "code_hash", nullable = false)
    private String codeHash;

    @Column(name = "attempts", nullable = false)
    private short attempts = 0;

    @Column(name = "blocked_until")
    private Instant blockedUntil;

    @Column(name = "expires_at", nullable = false)
    private Instant expiresAt;

    @Column(name = "used_at")
    private Instant usedAt;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt = Instant.now();

    protected PasswordResetCode() {
    }

    public PasswordResetCode(UUID userId, String codeHash, Instant expiresAt) {
        this.userId = userId;
        this.codeHash = codeHash;
        this.expiresAt = expiresAt;
    }

    public boolean isExpired() {
        return Instant.now().isAfter(expiresAt);
    }

    public boolean isUsed() {
        return usedAt != null;
    }

    public boolean isBlocked() {
        return blockedUntil != null && Instant.now().isBefore(blockedUntil);
    }

    public void registerFailedAttempt(short maxAttempts, long blockDurationMinutes) {
        this.attempts++;
        if (this.attempts >= maxAttempts) {
            this.blockedUntil = Instant.now().plusSeconds(blockDurationMinutes * 60);
        }
    }

    public void markAsUsed() {
        this.usedAt = Instant.now();
    }

    // Getters

    public UUID getId() {
        return id;
    }

    public UUID getUserId() {
        return userId;
    }

    public String getCodeHash() {
        return codeHash;
    }

    public short getAttempts() {
        return attempts;
    }

    public Instant getBlockedUntil() {
        return blockedUntil;
    }

    public Instant getExpiresAt() {
        return expiresAt;
    }

    public Instant getUsedAt() {
        return usedAt;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }
}