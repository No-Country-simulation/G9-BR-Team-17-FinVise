package com.financeai.backend;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.financeai.backend.agent.AgentConversation;
import com.financeai.backend.agent.AgentConversationRepository;
import com.financeai.backend.agent.AgentMessage;
import com.financeai.backend.agent.AgentMessageRepository;
import com.financeai.backend.agent.AgentService;
import com.financeai.backend.agent.SendMessageRequest;
import com.financeai.backend.integration.ai.AiServiceClient;
import com.financeai.backend.transaction.TransactionRepository;
import com.financeai.backend.transaction.TransactionSource;
import com.financeai.backend.user.User;
import com.financeai.backend.user.UserRepository;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.web.servlet.mvc.method.annotation.StreamingResponseBody;

import java.io.ByteArrayOutputStream;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.function.Consumer;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class AgentStreamingServiceTest {

    @Test
    void shouldForwardTokensAndPersistTheCompletedAssistantMessage() throws Exception {
        UUID userId = UUID.randomUUID();
        UUID conversationId = UUID.randomUUID();
        User user = new User();
        user.setId(userId);
        AgentConversation conversation = new AgentConversation();
        conversation.setId(conversationId);
        conversation.setUser(user);
        conversation.setTransactionSource(TransactionSource.CSV_IMPORT);

        AgentConversationRepository conversationRepository =
            mock(AgentConversationRepository.class);
        AgentMessageRepository messageRepository = mock(AgentMessageRepository.class);
        TransactionRepository transactionRepository = mock(TransactionRepository.class);
        AiServiceClient aiServiceClient = mock(AiServiceClient.class);
        when(conversationRepository.findByIdAndUserId(conversationId, userId))
            .thenReturn(Optional.of(conversation));
        when(conversationRepository.findById(conversationId))
            .thenReturn(Optional.of(conversation));
        when(transactionRepository.findByUserIdAndSourceOrderByTransactionDateDesc(
            userId, TransactionSource.CSV_IMPORT.name()))
            .thenReturn(List.of());

        AgentMessage historyMessage = new AgentMessage();
        historyMessage.setRole("USER");
        historyMessage.setContent("Como estou?");
        when(messageRepository.findByConversationIdOrderByCreatedAtAsc(conversationId))
            .thenReturn(List.of(historyMessage));
        when(messageRepository.save(any(AgentMessage.class))).thenAnswer(invocation -> {
            AgentMessage message = invocation.getArgument(0);
            if ("ASSISTANT".equals(message.getRole())) {
                message.setId(UUID.randomUUID());
            }
            return message;
        });
        doAnswer(invocation -> {
            @SuppressWarnings("unchecked")
            Consumer<AiServiceClient.AgentStreamEvent> consumer = invocation.getArgument(1);
            consumer.accept(new AiServiceClient.AgentStreamEvent(
                "tools", null, List.of("get_financial_profile"), null));
            consumer.accept(new AiServiceClient.AgentStreamEvent(
                "token", "Olá", List.of(), null));
            consumer.accept(new AiServiceClient.AgentStreamEvent(
                "token", "!", List.of(), null));
            consumer.accept(new AiServiceClient.AgentStreamEvent(
                "done", null, List.of(), null));
            return null;
        }).when(aiServiceClient).agentRespondStream(any(), any());

        AgentService service = new AgentService(
            conversationRepository,
            messageRepository,
            mock(UserRepository.class),
            transactionRepository,
            aiServiceClient,
            new ObjectMapper()
        );

        StreamingResponseBody stream = service.streamMessage(
            userId, conversationId, new SendMessageRequest("Como estou?"));
        ByteArrayOutputStream output = new ByteArrayOutputStream();
        stream.writeTo(output);
        String sse = output.toString(java.nio.charset.StandardCharsets.UTF_8);

        assertThat(sse)
            .contains("event: conversation")
            .contains("event: tools")
            .contains("\"get_financial_profile\"")
            .contains("event: token")
            .contains("\"token\":\"Olá\"")
            .contains("event: done")
            .contains("\"content\":\"Olá!\"");
        verify(aiServiceClient).agentRespondStream(any(), any());
        ArgumentCaptor<AgentMessage> savedMessages =
            ArgumentCaptor.forClass(AgentMessage.class);
        verify(messageRepository, times(2)).save(savedMessages.capture());
        assertThat(savedMessages.getAllValues())
            .extracting(AgentMessage::getRole)
            .containsExactly("USER", "ASSISTANT");
        assertThat(savedMessages.getAllValues().get(1).getContent()).isEqualTo("Olá!");
        assertThat(savedMessages.getAllValues().get(1).getToolCalls())
            .isEqualTo("[\"get_financial_profile\"]");
    }
}
