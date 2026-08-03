package com.financeai.backend.agent;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.financeai.backend.common.exception.ResourceNotFoundException;
import com.financeai.backend.integration.ai.AiServiceClient;
import com.financeai.backend.integration.ai.AgentRespondRequest;
import com.financeai.backend.integration.ai.AgentRespondResponse;
import com.financeai.backend.transaction.Transaction;
import com.financeai.backend.transaction.TransactionCategory;
import com.financeai.backend.transaction.TransactionCategoryRepository;
import com.financeai.backend.transaction.TransactionRepository;
import com.financeai.backend.transaction.TransactionSource;
import com.financeai.backend.transaction.TransactionType;
import com.financeai.backend.user.User;
import com.financeai.backend.user.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.servlet.mvc.method.annotation.StreamingResponseBody;

import java.io.IOException;
import java.io.OutputStream;
import java.math.BigDecimal;
import java.text.NumberFormat;
import java.time.Instant;
import java.time.YearMonth;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.TreeMap;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.function.Predicate;
import java.util.stream.Collectors;

@Service
public class AgentService {

    private static final Logger log = LoggerFactory.getLogger(AgentService.class);
    private static final int ANALYTICAL_RANKING_LIMIT = 10;

    private final AgentConversationRepository conversationRepository;
    private final AgentMessageRepository messageRepository;
    private final UserRepository userRepository;
    private final TransactionRepository transactionRepository;
    private final TransactionCategoryRepository categoryRepository;
    private final AiServiceClient aiServiceClient;
    private final ObjectMapper objectMapper;

    public AgentService(AgentConversationRepository conversationRepository,
                        AgentMessageRepository messageRepository,
                        UserRepository userRepository,
                        TransactionRepository transactionRepository,
                        TransactionCategoryRepository categoryRepository,
                        AiServiceClient aiServiceClient,
                        ObjectMapper objectMapper) {
        this.conversationRepository = conversationRepository;
        this.messageRepository = messageRepository;
        this.userRepository = userRepository;
        this.transactionRepository = transactionRepository;
        this.categoryRepository = categoryRepository;
        this.aiServiceClient = aiServiceClient;
        this.objectMapper = objectMapper;
    }

    @Transactional
    public ConversationResponse createConversation(UUID userId, CreateConversationRequest request) {
        User user = userRepository.findById(userId)
            .orElseThrow(() -> new ResourceNotFoundException("Usuário", userId));

        AgentConversation conversation = new AgentConversation();
        conversation.setUser(user);
        conversation.setTitle(request.title() != null ? request.title() : "Nova conversa");
        conversation.setStatus(ConversationStatus.ACTIVE);
        conversation.setTransactionSource(request.source());
        List<UUID> sourceIds = request.sourceIds() != null
            ? request.sourceIds().stream().distinct().toList()
            : List.of();
        conversation.setRagSourceIds(writeJson(sourceIds, "fontes RAG"));
        conversation.setRagTopK(clampTopK(request.topK()));
        conversation = conversationRepository.save(conversation);

        return toResponse(conversation, List.of());
    }

