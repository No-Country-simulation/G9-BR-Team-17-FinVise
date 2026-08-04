package com.financeai.backend;

import com.financeai.backend.agent.AgentController;
import com.financeai.backend.agent.AgentService;
import com.financeai.backend.agent.SendMessageRequest;
import com.financeai.backend.auth.AuthenticatedUserProvider;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import java.nio.charset.StandardCharsets;
import java.util.UUID;

import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;
import static org.mockito.ArgumentMatchers.any;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.asyncDispatch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.request;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;
import static org.springframework.test.web.servlet.setup.MockMvcBuilders.standaloneSetup;

class AgentControllerStreamingTest {

    @Test
    void shouldExposeAuthenticatedSseEndpointWithoutProxyBuffering() throws Exception {
        UUID userId = UUID.randomUUID();
        UUID conversationId = UUID.randomUUID();
        AgentService agentService = mock(AgentService.class);
        AuthenticatedUserProvider userProvider = mock(AuthenticatedUserProvider.class);
        when(userProvider.getUserId()).thenReturn(userId);
        when(agentService.streamMessage(
            org.mockito.ArgumentMatchers.eq(userId),
            org.mockito.ArgumentMatchers.eq(conversationId), any(SendMessageRequest.class)))
            .thenReturn(output -> output.write(
                "event: done\ndata: {}\n\n".getBytes(StandardCharsets.UTF_8)));
        MockMvc mockMvc = standaloneSetup(
            new AgentController(agentService, userProvider)).build();

        MvcResult streamResult = mockMvc.perform(post(
                "/api/v1/agent/conversations/{conversationId}/messages/stream",
                conversationId)
                .contentType(MediaType.APPLICATION_JSON)
                .accept(MediaType.TEXT_EVENT_STREAM)
                .content("{\"content\":\"Como estou?\",\"clientMessageId\":\""
                    + UUID.randomUUID() + "\"}"))
            .andExpect(request().asyncStarted())
            .andReturn();

        mockMvc.perform(asyncDispatch(streamResult))
            .andExpect(status().isOk())
            .andExpect(content().contentTypeCompatibleWith(MediaType.TEXT_EVENT_STREAM))
            .andExpect(header().string("X-Accel-Buffering", "no"))
            .andExpect(content().string("event: done\ndata: {}\n\n"));
    }
}
