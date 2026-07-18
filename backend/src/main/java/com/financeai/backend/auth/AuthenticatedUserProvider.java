package com.financeai.backend.auth;

import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.AuthenticationCredentialsNotFoundException;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;

import java.util.UUID;

@Component
public class AuthenticatedUserProvider {

    public UUID getUserId() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || !authentication.isAuthenticated()
            || !(authentication.getPrincipal() instanceof FinanceAiPrincipal principal)) {
            throw new AuthenticationCredentialsNotFoundException("Usuário não autenticado");
        }
        return principal.userId();
    }

    public UUID requireCurrentUser(UUID requestedUserId) {
        UUID authenticatedUserId = getUserId();
        if (!authenticatedUserId.equals(requestedUserId)) {
            throw new AccessDeniedException("Acesso negado aos dados de outro usuário");
        }
        return authenticatedUserId;
    }
}
