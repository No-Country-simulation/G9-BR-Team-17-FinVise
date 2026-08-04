package com.financeai.backend.agent;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.financeai.backend.common.exception.ResourceNotFoundException;
import com.financeai.backend.integration.ai.AgentRespondRequest;
import com.financeai.backend.integration.ai.AgentRespondResponse;
import com.financeai.backend.integration.ai.AiServiceClient;
import com.financeai.backend.transaction.TransactionSource;
import com.financeai.backend.user.User;
import com.financeai.backend.user.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.servlet.mvc.method.annotation.StreamingResponseBody;

import java.io.IOException;
import java.io.OutputStream;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.nio.charset.StandardCharsets;
import java.text.NumberFormat;
import java.time.Instant;
import java.time.YearMonth;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Service
public class AgentService {

    private static final Logger log = LoggerFactory.getLogger(AgentService.class);
    private static final int ANALYTICAL_RANKING_LIMIT = 10;
    private static final int MESSAGE_PAGE_MAX_SIZE = 100;
    private static final Pattern YEAR_PATTERN = Pattern.compile("\\b(20\\d{2})\\b");
    private static final Map<String, Integer> MONTHS = Map.ofEntries(
        Map.entry("janeiro", 1), Map.entry("fevereiro", 2), Map.entry("marco", 3),
        Map.entry("abril", 4), Map.entry("maio", 5), Map.entry("junho", 6),
        Map.entry("julho", 7), Map.entry("agosto", 8), Map.entry("setembro", 9),
        Map.entry("outubro", 10), Map.entry("novembro", 11), Map.entry("dezembro", 12));

    private final AgentConversationRepository conversationRepository;
    private final AgentMessageRepository messageRepository;
    private final UserRepository userRepository;
    private final AgentFinancialContextRepository financialContextRepository;
    private final AgentRequestCoordinator requestCoordinator;
    private final AgentContextProperties properties;
    private final AiServiceClient aiServiceClient;
    private final ObjectMapper objectMapper;

    public AgentService(AgentConversationRepository conversationRepository,
                        AgentMessageRepository messageRepository,
                        UserRepository userRepository,
                        AgentFinancialContextRepository financialContextRepository,
                        AgentRequestCoordinator requestCoordinator,
                        AgentContextProperties properties,
                        AiServiceClient aiServiceClient,
                        ObjectMapper objectMapper) {
        this.conversationRepository = conversationRepository;
        this.messageRepository = messageRepository;
        this.userRepository = userRepository;
        this.financialContextRepository = financialContextRepository;
        this.requestCoordinator = requestCoordinator;
        this.properties = properties;
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
        List<UUID> sourceIds = request.sourceIds() == null
            ? List.of() : request.sourceIds().stream().distinct().toList();
        conversation.setRagSourceIds(writeJson(sourceIds, "fontes RAG"));
        conversation.setRagTopK(clampTopK(request.topK()));
        return toResponse(conversationRepository.save(conversation), List.of(), 0, 0, 0);
    }

    public ConversationResponse sendMessage(UUID userId, UUID conversationId,
                                             SendMessageRequest request) {
        PreparedRequest prepared = prepareRequest(userId, conversationId, request);
        if (prepared.completedMessage() != null) {
            return getConversation(userId, conversationId, 0, 50);
        }

        try {
            AgentRespondResponse response = aiServiceClient.agentRespond(prepared.aiRequest());
            AgentMessage assistant = response != null && response.message() != null
                && response.message().content() != null && !response.message().content().isBlank()
                ? assistantMessage(prepared.conversation(), response.message().content(),
                    response.toolCalls() == null ? List.of() : response.toolCalls().stream()
                        .map(AgentRespondResponse.ToolCallDto::tool).toList(),
                    response.sources() == null ? List.of() : response.sources())
                : assistantMessage(prepared.conversation(), prepared.fallbackReply(),
                    List.of("regra_financeira_fallback"), List.of());
            AgentMessage saved = messageRepository.save(assistant);
            requestCoordinator.complete(conversationId, request.clientMessageId(), saved.getId());
            return getConversation(userId, conversationId, 0, 50);
        } catch (RuntimeException exception) {
            requestCoordinator.fail(conversationId, request.clientMessageId(), "FAILED", "UPSTREAM_ERROR");
            throw exception;
        }
    }