    @Transactional
    public ConversationResponse sendMessage(UUID userId, UUID conversationId, SendMessageRequest request) {
        AgentConversation conversation = conversationRepository.findByIdAndUserId(conversationId, userId)
            .orElseThrow(() -> new ResourceNotFoundException("Conversa", conversationId));

        AgentMessage userMessage = new AgentMessage();
        userMessage.setConversation(conversation);
        userMessage.setRole("USER");
        userMessage.setContent(request.content());
        messageRepository.save(userMessage);

        List<AgentMessage> history = messageRepository.findByConversationIdOrderByCreatedAtAsc(conversationId);
        List<AgentRespondRequest.MessageDto> messageDtos = history.stream()
            .map(m -> new AgentRespondRequest.MessageDto(m.getRole().toLowerCase(), m.getContent()))
            .toList();

        AgentRespondRequest.AgentContextDto contextDto = buildAgentContext(userId, conversation);

        AgentRespondRequest aiRequest = new AgentRespondRequest(
            conversation.getId().toString(),
            userId.toString(),
            messageDtos,
            contextDto
        );

        AgentRespondResponse aiResponse = aiServiceClient.agentRespond(aiRequest);

        AgentMessage assistantMessage = new AgentMessage();
        assistantMessage.setConversation(conversation);
        assistantMessage.setRole("ASSISTANT");

        if (aiResponse != null && aiResponse.message() != null && aiResponse.message().content() != null) {
            assistantMessage.setContent(aiResponse.message().content());
            List<String> toolsExecuted = new ArrayList<>();
            if (aiResponse.toolCalls() != null && !aiResponse.toolCalls().isEmpty()) {
                toolsExecuted = aiResponse.toolCalls().stream().map(AgentRespondResponse.ToolCallDto::tool).toList();
            }
            try {
                assistantMessage.setToolCalls(objectMapper.writeValueAsString(toolsExecuted));
                assistantMessage.setRagSources(objectMapper.writeValueAsString(
                    aiResponse.sources() != null ? aiResponse.sources() : List.of()));
            } catch (Exception e) {
                log.warn("Erro ao serializar dados da resposta do agente: {}", e.getMessage());
            }
        } else {
            assistantMessage.setContent(generateAssistantReply(request.content(), conversation));
            try {
                assistantMessage.setToolCalls(objectMapper.writeValueAsString(List.of("regra_financeira_fallback")));
            } catch (Exception ignored) {}
        }

        messageRepository.save(assistantMessage);

        List<AgentMessage> allMessages = messageRepository.findByConversationIdOrderByCreatedAtAsc(conversationId);
        return toResponse(conversation, allMessages);
    }

    @Transactional
    public StreamingResponseBody streamMessage(
        UUID userId,
        UUID conversationId,
        SendMessageRequest request
    ) {
        AgentConversation conversation = conversationRepository.findByIdAndUserId(conversationId, userId)
            .orElseThrow(() -> new ResourceNotFoundException("Conversa", conversationId));

        AgentMessage userMessage = new AgentMessage();
        userMessage.setConversation(conversation);
        userMessage.setRole("USER");
        userMessage.setContent(request.content());
        messageRepository.save(userMessage);

        List<AgentMessage> history =
            messageRepository.findByConversationIdOrderByCreatedAtAsc(conversationId);
        List<AgentRespondRequest.MessageDto> messageDtos = history.stream()
            .map(message -> new AgentRespondRequest.MessageDto(
                message.getRole().toLowerCase(), message.getContent()))
            .toList();
        AgentRespondRequest aiRequest = new AgentRespondRequest(
            conversationId.toString(),
            userId.toString(),
            messageDtos,
            buildAgentContext(userId, conversation)
        );
        String fallbackReply = generateAssistantReply(request.content(), conversation);

        return outputStream -> executeStream(
            outputStream, conversationId, aiRequest, fallbackReply);
    }

    @Transactional(readOnly = true)
    public ConversationResponse getConversation(UUID userId, UUID conversationId) {
        AgentConversation conversation = conversationRepository.findByIdAndUserId(conversationId, userId)
            .orElseThrow(() -> new ResourceNotFoundException("Conversa", conversationId));
        List<AgentMessage> messages = messageRepository.findByConversationIdOrderByCreatedAtAsc(conversationId);
        return toResponse(conversation, messages);
    }

