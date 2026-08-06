package com.financeai.backend;

import com.financeai.backend.auth.PasswordResetCode;
import com.financeai.backend.auth.PasswordResetCodeRepository;
import com.financeai.backend.auth.PasswordResetEmailSender;
import com.financeai.backend.auth.PasswordResetService;
import com.financeai.backend.auth.PasswordResetTokenService;
import com.financeai.backend.common.exception.PasswordResetCodeException;
import com.financeai.backend.user.User;
import com.financeai.backend.user.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.util.ReflectionTestUtils;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Instant;
import java.util.HexFormat;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class PasswordResetServiceTest {

    @Mock private UserRepository users;
    @Mock private PasswordResetCodeRepository codes;
    @Mock private PasswordResetTokenService tokens;
    @Mock private PasswordResetEmailSender emails;
    @Mock private PasswordEncoder passwordEncoder;

    private PasswordResetService service;

    @BeforeEach
    void setUp() {
        service = new PasswordResetService(users, codes, tokens, emails, passwordEncoder);
    }

    @Test
    void shouldBindResetTokenToValidatedCode() throws Exception {
        UUID userId = UUID.randomUUID();
        UUID codeId = UUID.randomUUID();
        User user = user(userId);
        PasswordResetCode code = resetCode(userId, codeId, "123456");
        when(users.findByEmail(user.getEmail())).thenReturn(Optional.of(user));
        when(codes.findFirstByUserIdAndUsedAtIsNullOrderByCreatedAtDesc(userId))
            .thenReturn(Optional.of(code));
        when(tokens.generateToken(userId, codeId)).thenReturn("one-time-token");

        assertThat(service.validateResetCode(user.getEmail(), "123456").resetToken())
            .isEqualTo("one-time-token");
        verify(tokens).generateToken(userId, codeId);
    }

    @Test
    void shouldConsumeTheCodeWhenPasswordIsReset() {
        UUID userId = UUID.randomUUID();
        UUID codeId = UUID.randomUUID();
        User user = user(userId);
        PasswordResetCode code = resetCode(userId, codeId, "123456");
        when(tokens.validateAndExtractClaims("token"))
            .thenReturn(new PasswordResetTokenService.ResetTokenClaims(userId, codeId));
        when(codes.findById(codeId)).thenReturn(Optional.of(code));
        when(users.findById(userId)).thenReturn(Optional.of(user));
        when(passwordEncoder.encode("new-password")).thenReturn("new-hash");

        service.resetPassword("token", "new-password");

        assertThat(user.getPasswordHash()).isEqualTo("new-hash");
        assertThat(code.isUsed()).isTrue();
        verify(codes).save(code);
    }

    @Test
    void shouldRejectAReusedResetToken() {
        UUID userId = UUID.randomUUID();
        UUID codeId = UUID.randomUUID();
        PasswordResetCode code = resetCode(userId, codeId, "123456");
        code.markAsUsed();
        when(tokens.validateAndExtractClaims("token"))
            .thenReturn(new PasswordResetTokenService.ResetTokenClaims(userId, codeId));
        when(codes.findById(codeId)).thenReturn(Optional.of(code));

        assertThatThrownBy(() -> service.resetPassword("token", "new-password"))
            .isInstanceOf(PasswordResetCodeException.InvalidResetTokenException.class);
    }

    private User user(UUID id) {
        User user = new User();
        user.setId(id);
        user.setEmail("user@example.com");
        user.setName("User");
        user.setPasswordHash("old-hash");
        return user;
    }

    private PasswordResetCode resetCode(UUID userId, UUID codeId, String plainCode) {
        PasswordResetCode code = new PasswordResetCode(
            userId, sha256(plainCode), Instant.now().plusSeconds(300));
        ReflectionTestUtils.setField(code, "id", codeId);
        return code;
    }

    private String sha256(String value) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256")
                .digest(value.getBytes(StandardCharsets.UTF_8)));
        } catch (Exception exception) {
            throw new IllegalStateException(exception);
        }
    }
}