    public StreamingResponseBody streamMessage(UUID userId, UUID conversationId,
                                                SendMessageRequest request) {
        PreparedRequest prepared = prepareRequest(userId, conversationId, request);
        if (prepared.completedMessage() != null) {
            return output -> replayCompleted(output, conversationId, prepared.completedMessage());
        }
        return output -> executeStream(output, conversationId, request.clientMessageId(), prepared);
    }

    @Transactional(readOnly = true)
    public ConversationResponse getConversation(UUID userId, UUID conversationId,
                                                int page, int size) {
        AgentConversation conversation = findConversation(userId, conversationId);
        int safePage = Math.max(page, 0);
        int safeSize = Math.max(1, Math.min(size, MESSAGE_PAGE_MAX_SIZE));
        Page<AgentMessage> result = messageRepository.findByConversationId(
            conversationId, PageRequest.of(safePage, safeSize,
                Sort.by(Sort.Order.desc("createdAt"), Sort.Order.desc("id"))));
        List<AgentMessage> chronological = new ArrayList<>(result.getContent());
        java.util.Collections.reverse(chronological);
        return toResponse(conversation, chronological, result.getTotalElements(),
            result.getNumber(), result.getSize());
    }

    @Transactional(readOnly = true)
    public ConversationPageResponse getConversations(UUID userId, int page, int size) {
        int safePage = Math.max(0, page);
        int safeSize = Math.max(1, Math.min(size, 50));
        Page<AgentConversation> result = conversationRepository.findByUserId(userId,
            PageRequest.of(safePage, safeSize, Sort.by(Sort.Direction.DESC, "createdAt")));
        return new ConversationPageResponse(result.getContent().stream()
            .map(item -> toResponse(item, List.of(), 0, 0, 0)).toList(),
            result.getTotalElements(), result.getTotalPages(), result.getSize(), result.getNumber());
    }

    private PreparedRequest prepareRequest(UUID userId, UUID conversationId,
                                           SendMessageRequest request) {
        AgentConversation conversation = findConversation(userId, conversationId);
        AgentRequestCoordinator.StartResult start = requestCoordinator.start(
            conversationId, userId, request.clientMessageId(), request.content(),
            properties.getConversationLockTimeoutMs());
        if (start.outcome() == AgentRequestCoordinator.StartOutcome.COMPLETED) {
            AgentMessage completed = messageRepository.findById(start.state().assistantMessageId())
                .orElseThrow(() -> new IllegalStateException("Resposta idempotente não encontrada"));
            return new PreparedRequest(conversation, null, null, completed);
        }
        if (start.outcome() != AgentRequestCoordinator.StartOutcome.ACQUIRED) {
            throw new AgentConversationBusyException();
        }

        try {
            if (start.state().userMessageId() == null) {
                AgentMessage userMessage = new AgentMessage();
                userMessage.setConversation(conversation);
                userMessage.setRole("USER");
                userMessage.setContent(request.content());
                AgentMessage saved = messageRepository.save(userMessage);
                requestCoordinator.attachUserMessage(request.clientMessageId(), saved.getId());
            }

            HistoryWindow history = boundedHistory(conversation);
            AgentRespondRequest.AgentContextDto context = buildAgentContext(
                userId, conversation, request.content());
            List<AgentRespondRequest.MessageDto> budgeted = applyTokenBudget(
                history.messages(), history.summary(), context);
            AgentRespondRequest aiRequest = new AgentRespondRequest(
                conversationId.toString(), userId.toString(), budgeted,
                history.summary(), context);
            return new PreparedRequest(conversation, aiRequest,
                generateAssistantReply(request.content(), conversation, context), null);
        } catch (RuntimeException exception) {
            requestCoordinator.fail(conversationId, request.clientMessageId(),
                "FAILED", "PREPARATION_ERROR");
            throw exception;
        }
    }

    private HistoryWindow boundedHistory(AgentConversation conversation) {
        Page<AgentMessage> recentPage = messageRepository.findByConversationId(
            conversation.getId(), PageRequest.of(0, properties.getHistoryMaxMessages(),
                Sort.by(Sort.Order.desc("createdAt"), Sort.Order.desc("id"))));
        List<AgentMessage> recent = new ArrayList<>(recentPage.getContent());
        java.util.Collections.reverse(recent);
        if (recentPage.hasNext() && !recent.isEmpty()) {
            summarizeOlderMessages(conversation, recent.getFirst());
        }
        return new HistoryWindow(recent, conversation.getHistorySummary() == null
            ? "" : conversation.getHistorySummary());
    }

