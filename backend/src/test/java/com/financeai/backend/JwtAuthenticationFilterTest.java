package com.financeai.backend;

import com.financeai.backend.auth.FinanceAiPrincipal;
import com.financeai.backend.auth.JwtAuthenticationFilter;
import com.financeai.backend.auth.JwtUtil;
import jakarta.servlet.FilterChain;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.User;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class JwtAuthenticationFilterTest {

    private final JwtUtil jwtUtil = mock(JwtUtil.class);
    private final UserDetailsService userDetailsService = mock(UserDetailsService.class);
    private final JwtAuthenticationFilter filter =
        new JwtAuthenticationFilter(jwtUtil, userDetailsService);

    @AfterEach
    void clearSecurityContext() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void shouldAuthenticateAValidBearerToken() throws Exception {
        UUID userId = UUID.randomUUID();
        UserDetails userDetails = User.withUsername("user@finvise.com")
            .password("hash")
            .roles("USER")
            .build();
        MockHttpServletRequest request = new MockHttpServletRequest(
            "GET", "/api/v1/transactions");
        request.addHeader("Authorization", "Bearer valid-token");
        MockHttpServletResponse response = new MockHttpServletResponse();
        FilterChain chain = mock(FilterChain.class);

        when(jwtUtil.validateToken("valid-token")).thenReturn(true);
        when(jwtUtil.extractEmail("valid-token")).thenReturn("user@finvise.com");
        when(jwtUtil.extractUserId("valid-token")).thenReturn(userId);
        when(userDetailsService.loadUserByUsername("user@finvise.com"))
            .thenReturn(userDetails);

        filter.doFilter(request, response, chain);

        assertThat(SecurityContextHolder.getContext().getAuthentication()).isNotNull();
        assertThat(SecurityContextHolder.getContext().getAuthentication().isAuthenticated())
            .isTrue();
        assertThat(SecurityContextHolder.getContext().getAuthentication().getPrincipal())
            .isInstanceOfSatisfying(FinanceAiPrincipal.class, principal -> {
                assertThat(principal.userId()).isEqualTo(userId);
                assertThat(principal.getUsername()).isEqualTo("user@finvise.com");
            });
        verify(chain).doFilter(request, response);
    }

    @Test
    void shouldIgnoreAnInvalidBearerToken() throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest(
            "GET", "/api/v1/transactions");
        request.addHeader("Authorization", "Bearer invalid-token");
        MockHttpServletResponse response = new MockHttpServletResponse();
        FilterChain chain = mock(FilterChain.class);

        when(jwtUtil.validateToken("invalid-token")).thenReturn(false);

        filter.doFilter(request, response, chain);

        assertThat(SecurityContextHolder.getContext().getAuthentication()).isNull();
        verify(userDetailsService, never()).loadUserByUsername(org.mockito.ArgumentMatchers.any());
        verify(chain).doFilter(request, response);
    }

    @Test
    void shouldNotFilterAuthenticationEndpoints() throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest(
            "POST", "/api/v1/auth/login");
        request.addHeader("Authorization", "Bearer token");
        MockHttpServletResponse response = new MockHttpServletResponse();
        FilterChain chain = mock(FilterChain.class);

        filter.doFilter(request, response, chain);

        verify(jwtUtil, never()).validateToken(org.mockito.ArgumentMatchers.any());
        verify(chain).doFilter(request, response);
    }
}
