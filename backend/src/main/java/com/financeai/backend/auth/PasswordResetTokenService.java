package com.financeai.backend.auth;

import com.financeai.backend.common.exception.PasswordResetCodeException;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.ExpiredJwtException;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import javax.crypto.SecretKey;
import java.time.Instant;
import java.util.Date;
import java.util.UUID;

@Service
public class PasswordResetTokenService {

    private static final String SCOPE_CLAIM = "scope";
    private static final String RESET_SCOPE = "password_reset";
    private static final long EXPIRATION_MINUTES = 5;

    private final SecretKey signingKey;

    public PasswordResetTokenService(@Value("${security.jwt.secret}") String jwtSecret) {
        this.signingKey = Keys.hmacShaKeyFor(jwtSecret.getBytes());
    }

    public String generateToken(UUID userId) {
        Instant now = Instant.now();
        return Jwts.builder()
                .subject(userId.toString())
                .claim(SCOPE_CLAIM, RESET_SCOPE)
                .issuedAt(Date.from(now))
                .expiration(Date.from(now.plusSeconds(EXPIRATION_MINUTES * 60)))
                .signWith(signingKey)
                .compact();
    }

    public UUID validateAndExtractUserId(String token) {
        Claims claims;
        try {
            claims = Jwts.parser()
                    .verifyWith(signingKey)
                    .build()
                    .parseSignedClaims(token)
                    .getPayload();
        } catch (ExpiredJwtException e) {
            throw new PasswordResetCodeException.ResetTokenExpiredException();
        } catch (io.jsonwebtoken.JwtException | IllegalArgumentException e) {
            throw new PasswordResetCodeException.InvalidResetTokenException();
        }

        String scope = claims.get(SCOPE_CLAIM, String.class);
        if (!RESET_SCOPE.equals(scope)) {
            throw new PasswordResetCodeException.InvalidResetTokenException();
        }

        return UUID.fromString(claims.getSubject());
    }
}