    private void summarizeOlderMessages(AgentConversation conversation, AgentMessage cutoff) {
        Instant afterAt = conversation.getSummarizedThroughCreatedAt();
        UUID afterId = conversation.getSummarizedThroughMessageId();
        String summary = conversation.getHistorySummary() == null
            ? "" : conversation.getHistorySummary();
        long count = conversation.getSummarizedMessageCount() == null
            ? 0 : conversation.getSummarizedMessageCount();
        while (true) {
            List<AgentMessage> batch = messageRepository.findSummaryCandidates(
                conversation.getId(), afterAt, afterId, cutoff.getCreatedAt(), cutoff.getId(),
                PageRequest.of(0, properties.getSummaryBatchSize()));
            if (batch.isEmpty()) break;
            for (AgentMessage message : batch) {
                summary = appendSummary(summary, message);
                afterAt = message.getCreatedAt();
                afterId = message.getId();
                count++;
            }
            if (batch.size() < properties.getSummaryBatchSize()) break;
        }
        conversation.setHistorySummary(summary);
        conversation.setSummarizedThroughCreatedAt(afterAt);
        conversation.setSummarizedThroughMessageId(afterId);
        conversation.setSummarizedMessageCount(count);
        conversationRepository.save(conversation);
    }

    private String appendSummary(String current, AgentMessage message) {
        String normalized = message.getContent().replaceAll("\\s+", " ").trim();
        if (normalized.length() > 280) normalized = normalized.substring(0, 280) + "…";
        String next = current + (current.isBlank() ? "" : "\n")
            + message.getRole() + ": " + normalized;
        int max = properties.getSummaryMaxChars();
        return next.length() <= max ? next : next.substring(next.length() - max);
    }

    private List<AgentRespondRequest.MessageDto> applyTokenBudget(
        List<AgentMessage> history, String summary, AgentRespondRequest.AgentContextDto context
    ) {
        int fixedChars;
        try {
            fixedChars = objectMapper.writeValueAsString(context).length() + summary.length() + 1200;
        } catch (Exception ignored) {
            fixedChars = summary.length() + 1200;
        }
        int available = Math.max(256, properties.getInputTokenBudget() * 4 - fixedChars);
        List<AgentRespondRequest.MessageDto> selected = new ArrayList<>();
        int used = 0;
        for (int index = history.size() - 1; index >= 0; index--) {
            AgentMessage message = history.get(index);
            int cost = message.getContent().length() + 24;
            if (!selected.isEmpty() && used + cost > available) break;
            selected.add(new AgentRespondRequest.MessageDto(
                message.getRole().toLowerCase(Locale.ROOT), message.getContent()));
            used += cost;
        }
        java.util.Collections.reverse(selected);
        return selected;
    }

