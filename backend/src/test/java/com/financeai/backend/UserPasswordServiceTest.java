package com.financeai.backend;

import com.financeai.backend.analysis.FinancialAnalysisRepository;
import com.financeai.backend.common.exception.BusinessException;
import com.financeai.backend.indicator.FinancialIndicatorRepository;
import com.financeai.backend.indicator.SpendingSummaryRepository;
import com.financeai.backend.recommendation.RecommendationRepository;
import com.financeai.backend.user.ChangePasswordRequest;
import com.financeai.backend.user.User;
import com.financeai.backend.user.UserRepository;
import com.financeai.backend.user.UserService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class UserPasswordServiceTest {

    @Mock private UserRepository users;
    @Mock private FinancialAnalysisRepository analyses;
    @Mock private FinancialIndicatorRepository indicators;
    @Mock private SpendingSummaryRepository summaries;
    @Mock private RecommendationRepository recommendations;
    @Mock private PasswordEncoder passwordEncoder;

    private UserService service;

    @BeforeEach
    void setUp() {
        service = new UserService(
            users, analyses, indicators, summaries, recommendations, passwordEncoder);
    }

    @Test
    void shouldChangePasswordAfterCheckingCurrentPassword() {
        UUID userId = UUID.randomUUID();
        User user = user(userId);
        when(users.findById(userId)).thenReturn(Optional.of(user));
        when(passwordEncoder.matches("current-password", "old-hash")).thenReturn(true);
        when(passwordEncoder.matches("new-password", "old-hash")).thenReturn(false);
        when(passwordEncoder.encode("new-password")).thenReturn("new-hash");

        service.changePassword(
            userId, new ChangePasswordRequest("current-password", "new-password"));

        assertThat(user.getPasswordHash()).isEqualTo("new-hash");
        verify(users).save(user);
    }

    @Test
    void shouldRejectAnInvalidCurrentPassword() {
        UUID userId = UUID.randomUUID();
        User user = user(userId);
        when(users.findById(userId)).thenReturn(Optional.of(user));
        when(passwordEncoder.matches("wrong-password", "old-hash")).thenReturn(false);

        assertThatThrownBy(() -> service.changePassword(
            userId, new ChangePasswordRequest("wrong-password", "new-password")))
            .isInstanceOf(BusinessException.class)
            .hasMessageContaining("senha atual");
    }

    private User user(UUID id) {
        User user = new User();
        user.setId(id);
        user.setEmail("user@example.com");
        user.setName("User");
        user.setPasswordHash("old-hash");
        return user;
    }
}
