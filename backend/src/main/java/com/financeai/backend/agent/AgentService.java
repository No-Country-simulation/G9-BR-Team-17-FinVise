package com.financeai.backend.agent;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.financeai.backend.common.exception.ResourceNotFoundException;
import com.financeai.backend.integration.ai.AiServiceClient;
import com.financeai.backend.integration.ai.AgentRespondRequest;
import com.financeai.backend.integration.ai.AgentRespondResponse;
import com.financeai.backend.transaction.Transaction;
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
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicBoolean;

@Service
public class AgentService {

    private static final Logger log = LoggerFactory.getLogger(AgentService.class);

    private final AgentConversationRepository conversationRepository;
    private final AgentMessageRepository messageRepository;
    private final UserRepository userRepository;
    private final TransactionRepository transactionRepository;
    private final AiServiceClient aiServiceClient;
    private final ObjectMapper objectMapper;

    public AgentService(AgentConversationRepository conversationRepository,
                        AgentMessageRepository messageRepository,
                        UserRepository userRepository,
                        TransactionRepository transactionRepository,
                        AiServiceClient aiServiceClient,
                        ObjectMapper objectMapper) {
        this.conversationRepository = conversationRepository;
        this.messageRepository = messageRepository;
        this.userRepository = userRepository;
        this.transactionRepository = transactionRepository;
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
            } catch (Exception e) {
                log.warn("Erro ao serializar tool_calls: {}", e.getMessage());
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

            List<Transaction> transactions;
            if (source != null) {
                transactions = transactionRepository.findByUserIdAndSourceOrderByTransactionDateDesc(userId, source);
            } else {
                transactions = transactionRepository.findByUserIdOrderByTransactionDateDesc(userId);
            }

            BigDecimal totalIncome = totalByType(transactions, TransactionType.INCOME);
            BigDecimal totalExpenses = totalByType(transactions, TransactionType.EXPENSE);
            BigDecimal balance = totalIncome.subtract(totalExpenses);

            Map<String, Object> indicators = new HashMap<>();
            indicators.put("total_income", totalIncome);
            indicators.put("total_expenses", totalExpenses);
            indicators.put("monthly_balance", balance);
            indicators.put("transaction_count", transactions.size());
            if (totalIncome.compareTo(BigDecimal.ZERO) > 0) {
                indicators.put("savings_rate_pct",
                    balance.multiply(BigDecimal.valueOf(100))
                        .divide(totalIncome, 2, java.math.RoundingMode.HALF_UP));
                indicators.put("income_commitment_pct",
                    totalExpenses.multiply(BigDecimal.valueOf(100))
                        .divide(totalIncome, 2, java.math.RoundingMode.HALF_UP));
            }

            // Category-based spending summary
            Map<String, Object> spendingSummary = new HashMap<>();
            Map<String, BigDecimal> categoryTotals = new HashMap<>();
            for (Transaction txn : transactions) {
                if (txn.getType() == TransactionType.EXPENSE) {
                    String cat = txn.getCategoryId() != null ? txn.getCategoryId().toString() : "sem_categoria";
                    categoryTotals.merge(cat, txn.getAmount(), BigDecimal::add);
                }
            }
            spendingSummary.put("by_category", categoryTotals);
            spendingSummary.put("total_expenses", totalExpenses);

            // Recent transactions (max 20 for context)
            List<Object> recentTxns = transactions.stream()
                .limit(20)
                .map(txn -> {
                    Map<String, Object> t = new HashMap<>();
                    t.put("description", txn.getDescription());
                    t.put("amount", txn.getAmount());
                    t.put("type", txn.getType().name());
                    t.put("date", txn.getTransactionDate() != null ? txn.getTransactionDate().toString() : null);
                    t.put("payment_method", txn.getPaymentMethod());
                    t.put("recurrent", txn.getRecurrent());
                    return (Object) t;
                })
                .toList();

            // Recurring expenses
            List<Object> recurring = transactions.stream()
                .filter(txn -> txn.getType() == TransactionType.EXPENSE && Boolean.TRUE.equals(txn.getRecurrent()))
                .map(txn -> {
                    Map<String, Object> r = new HashMap<>();
                    r.put("description", txn.getDescription());
                    r.put("amount", txn.getAmount());
                    r.put("date", txn.getTransactionDate() != null ? txn.getTransactionDate().toString() : null);
                    return (Object) r;
                })
                .toList();

            return new AgentRespondRequest.AgentContextDto(
                Map.of("source", source != null ? source : "ALL",
                        "total_transactions", transactions.size()),
                indicators,
                spendingSummary,
                List.of(),
                recentTxns,
                recurring,
                Map.of()
            );
        } catch (Exception e) {
            log.warn("Falha ao construir contexto do agente, enviando contexto vazio: {}", e.getMessage());
            return new AgentRespondRequest.AgentContextDto();
        }
    }

    private String generateAssistantReply(String userContent, AgentConversation conversation) {
        List<Transaction> transactions = transactionRepository.findByUserIdAndSourceOrderByTransactionDateDesc(
            conversation.getUser().getId(), conversation.getTransactionSource().name());
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

    private void executeStream(
        OutputStream outputStream,
        UUID conversationId,
        AgentRespondRequest aiRequest,
        String fallbackReply
    ) {
        StringBuilder content = new StringBuilder();
        List<String> tools = new ArrayList<>();
        AtomicBoolean clientConnected = new AtomicBoolean(true);

        sendEvent(outputStream, clientConnected, "conversation",
            Map.of("conversationId", conversationId.toString()));

        try {
            aiServiceClient.agentRespondStream(aiRequest, event -> {
                if ("tools".equals(event.type())) {
                    tools.clear();
                    tools.addAll(event.tools());
                    sendEvent(outputStream, clientConnected, "tools", Map.of("tools", tools));
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
            if (!content.isEmpty()) {
                sendEvent(outputStream, clientConnected, "error",
                    Map.of("message", "A resposta da IA foi interrompida. Tente novamente."));
                return;
            }

            tools.clear();
            tools.add("regra_financeira_fallback");
            content.append(fallbackReply);
            sendEvent(outputStream, clientConnected, "tools", Map.of("tools", tools));
            sendEvent(outputStream, clientConnected, "token", Map.of("token", fallbackReply));
        }

        AgentMessageDto savedMessage = saveAssistantMessage(
            conversationId, content.toString(), tools);
        Map<String, Object> messagePayload = new HashMap<>();
        messagePayload.put("id", savedMessage.id().toString());
        messagePayload.put("role", "assistant");
        messagePayload.put("content", savedMessage.content());
        messagePayload.put("timestamp", savedMessage.createdAt().toString());
        messagePayload.put("tools", tools);
        sendEvent(outputStream, clientConnected, "done", Map.of(
            "conversationId", conversationId.toString(),
            "message", messagePayload
        ));
    }

    private AgentMessageDto saveAssistantMessage(
        UUID conversationId,
        String content,
        List<String> tools
    ) {
        AgentConversation conversation = conversationRepository.findById(conversationId)
            .orElseThrow(() -> new ResourceNotFoundException("Conversa", conversationId));
        AgentMessage assistantMessage = new AgentMessage();
        assistantMessage.setConversation(conversation);
        assistantMessage.setRole("ASSISTANT");
        assistantMessage.setContent(content);
        try {
            assistantMessage.setToolCalls(objectMapper.writeValueAsString(tools));
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
                message.getCreatedAt()))
            .toList();

        return new ConversationResponse(
            conversation.getId(),
            conversation.getUser().getId(),
            conversation.getTitle(),
            conversation.getStatus(),
            conversation.getTransactionSource(),
            messageDtos,
            conversation.getCreatedAt()
        );
    }
}
