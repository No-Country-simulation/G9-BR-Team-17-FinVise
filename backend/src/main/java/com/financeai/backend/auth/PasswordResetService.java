package com.financeai.backend.auth;

import com.financeai.backend.common.exception.PasswordResetCodeException;
import com.financeai.backend.user.User;
import com.financeai.backend.user.UserRepository;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.Instant;
import java.util.HexFormat;
import java.util.Optional;
import java.util.UUID;

@Service
public class PasswordResetService {

    private static final int CODE_LENGTH = 6;
    private static final long CODE_EXPIRATION_MINUTES = 5;
    private static final short MAX_ATTEMPTS = 5;
    private static final long BLOCK_DURATION_MINUTES = 30;

    private final UserRepository userRepository;
    private final PasswordResetCodeRepository passwordResetCodeRepository;
    private final PasswordResetTokenService passwordResetTokenService;
    private final PasswordResetEmailSender emailSender;
    private final PasswordEncoder passwordEncoder;
    private final SecureRandom secureRandom = new SecureRandom();

    public PasswordResetService(
            UserRepository userRepository,
            PasswordResetCodeRepository passwordResetCodeRepository,
            PasswordResetTokenService passwordResetTokenService,
            PasswordResetEmailSender emailSender,
            PasswordEncoder passwordEncoder
    ) {
        this.userRepository = userRepository;
        this.passwordResetCodeRepository = passwordResetCodeRepository;
        this.passwordResetTokenService = passwordResetTokenService;
        this.emailSender = emailSender;
        this.passwordEncoder = passwordEncoder;
    }


    @Transactional
    public void requestPasswordReset(String email) {
        Optional<User> userOpt = userRepository.findByEmail(email);
        if (userOpt.isEmpty()) {
            return;
        }

        User user = userOpt.get();
        Instant now = Instant.now();

        passwordResetCodeRepository.invalidateActiveCodes(user.getId(), now);

        String plainCode = generateSixDigitCode();
        String codeHash = hash(plainCode);

        PasswordResetCode resetCode = new PasswordResetCode(
                user.getId(),
                codeHash,
                now.plusSeconds(CODE_EXPIRATION_MINUTES * 60)
        );
        passwordResetCodeRepository.save(resetCode);

        emailSender.sendResetCode(user.getEmail(), plainCode);
    }


    @Transactional
    public ValidateResetCodeResponse validateResetCode(String email, String code) {
        User user = userRepository.findByEmail(email)
                .orElseThrow(PasswordResetCodeException.InvalidResetCodeException::new);

        PasswordResetCode resetCode = passwordResetCodeRepository
                .findFirstByUserIdAndUsedAtIsNullOrderByCreatedAtDesc(user.getId())
                .orElseThrow(PasswordResetCodeException.InvalidResetCodeException::new);

        if (resetCode.isBlocked()) {
            throw new PasswordResetCodeException.TooManyAttemptsException();
        }

        if (resetCode.isExpired()) {
            throw new PasswordResetCodeException.ResetCodeExpiredException();
        }

        if (!hash(code).equals(resetCode.getCodeHash())) {
            resetCode.registerFailedAttempt(MAX_ATTEMPTS, BLOCK_DURATION_MINUTES);
            passwordResetCodeRepository.save(resetCode);

            if (resetCode.isBlocked()) {
                throw new PasswordResetCodeException.TooManyAttemptsException();
            }
            throw new PasswordResetCodeException.InvalidResetCodeException();
        }

        String resetToken = passwordResetTokenService.generateToken(user.getId(), resetCode.getId());
        return new ValidateResetCodeResponse(resetToken);
    }

    @Transactional
    public void resetPassword(String resetToken, String newPassword) {
        PasswordResetTokenService.ResetTokenClaims claims =
                passwordResetTokenService.validateAndExtractClaims(resetToken);
        UUID userId = claims.userId();

        PasswordResetCode resetCode = passwordResetCodeRepository
                .findById(claims.resetCodeId())
                .filter(code -> code.getUserId().equals(userId))
                .filter(code -> !code.isUsed())
                .filter(code -> !code.isExpired())
                .orElseThrow(PasswordResetCodeException.InvalidResetTokenException::new);

        User user = userRepository.findById(userId)
                .orElseThrow(PasswordResetCodeException.InvalidResetCodeException::new);

        user.setPasswordHash(passwordEncoder.encode(newPassword));
        userRepository.save(user);

        resetCode.markAsUsed();
        passwordResetCodeRepository.save(resetCode);

        // TODO: invalidar sessões/JWTs de login ativos do usuário aqui,
        // integrando com o mecanismo de blacklist/versionamento de token já usado no projeto.
    }

    private String generateSixDigitCode() {
        int value = secureRandom.nextInt(1_000_000);
        return String.format("%0" + CODE_LENGTH + "d", value);
    }

    private String hash(String value) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hashBytes = digest.digest(value.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(hashBytes);
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 não disponível", e);
        }
    }
}
