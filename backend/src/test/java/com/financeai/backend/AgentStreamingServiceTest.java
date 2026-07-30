package com.financeai.backend;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.financeai.backend.agent.AgentConversation;
import com.financeai.backend.agent.AgentConversationRepository;
import com.financeai.backend.agent.AgentMessage;
import com.financeai.backend.agent.AgentMessageRepository;
import com.financeai.backend.agent.AgentService;
import com.financeai.backend.agent.SendMessageRequest;
import com.financeai.backend.integration.ai.AiServiceClient;
import com.financeai.backend.integration.ai.AgentRespondRequest;
import com.financeai.backend.transaction.TransactionRepository;
import com.financeai.backend.transaction.TransactionSource;
import com.financeai.backend.user.User;
import com.financeai.backend.user.UserRepository;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.web.servlet.mvc.method.annotation.StreamingResponseBody;

import java.io.ByteArrayOutputStream;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.function.Consumer;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.never;
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
        UUID sourceId = UUID.randomUUID();
        conversation.setRagSourceIds("[\"" + sourceId + "\"]");
        conversation.setRagTopK(8);

        AgentConversationRepository conversationRepository =
            mock(AgentConversationRepository.class);
        AgentMessageRepository messageRepository = mock(AgentMessageRepository.class);
        TransactionRepository transactionRepository = mock(TransactionRepository.class);
        AiServiceClient aiServiceClient = mock(AiServiceClient.class);
        when(conversationRepository.findByIdAndUserId(conversationId, userId))
            .thenReturn(Optional.of(conversation));
        when(conversationRepository.findById(conversationId))
            .thenReturn(Optional.of(conversation));
        when(transactionRepository.findByUserIdAndSourceAndImportSourceIdInOrderByTransactionDateDesc(
            userId, TransactionSource.CSV_IMPORT.name(), List.of(sourceId)))
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
                "sources",
                null,
                List.of(),
                List.of(Map.of(
                    "id", "chunk-1",
                    "source_id", sourceId.toString(),
                    "source_name", "extrato.csv",
                    "chunk_type", "MONTHLY_SUMMARY",
                    "score", 0.91)),
                null));
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
            .contains("event: sources")
            .contains("extrato.csv")
            .contains("\"get_financial_profile\"")
            .contains("event: token")
            .contains("\"token\":\"Olá\"")
            .contains("event: done")
            .contains("\"content\":\"Olá!\"");
        ArgumentCaptor<AgentRespondRequest> requestCaptor =
            ArgumentCaptor.forClass(AgentRespondRequest.class);
        verify(aiServiceClient).agentRespondStream(requestCaptor.capture(), any());
        assertThat(requestCaptor.getValue().context().retrieval().topK()).isEqualTo(8);
        assertThat(requestCaptor.getValue().context().retrieval().sourceIds())
            .containsExactly(sourceId.toString());
        ArgumentCaptor<AgentMessage> savedMessages =
            ArgumentCaptor.forClass(AgentMessage.class);
        verify(messageRepository, times(2)).save(savedMessages.capture());
        assertThat(savedMessages.getAllValues())
            .extracting(AgentMessage::getRole)
            .containsExactly("USER", "ASSISTANT");
        assertThat(savedMessages.getAllValues().get(1).getContent()).isEqualTo("Olá!");
        assertThat(savedMessages.getAllValues().get(1).getToolCalls())
            .isEqualTo("[\"get_financial_profile\"]");
        assertThat(savedMessages.getAllValues().get(1).getRagSources())
            .contains("extrato.csv");
    }

    @Test
    void shouldUseSafeReplyWhenModelFinishesWithoutText() throws Exception {
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
        when(messageRepository.findByConversationIdOrderByCreatedAtAsc(conversationId))
            .thenReturn(List.of());
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
                "tools", null, List.of("simulate_savings_plan"), null));
            consumer.accept(new AiServiceClient.AgentStreamEvent(
                "sources", null, List.of(), List.of(), null));
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
            userId, conversationId, new SendMessageRequest("Onde posso economizar?"));
        ByteArrayOutputStream output = new ByteArrayOutputStream();
        stream.writeTo(output);
        String sse = output.toString(java.nio.charset.StandardCharsets.UTF_8);

        assertThat(sse)
            .contains("event: token")
            .contains("resposta_segura")
            .contains("Considerando somente os dados")
            .contains("event: done")
            .doesNotContain("\"content\":\"\"");
        ArgumentCaptor<AgentMessage> savedMessages =
            ArgumentCaptor.forClass(AgentMessage.class);
        verify(messageRepository, times(2)).save(savedMessages.capture());
        assertThat(savedMessages.getAllValues().get(1).getContent()).isNotBlank();
    }

    @Test
    void shouldReportAnInterruptedStreamWithoutPersistingPartialResponse() throws Exception {
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
        when(transactionRepository.findByUserIdAndSourceOrderByTransactionDateDesc(
            userId, TransactionSource.CSV_IMPORT.name()))
            .thenReturn(List.of());
        when(messageRepository.findByConversationIdOrderByCreatedAtAsc(conversationId))
            .thenReturn(List.of());
        doAnswer(invocation -> {
            @SuppressWarnings("unchecked")
            Consumer<AiServiceClient.AgentStreamEvent> consumer = invocation.getArgument(1);
            consumer.accept(new AiServiceClient.AgentStreamEvent(
                "token", "Resposta parcial", List.of(), null));
            consumer.accept(new AiServiceClient.AgentStreamEvent(
                "error", null, List.of(), "Falha no modelo"));
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
            .contains("event: token")
            .contains("event: error")
            .contains("A resposta da IA foi interrompida")
            .doesNotContain("event: done");
        verify(messageRepository, times(1)).save(any(AgentMessage.class));
        verify(conversationRepository, never()).findById(conversationId);
    }
}
