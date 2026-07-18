package com.financeai.backend;

import com.financeai.backend.auth.AuthenticatedUserProvider;
import com.financeai.backend.auth.FinanceAiPrincipal;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.User;

import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class AuthenticatedUserProviderTest {

    private final AuthenticatedUserProvider provider = new AuthenticatedUserProvider();

    @AfterEach
    void clearSecurityContext() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void shouldReadUserIdFromAuthenticatedPrincipal() {
        UUID userId = UUID.randomUUID();
        authenticate(userId);

        assertThat(provider.getUserId()).isEqualTo(userId);
        assertThat(provider.requireCurrentUser(userId)).isEqualTo(userId);
    }

    @Test
    void shouldRejectAnotherUserId() {
        authenticate(UUID.randomUUID());

        assertThatThrownBy(() -> provider.requireCurrentUser(UUID.randomUUID()))
            .isInstanceOf(AccessDeniedException.class);
    }

    private void authenticate(UUID userId) {
        User delegate = new User("user@example.com", "hash", List.of());
        FinanceAiPrincipal principal = new FinanceAiPrincipal(userId, delegate);
        SecurityContextHolder.getContext().setAuthentication(
            new UsernamePasswordAuthenticationToken(principal, null, List.of()));
    }
}