    private AgentRespondRequest.AgentContextDto buildAgentContext(UUID userId, AgentConversation conversation) {
        try {
            String source = conversation.getTransactionSource() != null
                ? conversation.getTransactionSource().name()
                : null;

            List<UUID> sourceIds = selectedSourceIds(conversation);
            List<Transaction> transactions;
            if (source != null && !sourceIds.isEmpty()) {
                transactions = transactionRepository
                    .findByUserIdAndSourceAndImportSourceIdInOrderByTransactionDateDesc(
                        userId, source, sourceIds);
            } else if (source != null) {
                transactions = transactionRepository.findByUserIdAndSourceOrderByTransactionDateDesc(userId, source);
            } else {
                transactions = transactionRepository.findByUserIdOrderByTransactionDateDesc(userId);
            }

            BigDecimal totalIncome = totalByType(transactions, TransactionType.INCOME);
            BigDecimal totalExpenses = totalByType(transactions, TransactionType.EXPENSE);
            BigDecimal balance = totalIncome.subtract(totalExpenses);
            String periodStart = transactions.stream()
                .map(Transaction::getTransactionDate)
                .filter(java.util.Objects::nonNull)
                .min(Comparator.naturalOrder())
                .map(Object::toString)
                .orElse(null);
            String periodEnd = transactions.stream()
                .map(Transaction::getTransactionDate)
                .filter(java.util.Objects::nonNull)
                .max(Comparator.naturalOrder())
                .map(Object::toString)
                .orElse(null);
            int monthCount = monthCount(periodStart, periodEnd);
            BigDecimal monthlyIncome = monthlyAverage(totalIncome, monthCount);
            BigDecimal monthlyExpenses = monthlyAverage(totalExpenses, monthCount);
            BigDecimal savingsRate = null;
            BigDecimal incomeCommitment = null;
            if (totalIncome.compareTo(BigDecimal.ZERO) > 0) {
                savingsRate = balance.multiply(BigDecimal.valueOf(100))
                    .divide(totalIncome, 2, java.math.RoundingMode.HALF_UP);
                incomeCommitment = totalExpenses.multiply(BigDecimal.valueOf(100))
                    .divide(totalIncome, 2, java.math.RoundingMode.HALF_UP);
            }
            AgentRespondRequest.FinancialProfileDto financialProfile =
                new AgentRespondRequest.FinancialProfileDto(
                    source != null ? source : "ALL",
                    transactions.size(),
                    periodStart,
                    periodEnd,
                    monthCount,
                    monthlyIncome,
                    monthlyExpenses);
            AgentRespondRequest.FinancialIndicatorsDto indicators =
                new AgentRespondRequest.FinancialIndicatorsDto(
                    totalIncome,
                    totalExpenses,
                    balance,
                    transactions.size(),
                    savingsRate,
                    incomeCommitment);

            // Category-based spending summary
            Map<String, BigDecimal> categoryTotals = expenseTotalsByCategory(transactions);
            AgentRespondRequest.SpendingSummaryDto spendingSummary =
                new AgentRespondRequest.SpendingSummaryDto(categoryTotals, totalExpenses);

            // Recent transactions (max 20 for context)
            List<AgentRespondRequest.TransactionContextDto> recentTxns = transactions.stream()
                .limit(20)
                .map(txn -> new AgentRespondRequest.TransactionContextDto(
                    txn.getDescription(),
                    txn.getAmount(),
                    txn.getType().name(),
                    txn.getTransactionDate() != null ? txn.getTransactionDate().toString() : null,
                    txn.getPaymentMethod(),
                    Boolean.TRUE.equals(txn.getRecurrent())))
                .toList();

            // Recurring expenses
            List<AgentRespondRequest.RecurringExpenseDto> recurring = transactions.stream()
                .filter(txn -> txn.getType() == TransactionType.EXPENSE && Boolean.TRUE.equals(txn.getRecurrent()))
                .map(txn -> new AgentRespondRequest.RecurringExpenseDto(
                    txn.getDescription(),
                    txn.getAmount(),
                    txn.getTransactionDate() != null ? txn.getTransactionDate().toString() : null))
                .toList();

            return new AgentRespondRequest.AgentContextDto(
                AgentRespondRequest.CONTEXT_SCHEMA_VERSION,
                financialProfile,
                indicators,
                spendingSummary,
                List.of(),
                recentTxns,
                recurring,
                null,
                buildAnalyticalFacts(transactions),
                new AgentRespondRequest.RetrievalDto(
                    clampTopK(conversation.getRagTopK()),
                    sourceIds.stream().map(UUID::toString).toList())
            );
        } catch (Exception e) {
            log.warn("Falha ao construir contexto do agente, enviando contexto vazio: {}", e.getMessage());
            return new AgentRespondRequest.AgentContextDto();
        }
    }

