package com.financeai.backend;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.financeai.backend.agent.*;
import com.financeai.backend.integration.ai.AiServiceClient;
import com.financeai.backend.integration.ai.AgentRespondRequest;
import com.financeai.backend.transaction.TransactionSource;
import com.financeai.backend.user.User;
import com.financeai.backend.user.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.data.domain.PageImpl;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.OutputStream;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.function.Consumer;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import org.mockito.ArgumentCaptor;

class AgentStreamingServiceTest {

    private final UUID userId = UUID.randomUUID();
    private final UUID conversationId = UUID.randomUUID();
    private final UUID requestId = UUID.randomUUID();
    private AgentConversationRepository conversations;
    private AgentMessageRepository messages;
    private AgentFinancialContextRepository financialContext;
    private AgentRequestCoordinator coordinator;
    private AiServiceClient aiClient;
    private AgentService service;
    private AgentConversation conversation;

    @BeforeEach
    void setUp() {
        conversations = mock(AgentConversationRepository.class);
        messages = mock(AgentMessageRepository.class);
        financialContext = mock(AgentFinancialContextRepository.class);
        coordinator = mock(AgentRequestCoordinator.class);
        aiClient = mock(AiServiceClient.class);
        User user = new User();
        user.setId(userId);
        conversation = new AgentConversation();
        conversation.setId(conversationId);
        conversation.setUser(user);
        conversation.setTransactionSource(TransactionSource.CSV_IMPORT);
        conversation.setRagSourceIds("[]");
        when(conversations.findByIdAndUserId(conversationId, userId))
            .thenReturn(Optional.of(conversation));
        when(coordinator.start(eq(conversationId), eq(userId), eq(requestId), anyString(), anyLong()))
            .thenReturn(new AgentRequestCoordinator.StartResult(
                AgentRequestCoordinator.StartOutcome.ACQUIRED,
                new AgentRequestCoordinator.RequestState(requestId, conversationId, "Como estou?",
                    AgentRequestCoordinator.RequestStatus.PROCESSING, null, null)));
        when(messages.save(any())).thenAnswer(invocation -> {
            AgentMessage message = invocation.getArgument(0);
            if (message.getId() == null) message.setId(UUID.randomUUID());
            if (message.getCreatedAt() == null) message.setCreatedAt(Instant.now());
            return message;
        });
        when(messages.findByConversationId(eq(conversationId), any()))
            .thenAnswer(invocation -> {
                AgentMessage userMessage = new AgentMessage();
                userMessage.setId(UUID.randomUUID());
                userMessage.setConversation(conversation);
                userMessage.setRole("USER");
                userMessage.setContent("Como estou?");
                userMessage.setCreatedAt(Instant.now());
                return new PageImpl<>(List.of(userMessage));
            });
        when(financialContext.overview(userId, "CSV_IMPORT", List.of()))
            .thenReturn(new AgentFinancialContextRepository.Overview(2,
                java.time.LocalDate.parse("2026-01-01"), java.time.LocalDate.parse("2026-01-31"),
                new BigDecimal("5000"), new BigDecimal("3000")));
        when(financialContext.monthlyFacts(any(), any(), any(), anyInt())).thenReturn(List.of(
            new AgentFinancialContextRepository.MonthlyFact("2026-01", 2, 1, 1,
                new BigDecimal("5000"), new BigDecimal("3000"))));
        when(financialContext.expenseCategories(any(), any(), any())).thenReturn(List.of());
        when(financialContext.recentTransactions(any(), any(), any(), anyInt())).thenReturn(List.of());
        when(financialContext.recurringExpenses(any(), any(), any(), anyInt())).thenReturn(List.of());
        when(financialContext.rankedTransactions(any(), any(), any(), anyString(), anyBoolean(), anyInt()))
            .thenReturn(List.of());
        service = new AgentService(conversations, messages, mock(UserRepository.class),
            financialContext, coordinator, new AgentContextProperties(), aiClient, new ObjectMapper());
    }

    @Test
    void deveTransmitirTokensEPersistirRespostaCompleta() throws Exception {
        doAnswer(invocation -> {
            @SuppressWarnings("unchecked")
            Consumer<AiServiceClient.AgentStreamEvent> consumer = invocation.getArgument(1);
            consumer.accept(new AiServiceClient.AgentStreamEvent(
                "tools", null, List.of("get_financial_profile"), null));
            consumer.accept(new AiServiceClient.AgentStreamEvent(
                "token", "Sua saúde financeira está estável.", List.of(), null));
            return null;
        }).when(aiClient).agentRespondStream(any(AgentRespondRequest.class), any());

        ByteArrayOutputStream output = new ByteArrayOutputStream();
        service.streamMessage(userId, conversationId,
            new SendMessageRequest("Como estou?", requestId)).writeTo(output);

        assertThat(output.toString(java.nio.charset.StandardCharsets.UTF_8))
            .contains("event: token", "event: done", "get_financial_profile");
        verify(coordinator).complete(eq(conversationId), eq(requestId), any(UUID.class));
        verify(messages, times(2)).save(any(AgentMessage.class));
        ArgumentCaptor<AgentRespondRequest> requestCaptor =
            ArgumentCaptor.forClass(AgentRespondRequest.class);
        verify(aiClient).agentRespondStream(requestCaptor.capture(), any());
        assertThat(requestCaptor.getValue().context().financialProfile().transactionCount())
            .isEqualTo(2);
        assertThat(requestCaptor.getValue().messages()).hasSize(1);
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> monthlyFacts = (List<Map<String, Object>>)
            requestCaptor.getValue().context().analyticalFacts().get("months");
        assertThat(monthlyFacts).singleElement().satisfies(month -> {
            assertThat(month.get("period")).isEqualTo("2026-01");
            assertThat(month.get("balance")).isEqualTo(new BigDecimal("2000"));
        });
        verify(financialContext).recentTransactions(userId, "CSV_IMPORT", List.of(), 20);
    }