    private AgentRespondRequest.AgentContextDto buildAgentContext(
        UUID userId, AgentConversation conversation, String question
    ) {
        String source = conversation.getTransactionSource() == null
            ? null : conversation.getTransactionSource().name();
        List<UUID> sourceIds = selectedSourceIds(conversation);
        try {
            AgentFinancialContextRepository.Overview overview =
                financialContextRepository.overview(userId, source, sourceIds);
            BigDecimal income = overview.totalIncome();
            BigDecimal expenses = overview.totalExpenses();
            BigDecimal balance = income.subtract(expenses);
            int months = monthCount(overview.periodStart(), overview.periodEnd());
            BigDecimal savings = income.signum() > 0
                ? balance.multiply(BigDecimal.valueOf(100)).divide(income, 2, RoundingMode.HALF_UP)
                : null;
            BigDecimal commitment = income.signum() > 0
                ? expenses.multiply(BigDecimal.valueOf(100)).divide(income, 2, RoundingMode.HALF_UP)
                : null;
            Map<String, BigDecimal> categories = new LinkedHashMap<>();
            financialContextRepository.expenseCategories(userId, source, sourceIds)
                .forEach(item -> categories.put(item.category().toUpperCase(Locale.ROOT), item.total()));
            List<AgentRespondRequest.TransactionContextDto> recent =
                financialContextRepository.recentTransactions(userId, source, sourceIds,
                    properties.getRecentTransactions()).stream().map(item ->
                    new AgentRespondRequest.TransactionContextDto(item.description(), item.amount(),
                        item.type(), value(item.date()), item.paymentMethod(), item.recurrent())).toList();
            List<AgentRespondRequest.RecurringExpenseDto> recurring =
                financialContextRepository.recurringExpenses(userId, source, sourceIds,
                    properties.getRecurringExpenses()).stream().map(item ->
                    new AgentRespondRequest.RecurringExpenseDto(item.description(), item.amount(),
                        value(item.date()))).toList();
            return new AgentRespondRequest.AgentContextDto(
                AgentRespondRequest.CONTEXT_SCHEMA_VERSION,
                new AgentRespondRequest.FinancialProfileDto(source == null ? "ALL" : source,
                    overview.transactionCount(), value(overview.periodStart()), value(overview.periodEnd()),
                    months, average(income, months), average(expenses, months)),
                new AgentRespondRequest.FinancialIndicatorsDto(income, expenses, balance,
                    overview.transactionCount(), savings, commitment),
                new AgentRespondRequest.SpendingSummaryDto(categories, expenses),
                List.of(), recent, recurring, null,
                analyticalFacts(userId, source, sourceIds, overview, question),
                new AgentRespondRequest.RetrievalDto(clampTopK(conversation.getRagTopK()),
                    sourceIds.stream().map(UUID::toString).toList()));
        } catch (RuntimeException exception) {
            log.warn("Falha ao construir contexto SQL do agente: {}", exception.getMessage());
            return new AgentRespondRequest.AgentContextDto();
        }
    }

    private Map<String, Object> analyticalFacts(UUID userId, String source, List<UUID> sourceIds,
                                                AgentFinancialContextRepository.Overview overview,
                                                String question) {
        List<Map<String, Object>> months = financialContextRepository
            .monthlyFacts(userId, source, sourceIds, properties.getAnalyticalMaxMonths())
            .stream().map(this::monthlyMap).toList();
        Map<String, Object> monthRankings = new LinkedHashMap<>();
        monthRankings.put("highest_income", selectMonth(months, "total_income", true));
        monthRankings.put("lowest_expense", selectPositiveMonth(months, "total_expenses", false));
        monthRankings.put("highest_expense", selectMonth(months, "total_expenses", true));
        monthRankings.put("highest_balance", selectMonth(months, "balance", true));
        monthRankings.put("lowest_balance", selectMonth(months, "balance", false));
        Map<String, Object> rankings = new LinkedHashMap<>();
        rankings.put("overall", rankingSet(userId, source, sourceIds, null, null));
        PeriodFilter period = periodFilter(question);
        if (period.month() != null && period.year() == null) {
            period = resolveLatestPeriod(period.month(), months);
        }
        rankings.put("by_month", period.month() == null || period.year() == null ? List.of()
            : periodRanking(userId, source, sourceIds, period));
        Map<String, Object> facts = new LinkedHashMap<>();
        Map<String, Object> scope = new LinkedHashMap<>();
        scope.put("transaction_count", overview.transactionCount());
        scope.put("period_start", value(overview.periodStart()));
        scope.put("period_end", value(overview.periodEnd()));
        facts.put("scope", scope);
        facts.put("months", months);
        facts.put("month_rankings", monthRankings);
        facts.put("transaction_rankings", rankings);
        return facts;
    }

    private Map<String, Object> rankingSet(UUID userId, String source, List<UUID> sourceIds,
                                           Integer month, Integer year) {
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("smallest_expenses", ranked(userId, source, sourceIds, "EXPENSE", true, month, year));
        result.put("largest_expenses", ranked(userId, source, sourceIds, "EXPENSE", false, month, year));
        result.put("smallest_incomes", ranked(userId, source, sourceIds, "INCOME", true, month, year));
        result.put("largest_incomes", ranked(userId, source, sourceIds, "INCOME", false, month, year));
        return result;
    }