    private int monthCount(String periodStart, String periodEnd) {
        if (periodStart == null || periodEnd == null) {
            return 0;
        }
        YearMonth firstMonth = YearMonth.from(java.time.LocalDate.parse(periodStart));
        YearMonth lastMonth = YearMonth.from(java.time.LocalDate.parse(periodEnd));
        return Math.toIntExact(
            java.time.temporal.ChronoUnit.MONTHS.between(firstMonth, lastMonth) + 1);
    }

    private BigDecimal monthlyAverage(BigDecimal total, int monthCount) {
        if (monthCount <= 0) {
            return BigDecimal.ZERO;
        }
        return total.divide(
            BigDecimal.valueOf(monthCount), 2, java.math.RoundingMode.HALF_UP);
    }

    private Map<String, BigDecimal> expenseTotalsByCategory(List<Transaction> transactions) {
        Set<UUID> categoryIds = transactions.stream()
            .filter(transaction -> transaction.getType() == TransactionType.EXPENSE)
            .map(Transaction::getCategoryId)
            .filter(java.util.Objects::nonNull)
            .collect(Collectors.toSet());
        Map<UUID, String> categoryCodes = categoryIds.isEmpty()
            ? Map.of()
            : categoryRepository.findAllById(categoryIds).stream()
                .collect(Collectors.toMap(
                    TransactionCategory::getId,
                    category -> category.getCode().toUpperCase(Locale.ROOT)));

        Map<String, BigDecimal> totals = new TreeMap<>();
        transactions.stream()
            .filter(transaction -> transaction.getType() == TransactionType.EXPENSE)
            .forEach(transaction -> totals.merge(
                categoryCodes.getOrDefault(transaction.getCategoryId(), "OUTROS"),
                transaction.getAmount(),
                BigDecimal::add));
        return totals;
    }

    private String generateAssistantReply(String userContent, AgentConversation conversation) {
        List<UUID> sourceIds = selectedSourceIds(conversation);
        List<Transaction> transactions = sourceIds.isEmpty()
            ? transactionRepository.findByUserIdAndSourceOrderByTransactionDateDesc(
                conversation.getUser().getId(), conversation.getTransactionSource().name())
            : transactionRepository.findByUserIdAndSourceAndImportSourceIdInOrderByTransactionDateDesc(
                conversation.getUser().getId(), conversation.getTransactionSource().name(), sourceIds);
        BigDecimal income = totalByType(transactions, TransactionType.INCOME);
        BigDecimal expenses = totalByType(transactions, TransactionType.EXPENSE);
        String sourceLabel = conversation.getTransactionSource() == TransactionSource.CSV_IMPORT
            ? "arquivo CSV" : "Open Finance";
        NumberFormat currency = NumberFormat.getCurrencyInstance(Locale.forLanguageTag("pt-BR"));
        String context = "Considerando somente os dados de " + sourceLabel + " ("
            + transactions.size() + " transações, receitas " + currency.format(income)
            + " e despesas " + currency.format(expenses) + "): ";

        String lower = userContent.toLowerCase(Locale.ROOT);
        if (lower.contains("poupan") || lower.contains("economia")) {
            return context + "revise as maiores despesas desta origem e defina uma meta de poupança compatível com o saldo observado.";
        }
        if (lower.contains("divida") || lower.contains("dívida") || lower.contains("endividamento")) {
            return context + "priorize dívidas com juros altos e mantenha esta avaliação separada da outra origem de importação.";
        }
        if (lower.contains("investimento") || lower.contains("investir")) {
            return context + "antes de investir, construa uma reserva equivalente a 3-6 meses das despesas desta origem.";
        }
        return context + "posso ajudar a analisar gastos e metas sem misturar as transações da outra origem.";
    }

