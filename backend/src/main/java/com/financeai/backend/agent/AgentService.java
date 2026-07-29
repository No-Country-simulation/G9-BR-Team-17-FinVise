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

import java.math.BigDecimal;
import java.text.NumberFormat;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;

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

        AgentRespondRequest aiRequest = new AgentRespondRequest(
            conversation.getId().toString(),
            userId.toString(),
            messageDtos,
            new AgentRespondRequest.AgentContextDto(Map.of(), Map.of(), Map.of())
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

    @Transactional(readOnly = true)
    public ConversationResponse getConversation(UUID userId, UUID conversationId) {
        AgentConversation conversation = conversationRepository.findByIdAndUserId(conversationId, userId)
            .orElseThrow(() -> new ResourceNotFoundException("Conversa", conversationId));
        List<AgentMessage> messages = messageRepository.findByConversationIdOrderByCreatedAtAsc(conversationId);
        return toResponse(conversation, messages);
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