    private List<Object> ranked(UUID userId, String source, List<UUID> sourceIds, String type,
                                boolean ascending, Integer month, Integer year) {
        List<AgentFinancialContextRepository.TransactionFact> rows = month == null
            ? financialContextRepository.rankedTransactions(userId, source, sourceIds, type,
                ascending, ANALYTICAL_RANKING_LIMIT)
            : financialContextRepository.rankedTransactionsForPeriod(userId, source, sourceIds,
                type, ascending, month, year, ANALYTICAL_RANKING_LIMIT);
        return rows.stream().map(item -> {
            Map<String, Object> value = new LinkedHashMap<>();
            value.put("id", item.id()); value.put("description", item.description());
            value.put("amount", item.amount()); value.put("date", item.date().toString());
            value.put("type", item.type()); return (Object) value;
        }).toList();
    }

    private List<Object> periodRanking(UUID userId, String source, List<UUID> sourceIds,
                                       PeriodFilter filter) {
        Map<String, Object> item = new LinkedHashMap<>();
        item.put("period", String.format("%04d-%02d", filter.year(), filter.month()));
        item.put("rankings", rankingSet(userId, source, sourceIds, filter.month(), filter.year()));
        return List.of(item);
    }

    private Map<String, Object> monthlyMap(AgentFinancialContextRepository.MonthlyFact item) {
        Map<String, Object> value = new LinkedHashMap<>();
        value.put("period", item.period()); value.put("transaction_count", item.transactionCount());
        value.put("income_count", item.incomeCount()); value.put("expense_count", item.expenseCount());
        value.put("total_income", item.totalIncome()); value.put("total_expenses", item.totalExpenses());
        value.put("balance", item.balance()); return value;
    }

    private Map<String, Object> selectMonth(List<Map<String, Object>> months, String metric,
                                            boolean maximum) {
        Comparator<Map<String, Object>> comparator = Comparator.comparing(
            item -> (BigDecimal) item.get(metric));
        return months.stream().max(maximum ? comparator : comparator.reversed()).orElse(Map.of());
    }

    private Map<String, Object> selectPositiveMonth(List<Map<String, Object>> months, String metric,
                                                    boolean maximum) {
        return selectMonth(months.stream().filter(item ->
            ((BigDecimal) item.get(metric)).signum() > 0).toList(), metric, maximum);
    }

    private PeriodFilter periodFilter(String question) {
        String normalized = java.text.Normalizer.normalize(question.toLowerCase(Locale.ROOT),
            java.text.Normalizer.Form.NFD).replaceAll("\\p{M}", "");
        Integer month = MONTHS.entrySet().stream().filter(entry -> normalized.contains(entry.getKey()))
            .map(Map.Entry::getValue).findFirst().orElse(null);
        Matcher matcher = YEAR_PATTERN.matcher(normalized);
        return new PeriodFilter(month, matcher.find() ? Integer.valueOf(matcher.group(1)) : null);
    }

    private PeriodFilter resolveLatestPeriod(int month, List<Map<String, Object>> months) {
        String suffix = String.format("-%02d", month);
        Integer latestYear = months.stream()
            .map(item -> String.valueOf(item.get("period")))
            .filter(period -> period.endsWith(suffix))
            .max(String::compareTo)
            .map(period -> Integer.valueOf(period.substring(0, 4)))
            .orElse(null);
        return new PeriodFilter(month, latestYear);
    }