    private Map<String, Object> buildAnalyticalFacts(List<Transaction> transactions) {
        if (transactions.isEmpty()) {
            return Map.of();
        }

        Map<YearMonth, List<Transaction>> transactionsByMonth = transactions.stream()
            .collect(Collectors.groupingBy(transaction ->
                YearMonth.from(transaction.getTransactionDate())));
        List<Map<String, Object>> months = transactionsByMonth.entrySet().stream()
            .sorted(Map.Entry.comparingByKey())
            .map(entry -> monthlyFact(entry.getKey(), entry.getValue()))
            .toList();

        Map<String, Object> monthRankings = new LinkedHashMap<>();
        monthRankings.put("highest_income", selectMonth(
            months, "total_income", Comparator.naturalOrder()));
        monthRankings.put("lowest_expense", selectMonth(
            months.stream()
                .filter(month -> ((BigDecimal) month.get("total_expenses")).signum() > 0)
                .toList(),
            "total_expenses",
            Comparator.reverseOrder()));
        monthRankings.put("highest_expense", selectMonth(
            months, "total_expenses", Comparator.naturalOrder()));
        monthRankings.put("highest_balance", selectMonth(
            months, "balance", Comparator.naturalOrder()));
        monthRankings.put("lowest_balance", selectMonth(
            months, "balance", Comparator.reverseOrder()));

        Map<String, Object> transactionRankings = new LinkedHashMap<>();
        transactionRankings.put("overall", transactionRankings(transactions));
        transactionRankings.put("by_month", transactionsByMonth.entrySet().stream()
            .sorted(Map.Entry.comparingByKey())
            .map(entry -> {
                Map<String, Object> month = new LinkedHashMap<>();
                month.put("period", entry.getKey().toString());
                month.put("rankings", transactionRankings(entry.getValue()));
                return (Object) month;
            })
            .toList());

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("scope", Map.of(
            "transaction_count", transactions.size(),
            "period_start", transactions.stream()
                .map(Transaction::getTransactionDate)
                .min(Comparator.naturalOrder())
                .orElseThrow()
                .toString(),
            "period_end", transactions.stream()
                .map(Transaction::getTransactionDate)
                .max(Comparator.naturalOrder())
                .orElseThrow()
                .toString()
        ));
        result.put("months", months);
        result.put("month_rankings", monthRankings);
        result.put("transaction_rankings", transactionRankings);
        return result;
    }

    private Map<String, Object> monthlyFact(YearMonth period,
                                            List<Transaction> transactions) {
        BigDecimal income = totalByType(transactions, TransactionType.INCOME);
        BigDecimal expenses = totalByType(transactions, TransactionType.EXPENSE);
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("period", period.toString());
        result.put("transaction_count", transactions.size());
        result.put("income_count", countByType(transactions, TransactionType.INCOME));
        result.put("expense_count", countByType(transactions, TransactionType.EXPENSE));
        result.put("total_income", income);
        result.put("total_expenses", expenses);
        result.put("balance", income.subtract(expenses));
        return result;
    }

    private Map<String, Object> selectMonth(List<Map<String, Object>> months,
                                            String metric,
                                            Comparator<BigDecimal> comparator) {
        return months.stream()
            .max((left, right) -> comparator.compare(
                (BigDecimal) left.get(metric),
                (BigDecimal) right.get(metric)))
            .orElse(Map.of());
    }

    private Map<String, Object> transactionRankings(List<Transaction> transactions) {
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("smallest_expenses", rankTransactions(
            transactions,
            transaction -> transaction.getType() == TransactionType.EXPENSE,
            true));
        result.put("largest_expenses", rankTransactions(
            transactions,
            transaction -> transaction.getType() == TransactionType.EXPENSE,
            false));
        result.put("smallest_incomes", rankTransactions(
            transactions,
            transaction -> transaction.getType() == TransactionType.INCOME,
            true));
        result.put("largest_incomes", rankTransactions(
            transactions,
            transaction -> transaction.getType() == TransactionType.INCOME,
            false));
        return result;
    }