    @Test
    void deveCancelarProcessamentoQuandoClienteDesconecta() throws Exception {
        doAnswer(invocation -> {
            @SuppressWarnings("unchecked")
            Consumer<AiServiceClient.AgentStreamEvent> consumer = invocation.getArgument(1);
            consumer.accept(new AiServiceClient.AgentStreamEvent(
                "token", "primeiro token", List.of(), null));
            consumer.accept(new AiServiceClient.AgentStreamEvent(
                "token", "token que não deve continuar", List.of(), null));
            return null;
        }).when(aiClient).agentRespondStream(any(), any());
        OutputStream disconnected = new OutputStream() {
            private int writes;
            @Override public void write(int value) throws IOException {
                if (++writes > 1) throw new IOException("cliente desconectado");
            }
        };

        service.streamMessage(userId, conversationId,
            new SendMessageRequest("Como estou?", requestId)).writeTo(disconnected);

        verify(coordinator).fail(conversationId, requestId, "CANCELLED", "CLIENT_DISCONNECTED");
        verify(coordinator, never()).complete(any(), any(), any());
    }

    @Test
    void deveReproduzirRespostaConcluidaSemNovaChamadaAoModelo() throws Exception {
        AgentMessage completed = new AgentMessage();
        completed.setId(UUID.randomUUID());
        completed.setConversation(conversation);
        completed.setRole("ASSISTANT");
        completed.setContent("Resposta já concluída");
        completed.setCreatedAt(Instant.now());
        when(coordinator.start(any(), any(), any(), any(), anyLong())).thenReturn(
            new AgentRequestCoordinator.StartResult(AgentRequestCoordinator.StartOutcome.COMPLETED,
                new AgentRequestCoordinator.RequestState(requestId, conversationId, "Como estou?",
                    AgentRequestCoordinator.RequestStatus.COMPLETED, UUID.randomUUID(), completed.getId())));
        when(messages.findById(completed.getId())).thenReturn(Optional.of(completed));

        ByteArrayOutputStream output = new ByteArrayOutputStream();
        service.streamMessage(userId, conversationId,
            new SendMessageRequest("Como estou?", requestId)).writeTo(output);

        assertThat(output.toString(java.nio.charset.StandardCharsets.UTF_8))
            .contains("Resposta já concluída", "event: done");
        verifyNoInteractions(aiClient);
    }

    @Test
    void deveResumirMensagensQueSairamDaJanelaRecente() throws Exception {
        AgentMessage recent = message("USER", "Como estou?", Instant.parse("2026-08-04T12:00:00Z"));
        AgentMessage old = message("ASSISTANT", "Uma resposta antiga importante",
            Instant.parse("2026-08-01T12:00:00Z"));
        when(messages.findByConversationId(eq(conversationId), any())).thenReturn(
            new PageImpl<>(List.of(recent),
                org.springframework.data.domain.PageRequest.of(0, 16), 17));
        when(messages.findSummaryCandidates(eq(conversationId), isNull(), isNull(),
            eq(recent.getCreatedAt()), eq(recent.getId()), any())).thenReturn(List.of(old));
        doAnswer(invocation -> {
            @SuppressWarnings("unchecked")
            Consumer<AiServiceClient.AgentStreamEvent> consumer = invocation.getArgument(1);
            consumer.accept(new AiServiceClient.AgentStreamEvent(
                "token", "Resposta atual", List.of(), null));
            return null;
        }).when(aiClient).agentRespondStream(any(), any());

        service.streamMessage(userId, conversationId,
            new SendMessageRequest("Como estou?", requestId))
            .writeTo(new ByteArrayOutputStream());

        ArgumentCaptor<AgentRespondRequest> captor = ArgumentCaptor.forClass(AgentRespondRequest.class);
        verify(aiClient).agentRespondStream(captor.capture(), any());
        assertThat(captor.getValue().historySummary())
            .contains("ASSISTANT: Uma resposta antiga importante");
        assertThat(conversation.getSummarizedMessageCount()).isEqualTo(1);
        verify(conversations).save(conversation);
    }

    private AgentMessage message(String role, String content, Instant createdAt) {
        AgentMessage message = new AgentMessage();
        message.setId(UUID.randomUUID());
        message.setConversation(conversation);
        message.setRole(role);
        message.setContent(content);
        message.setCreatedAt(createdAt);
        return message;
    }
}