    private void executeStream(OutputStream output, UUID conversationId, UUID requestId,
                               PreparedRequest prepared) {
        StringBuilder content = new StringBuilder();
        List<String> tools = new ArrayList<>();
        List<Map<String, Object>> sources = new ArrayList<>();
        try {
            sendEvent(output, "conversation", Map.of("conversationId", conversationId.toString()));
            aiServiceClient.agentRespondStream(prepared.aiRequest(), event -> {
                requestCoordinator.heartbeat(conversationId, requestId);
                switch (event.type()) {
                    case "tools" -> { tools.clear(); tools.addAll(event.tools());
                        sendEvent(output, "tools", Map.of("tools", tools)); }
                    case "sources" -> { sources.clear(); sources.addAll(event.sources());
                        sendEvent(output, "sources", Map.of("sources", sources)); }
                    case "token" -> { if (event.token() != null && !event.token().isEmpty()) {
                        content.append(event.token()); sendEvent(output, "token", Map.of("token", event.token())); } }
                    case "error" -> throw new AgentStreamException(event.message());
                    default -> { }
                }
            });
            if (content.toString().isBlank()) sendFallback(output, content, tools, prepared.fallbackReply());
            AgentMessage saved = messageRepository.save(
                assistantMessage(prepared.conversation(), content.toString(), tools, sources));
            requestCoordinator.complete(conversationId, requestId, saved.getId());
            sendDone(output, conversationId, saved, tools, sources);
        } catch (ClientDisconnectedException exception) {
            requestCoordinator.fail(conversationId, requestId, "CANCELLED", "CLIENT_DISCONNECTED");
            log.debug("Streaming cancelado após desconexão do cliente");
        } catch (RuntimeException exception) {
            requestCoordinator.fail(conversationId, requestId, "FAILED", "UPSTREAM_ERROR");
            if (!content.toString().isBlank()) {
                try { sendEvent(output, "error", Map.of("message",
                    "A resposta da IA foi interrompida. Tente novamente.")); }
                catch (ClientDisconnectedException ignored) { }
                return;
            }
            try {
                sendFallback(output, content, tools, prepared.fallbackReply());
                AgentMessage saved = messageRepository.save(
                    assistantMessage(prepared.conversation(), content.toString(), tools, sources));
                requestCoordinator.complete(conversationId, requestId, saved.getId());
                sendDone(output, conversationId, saved, tools, sources);
            } catch (ClientDisconnectedException ignored) {
                requestCoordinator.fail(conversationId, requestId, "CANCELLED", "CLIENT_DISCONNECTED");
            }
        }
    }

    private void replayCompleted(OutputStream output, UUID conversationId, AgentMessage message) {
        List<String> tools = readJsonList(message.getToolCalls(), String.class);
        List<Map<String, Object>> sources = readJsonMaps(message.getRagSources());
        sendEvent(output, "conversation", Map.of("conversationId", conversationId.toString()));
        if (!tools.isEmpty()) sendEvent(output, "tools", Map.of("tools", tools));
        if (!sources.isEmpty()) sendEvent(output, "sources", Map.of("sources", sources));
        sendEvent(output, "token", Map.of("token", message.getContent()));
        sendDone(output, conversationId, message, tools, sources);
    }

    private void sendFallback(OutputStream output, StringBuilder content, List<String> tools,
                              String fallback) {
        tools.clear(); tools.add("resposta_segura"); content.setLength(0); content.append(fallback);
        sendEvent(output, "tools", Map.of("tools", tools));
        sendEvent(output, "token", Map.of("token", fallback));
    }

    private void sendDone(OutputStream output, UUID conversationId, AgentMessage saved,
                          List<String> tools, List<Map<String, Object>> sources) {
        Map<String, Object> payload = new HashMap<>();
        payload.put("id", saved.getId().toString()); payload.put("role", "assistant");
        payload.put("content", saved.getContent());
        payload.put("timestamp", (saved.getCreatedAt() == null ? Instant.now() : saved.getCreatedAt()).toString());
        payload.put("tools", tools); payload.put("sources", sources);
        sendEvent(output, "done", Map.of("conversationId", conversationId.toString(), "message", payload));
    }

    private void sendEvent(OutputStream output, String name, Object payload) {
        try {
            String data = objectMapper.writeValueAsString(payload);
            output.write(("event: " + name + "\ndata: " + data + "\n\n").getBytes(StandardCharsets.UTF_8));
            output.flush();
        } catch (IOException exception) {
            throw new ClientDisconnectedException(exception);
        }
    }

    private AgentMessage assistantMessage(AgentConversation conversation, String content,
                                          List<String> tools, List<?> sources) {
        AgentMessage message = new AgentMessage();
        message.setConversation(conversation); message.setRole("ASSISTANT"); message.setContent(content);
        message.setToolCalls(writeJson(tools, "ferramentas"));
        message.setRagSources(writeJson(sources, "fontes RAG"));
        return message;
    }