    private List<Object> rankTransactions(List<Transaction> transactions,
                                          Predicate<Transaction> filter,
                                          boolean ascending) {
        Comparator<Transaction> comparator = Comparator
            .comparing(Transaction::getAmount)
            .thenComparing(Transaction::getTransactionDate)
            .thenComparing(transaction -> transaction.getId() == null
                ? new UUID(0, 0)
                : transaction.getId());
        if (!ascending) {
            comparator = comparator.reversed();
        }
        return transactions.stream()
            .filter(filter)
            .sorted(comparator)
            .limit(ANALYTICAL_RANKING_LIMIT)
            .map(transaction -> {
                Map<String, Object> item = new LinkedHashMap<>();
                item.put("id", transaction.getId());
                item.put("description", transaction.getDescription());
                item.put("amount", transaction.getAmount());
                item.put("date", transaction.getTransactionDate().toString());
                item.put("type", transaction.getType().name());
                return (Object) item;
            })
            .toList();
    }

    private long countByType(List<Transaction> transactions, TransactionType type) {
        return transactions.stream()
            .filter(transaction -> transaction.getType() == type)
            .count();
    }

    private void executeStream(
        OutputStream outputStream,
        UUID conversationId,
        AgentRespondRequest aiRequest,
        String fallbackReply
    ) {
        StringBuilder content = new StringBuilder();
        List<String> tools = new ArrayList<>();
        List<Map<String, Object>> ragSources = new ArrayList<>();
        AtomicBoolean clientConnected = new AtomicBoolean(true);

        sendEvent(outputStream, clientConnected, "conversation",
            Map.of("conversationId", conversationId.toString()));

        try {
            aiServiceClient.agentRespondStream(aiRequest, event -> {
                if ("tools".equals(event.type())) {
                    tools.clear();
                    tools.addAll(event.tools());
                    sendEvent(outputStream, clientConnected, "tools", Map.of("tools", tools));
                } else if ("sources".equals(event.type())) {
                    ragSources.clear();
                    ragSources.addAll(event.sources());
                    sendEvent(outputStream, clientConnected, "sources",
                        Map.of("sources", ragSources));
                } else if ("token".equals(event.type())
                    && event.token() != null
                    && !event.token().isEmpty()) {
                    content.append(event.token());
                    sendEvent(outputStream, clientConnected, "token",
                        Map.of("token", event.token()));
                } else if ("error".equals(event.type())) {
                    throw new AgentStreamException(event.message());
                }
            });
        } catch (Exception exception) {
            log.warn("Falha durante streaming do agente: {}", exception.getMessage());
            if (!content.toString().isBlank()) {
                sendEvent(outputStream, clientConnected, "error",
                    Map.of("message", "A resposta da IA foi interrompida. Tente novamente."));
                return;
            }

            sendFallbackReply(
                outputStream, clientConnected, content, tools, fallbackReply);
        }

        if (content.toString().isBlank()) {
            log.warn("O agente concluiu o streaming sem texto; usando resposta segura");
            sendFallbackReply(
                outputStream, clientConnected, content, tools, fallbackReply);
        }

        AgentMessageDto savedMessage = saveAssistantMessage(
            conversationId, content.toString(), tools, ragSources);
        Map<String, Object> messagePayload = new HashMap<>();
        messagePayload.put("id", savedMessage.id().toString());
        messagePayload.put("role", "assistant");
        messagePayload.put("content", savedMessage.content());
        messagePayload.put("timestamp", savedMessage.createdAt().toString());
        messagePayload.put("tools", tools);
        messagePayload.put("sources", ragSources);
        sendEvent(outputStream, clientConnected, "done", Map.of(
            "conversationId", conversationId.toString(),
            "message", messagePayload
        ));
    }

    private void sendFallbackReply(
        OutputStream outputStream,
        AtomicBoolean clientConnected,
        StringBuilder content,
        List<String> tools,
        String fallbackReply
    ) {
        tools.clear();
        tools.add("resposta_segura");
        content.setLength(0);
        content.append(fallbackReply);
        sendEvent(outputStream, clientConnected, "tools", Map.of("tools", tools));
        sendEvent(outputStream, clientConnected, "token", Map.of("token", fallbackReply));
    }

