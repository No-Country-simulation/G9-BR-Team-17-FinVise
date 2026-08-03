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
import com.financeai.backend.transaction.Transaction;
import com.financeai.backend.transaction.TransactionCategory;
import com.financeai.backend.transaction.TransactionCategoryRepository;
import com.financeai.backend.transaction.TransactionRepository;
import com.financeai.backend.transaction.TransactionSource;
import com.financeai.backend.transaction.TransactionType;
import com.financeai.backend.user.User;
import com.financeai.backend.user.UserRepository;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.web.servlet.mvc.method.annotation.StreamingResponseBody;

import java.io.ByteArrayOutputStream;
import java.math.BigDecimal;
import java.time.LocalDate;
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
    @SuppressWarnings("unchecked")
    void shouldSendExactAnalyticalFactsForSelectedSource() throws Exception {
        UUID userId = UUID.randomUUID();
        UUID conversationId = UUID.randomUUID();
        UUID sourceId = UUID.randomUUID();
        User user = new User();
        user.setId(userId);
        AgentConversation conversation = new AgentConversation();
        conversation.setId(conversationId);
        conversation.setUser(user);
        conversation.setTransactionSource(TransactionSource.CSV_IMPORT);
        conversation.setRagSourceIds("[\"" + sourceId + "\"]");
        conversation.setRagTopK(5);

        AgentConversationRepository conversationRepository =
            mock(AgentConversationRepository.class);
        AgentMessageRepository messageRepository = mock(AgentMessageRepository.class);
        TransactionRepository transactionRepository = mock(TransactionRepository.class);
        TransactionCategoryRepository categoryRepository =
            mock(TransactionCategoryRepository.class);
        AiServiceClient aiServiceClient = mock(AiServiceClient.class);
        UUID housingCategoryId = UUID.randomUUID();
        UUID foodCategoryId = UUID.randomUUID();
        when(categoryRepository.findAllById(any())).thenReturn(List.of(
            category(housingCategoryId, "MORADIA"),
            category(foodCategoryId, "ALIMENTACAO")
        ));
        when(conversationRepository.findByIdAndUserId(conversationId, userId))
            .thenReturn(Optional.of(conversation));
        when(conversationRepository.findById(conversationId))
            .thenReturn(Optional.of(conversation));
        when(transactionRepository.findByUserIdAndSourceAndImportSourceIdInOrderByTransactionDateDesc(
            userId, TransactionSource.CSV_IMPORT.name(), List.of(sourceId)))
            .thenReturn(List.of(
                transaction(user, sourceId, "Salário", "5000.00", "2024-11-01",
                    TransactionType.INCOME, null),
                transaction(user, sourceId, "Aluguel", "1000.00", "2024-11-05",
                    TransactionType.EXPENSE, housingCategoryId),
                transaction(user, sourceId, "Salário", "6000.00", "2024-12-01",
                    TransactionType.INCOME, null),
                transaction(user, sourceId, "Café", "20.00", "2024-12-10",
                    TransactionType.EXPENSE, null),
                transaction(user, sourceId, "Mercado", "500.00", "2024-12-15",
                    TransactionType.EXPENSE, foodCategoryId)
            ));
        AgentMessage historyMessage = new AgentMessage();
        historyMessage.setRole("USER");
        historyMessage.setContent("qual foi minha melhor transação de dezembro");
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
                "token", "Dezembro foi analisado.", List.of(), null));
            return null;
        }).when(aiServiceClient).agentRespondStream(any(), any());
        AgentService service = new AgentService(
            conversationRepository,
            messageRepository,
            mock(UserRepository.class),
            transactionRepository,
            categoryRepository,
            aiServiceClient,
            new ObjectMapper()
        );

        StreamingResponseBody stream = service.streamMessage(
            userId,
            conversationId,
            new SendMessageRequest("qual foi minha melhor transação de dezembro")
        );
        stream.writeTo(new ByteArrayOutputStream());

        ArgumentCaptor<AgentRespondRequest> captor =
            ArgumentCaptor.forClass(AgentRespondRequest.class);
        verify(aiServiceClient).agentRespondStream(captor.capture(), any());
        AgentRespondRequest.AgentContextDto context = captor.getValue().context();
        assertThat(context.schemaVersion())
            .isEqualTo(AgentRespondRequest.CONTEXT_SCHEMA_VERSION);
        assertThat(context.financialProfile().source()).isEqualTo("CSV_IMPORT");
        assertThat(context.financialProfile().transactionCount()).isEqualTo(5);
        assertThat(context.financialProfile().monthCount()).isEqualTo(2);
        assertThat(context.financialProfile().monthlyIncome())
            .isEqualByComparingTo("5500.00");
        assertThat(context.financialProfile().monthlyExpenses())
            .isEqualByComparingTo("760.00");
        assertThat(context.indicators().totalIncome())
            .isEqualByComparingTo("11000.00");
        assertThat(context.indicators().totalExpenses())
            .isEqualByComparingTo("1520.00");
        assertThat(context.indicators().balance())
            .isEqualByComparingTo("9480.00");
        assertThat(context.spendingSummary().byCategory().keySet())
            .containsExactlyInAnyOrder("ALIMENTACAO", "MORADIA", "OUTROS");
        assertThat(context.spendingSummary().byCategory().get("ALIMENTACAO"))
            .isEqualByComparingTo("500.00");
        assertThat(context.spendingSummary().byCategory().get("MORADIA"))
            .isEqualByComparingTo("1000.00");
        assertThat(context.spendingSummary().byCategory().get("OUTROS"))
            .isEqualByComparingTo("20.00");
        Map<String, Object> analyticalFacts = context.analyticalFacts();
        Map<String, Object> monthRankings =
            (Map<String, Object>) analyticalFacts.get("month_rankings");
        Map<String, Object> highestBalance =
            (Map<String, Object>) monthRankings.get("highest_balance");
        assertThat(highestBalance.get("period")).isEqualTo("2024-12");

        Map<String, Object> transactionRankings =
            (Map<String, Object>) analyticalFacts.get("transaction_rankings");
        List<Map<String, Object>> byMonth =
            (List<Map<String, Object>>) transactionRankings.get("by_month");
        Map<String, Object> december = byMonth.stream()
            .filter(month -> "2024-12".equals(month.get("period")))
            .findFirst()
            .orElseThrow();
        Map<String, Object> decemberRankings =
            (Map<String, Object>) december.get("rankings");
        List<Map<String, Object>> smallestExpenses =
            (List<Map<String, Object>>) decemberRankings.get("smallest_expenses");
        List<Map<String, Object>> largestIncomes =
            (List<Map<String, Object>>) decemberRankings.get("largest_incomes");
        assertThat(smallestExpenses.getFirst().get("description")).isEqualTo("Café");
        assertThat(largestIncomes.getFirst().get("description")).isEqualTo("Salário");
    }

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
            mock(TransactionCategoryRepository.class),
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
            mock(TransactionCategoryRepository.class),
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
            mock(TransactionCategoryRepository.class),
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

    private static Transaction transaction(User user,
                                           UUID sourceId,
                                           String description,
                                           String amount,
                                           String date,
                                           TransactionType type,
                                           UUID categoryId) {
        Transaction transaction = new Transaction();
        transaction.setId(UUID.randomUUID());
        transaction.setUser(user);
        transaction.setImportSourceId(sourceId);
        transaction.setSource(TransactionSource.CSV_IMPORT.name());
        transaction.setDescription(description);
        transaction.setAmount(new BigDecimal(amount));
        transaction.setTransactionDate(LocalDate.parse(date));
        transaction.setType(type);
        transaction.setCategoryId(categoryId);
        transaction.setRecurrent(false);
        return transaction;
    }

    private static TransactionCategory category(UUID id, String code) {
        TransactionCategory category = new TransactionCategory();
        category.setId(id);
        category.setCode(code);
        category.setName(code);
        return category;
    }
}
