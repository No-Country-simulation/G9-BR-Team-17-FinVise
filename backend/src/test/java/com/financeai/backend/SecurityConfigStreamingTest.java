package com.financeai.backend;

import com.financeai.backend.agent.AgentController;
import com.financeai.backend.agent.AgentService;
import com.financeai.backend.agent.SendMessageRequest;
import com.financeai.backend.auth.AuthenticatedUserProvider;
import com.financeai.backend.auth.JwtAuthenticationFilter;
import com.financeai.backend.auth.JwtUtil;
import com.financeai.backend.config.CorsProperties;
import com.financeai.backend.config.SecurityConfig;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.data.jpa.mapping.JpaMetamodelMappingContext;
import org.springframework.http.MediaType;
import org.springframework.security.core.userdetails.User;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import java.nio.charset.StandardCharsets;
import java.util.UUID;

import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.asyncDispatch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.request;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(AgentController.class)
@Import({
    SecurityConfig.class,
    JwtAuthenticationFilter.class,
    CorsProperties.class
})
class SecurityConfigStreamingTest {

    private static final String TOKEN = "token-sse";

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private AgentService agentService;

    @MockBean
    private AuthenticatedUserProvider authenticatedUserProvider;

    @MockBean
    private JwtUtil jwtUtil;

    @MockBean
    private UserDetailsService userDetailsService;

    @MockBean
    private JpaMetamodelMappingContext jpaMetamodelMappingContext;

    private UUID userId;

    @BeforeEach
    void setUp() {
        userId = UUID.randomUUID();
        when(jwtUtil.validateToken(TOKEN)).thenReturn(true);
        when(jwtUtil.extractEmail(TOKEN)).thenReturn("sse@example.com");
        when(jwtUtil.extractUserId(TOKEN)).thenReturn(userId);
        when(userDetailsService.loadUserByUsername("sse@example.com"))
            .thenReturn(User.withUsername("sse@example.com")
                .password("senha")
                .roles("USER")
                .build());
        when(authenticatedUserProvider.getUserId()).thenReturn(userId);
    }

    @Test
    void shouldKeepSseAuthorizedDuringAsyncDispatch() throws Exception {
        UUID conversationId = UUID.randomUUID();
        when(agentService.streamMessage(
            userId, conversationId, new SendMessageRequest("Como estou?")))
            .thenReturn(output -> output.write(
                "event: done\ndata: {}\n\n".getBytes(StandardCharsets.UTF_8)));

        MvcResult streamResult = mockMvc.perform(post(
                "/api/v1/agent/conversations/{conversationId}/messages/stream",
                conversationId)
                .header("Authorization", "Bearer " + TOKEN)
                .contentType(MediaType.APPLICATION_JSON)
                .accept(MediaType.TEXT_EVENT_STREAM)
                .content("{\"content\":\"Como estou?\"}"))
            .andExpect(request().asyncStarted())
            .andReturn();

        mockMvc.perform(asyncDispatch(streamResult))
            .andExpect(status().isOk())
            .andExpect(content().string("event: done\ndata: {}\n\n"));
    }
}