    private AgentMessageDto saveAssistantMessage(
        UUID conversationId,
        String content,
        List<String> tools,
        List<Map<String, Object>> ragSources
    ) {
        AgentConversation conversation = conversationRepository.findById(conversationId)
            .orElseThrow(() -> new ResourceNotFoundException("Conversa", conversationId));
        AgentMessage assistantMessage = new AgentMessage();
        assistantMessage.setConversation(conversation);
        assistantMessage.setRole("ASSISTANT");
        assistantMessage.setContent(content);
        try {
            assistantMessage.setToolCalls(objectMapper.writeValueAsString(tools));
            assistantMessage.setRagSources(objectMapper.writeValueAsString(ragSources));
        } catch (Exception exception) {
            log.warn("Erro ao serializar tool_calls do streaming: {}", exception.getMessage());
        }
        AgentMessage saved = messageRepository.save(assistantMessage);
        Instant createdAt = saved.getCreatedAt() != null ? saved.getCreatedAt() : Instant.now();
        return new AgentMessageDto(
            saved.getId(),
            conversationId,
            saved.getRole(),
            saved.getContent(),
            saved.getToolCalls(),
            saved.getRagSources(),
            createdAt
        );
    }

    private void sendEvent(
        OutputStream outputStream,
        AtomicBoolean clientConnected,
        String eventName,
        Object payload
    ) {
        if (!clientConnected.get()) {
            return;
        }
        try {
            String data = objectMapper.writeValueAsString(payload);
            outputStream.write(("event: " + eventName + "\n").getBytes(java.nio.charset.StandardCharsets.UTF_8));
            outputStream.write(("data: " + data + "\n\n").getBytes(java.nio.charset.StandardCharsets.UTF_8));
            outputStream.flush();
        } catch (IOException exception) {
            clientConnected.set(false);
            log.debug("Cliente SSE desconectou durante a resposta do agente: {}", exception.getMessage());
        }
    }

    private static class AgentStreamException extends RuntimeException {
        AgentStreamException(String message) {
            super(message);
        }
    }

    private BigDecimal totalByType(List<Transaction> transactions, TransactionType type) {
        return transactions.stream()
            .filter(transaction -> transaction.getType() == type)
            .map(Transaction::getAmount)
            .reduce(BigDecimal.ZERO, BigDecimal::add);
    }

    private ConversationResponse toResponse(AgentConversation conversation, List<AgentMessage> messages) {
        List<AgentMessageDto> messageDtos = messages.stream()
            .map(message -> new AgentMessageDto(
                message.getId(),
                conversation.getId(),
                message.getRole(),
                message.getContent(),
                message.getToolCalls(),
                message.getRagSources(),
                message.getCreatedAt()))
            .toList();

        return new ConversationResponse(
            conversation.getId(),
            conversation.getUser().getId(),
            conversation.getTitle(),
            conversation.getStatus(),
            conversation.getTransactionSource(),
            selectedSourceIds(conversation),
            clampTopK(conversation.getRagTopK()),
            messageDtos,
            conversation.getCreatedAt()
        );
    }

    private List<UUID> selectedSourceIds(AgentConversation conversation) {
        String value = conversation.getRagSourceIds();
        if (value == null || value.isBlank()) {
            return List.of();
        }
        try {
            return objectMapper.readValue(
                value,
                objectMapper.getTypeFactory().constructCollectionType(List.class, UUID.class));
        } catch (Exception exception) {
            log.warn("Fontes RAG inválidas na conversa {}: {}",
                conversation.getId(), exception.getMessage());
            return List.of();
        }
    }

    private int clampTopK(Integer value) {
        return Math.max(1, Math.min(value != null ? value : 5, 20));
    }

    private String writeJson(Object value, String label) {
        try {
            return objectMapper.writeValueAsString(value);
        } catch (Exception exception) {
            throw new IllegalStateException("Falha ao serializar " + label, exception);
        }
    }
}