    private String generateAssistantReply(String question, AgentConversation conversation,
                                          AgentRespondRequest.AgentContextDto context) {
        NumberFormat currency = NumberFormat.getCurrencyInstance(Locale.forLanguageTag("pt-BR"));
        String source = conversation.getTransactionSource() == TransactionSource.CSV_IMPORT
            ? "arquivo CSV" : "Open Finance";
        String prefix = "Considerando somente os dados de " + source + " ("
            + context.financialProfile().transactionCount() + " transações, receitas "
            + currency.format(context.indicators().totalIncome()) + " e despesas "
            + currency.format(context.indicators().totalExpenses()) + "): ";
        String lower = question.toLowerCase(Locale.ROOT);
        if (lower.contains("poupan") || lower.contains("economia"))
            return prefix + "revise as maiores despesas e defina uma meta de poupança compatível com o saldo.";
        if (lower.contains("divida") || lower.contains("dívida"))
            return prefix + "priorize dívidas com juros altos antes de assumir novos compromissos.";
        return prefix + "posso ajudar a analisar gastos, indicadores e metas financeiras.";
    }

    private AgentConversation findConversation(UUID userId, UUID conversationId) {
        return conversationRepository.findByIdAndUserId(conversationId, userId)
            .orElseThrow(() -> new ResourceNotFoundException("Conversa", conversationId));
    }

    private ConversationResponse toResponse(AgentConversation conversation, List<AgentMessage> messages,
                                            long total, int page, int size) {
        List<AgentMessageDto> dtos = messages.stream().map(message -> new AgentMessageDto(
            message.getId(), conversation.getId(), message.getRole(), message.getContent(),
            message.getToolCalls(), message.getRagSources(), message.getCreatedAt())).toList();
        return new ConversationResponse(conversation.getId(), conversation.getUser().getId(),
            conversation.getTitle(), conversation.getStatus(), conversation.getTransactionSource(),
            selectedSourceIds(conversation), clampTopK(conversation.getRagTopK()), dtos,
            total, page, size, (long) (page + 1) * size < total, conversation.getCreatedAt());
    }

    private List<UUID> selectedSourceIds(AgentConversation conversation) {
        if (conversation.getRagSourceIds() == null || conversation.getRagSourceIds().isBlank()) return List.of();
        try {
            return objectMapper.readValue(conversation.getRagSourceIds(),
                objectMapper.getTypeFactory().constructCollectionType(List.class, UUID.class));
        } catch (Exception exception) {
            log.warn("Fontes RAG inválidas na conversa {}", conversation.getId()); return List.of();
        }
    }

    private <T> List<T> readJsonList(String value, Class<T> type) {
        if (value == null || value.isBlank()) return List.of();
        try { return objectMapper.readValue(value,
            objectMapper.getTypeFactory().constructCollectionType(List.class, type)); }
        catch (Exception ignored) { return List.of(); }
    }

    private List<Map<String, Object>> readJsonMaps(String value) {
        if (value == null || value.isBlank()) return List.of();
        try { return objectMapper.readValue(value,
            objectMapper.getTypeFactory().constructCollectionType(List.class,
                objectMapper.getTypeFactory().constructMapType(Map.class, String.class, Object.class))); }
        catch (Exception ignored) { return List.of(); }
    }

    private int monthCount(java.time.LocalDate start, java.time.LocalDate end) {
        return start == null || end == null ? 0 : Math.toIntExact(
            ChronoUnit.MONTHS.between(YearMonth.from(start), YearMonth.from(end)) + 1);
    }
    private BigDecimal average(BigDecimal value, int months) {
        return months == 0 ? BigDecimal.ZERO : value.divide(BigDecimal.valueOf(months), 2, RoundingMode.HALF_UP);
    }
    private String value(Object value) { return value == null ? null : value.toString(); }
    private int clampTopK(Integer value) { return Math.max(1, Math.min(value == null ? 5 : value, 20)); }
    private String writeJson(Object value, String label) {
        try { return objectMapper.writeValueAsString(value); }
        catch (Exception exception) { throw new IllegalStateException("Falha ao serializar " + label, exception); }
    }

    private record HistoryWindow(List<AgentMessage> messages, String summary) {}
    private record PreparedRequest(AgentConversation conversation, AgentRespondRequest aiRequest,
                                   String fallbackReply, AgentMessage completedMessage) {}
    private record PeriodFilter(Integer month, Integer year) {}
    private static final class AgentStreamException extends RuntimeException {
        private AgentStreamException(String message) { super(message); }
    }
    private static final class ClientDisconnectedException extends RuntimeException {
        private ClientDisconnectedException(IOException cause) { super(cause); }
    }
}
