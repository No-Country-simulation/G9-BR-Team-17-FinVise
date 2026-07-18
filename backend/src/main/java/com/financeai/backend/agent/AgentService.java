package com.financeai.backend.agent;

import com.financeai.backend.common.exception.ResourceNotFoundException;
import com.financeai.backend.transaction.Transaction;
import com.financeai.backend.transaction.TransactionRepository;
import com.financeai.backend.transaction.TransactionSource;
import com.financeai.backend.transaction.TransactionType;
import com.financeai.backend.user.User;
import com.financeai.backend.user.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.text.NumberFormat;
import java.time.Instant;
import java.util.List;
import java.util.Locale;
import java.util.UUID;

@Service
public class AgentService {

    private final AgentConversationRepository conversationRepository;
    private final AgentMessageRepository messageRepository;
    private final UserRepository userRepository;
    private final TransactionRepository transactionRepository;

    public AgentService(AgentConversationRepository conversationRepository,
                        AgentMessageRepository messageRepository,
                        UserRepository userRepository,
                        TransactionRepository transactionRepository) {
        this.conversationRepository = conversationRepository;
        this.messageRepository = messageRepository;
        this.userRepository = userRepository;
        this.transactionRepository = transactionRepository;
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

        AgentMessage assistantMessage = new AgentMessage();
        assistantMessage.setConversation(conversation);
        assistantMessage.setRole("ASSISTANT");
        assistantMessage.setContent(generateAssistantReply(request.content(), conversation));
        messageRepository.save(assistantMessage);

        List<AgentMessage> messages = messageRepository.findByConversationIdOrderByCreatedAtAsc(conversationId);
        return toResponse(conversation, messages);
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
                message.getId(), conversation.getId(), message.getRole(), message.getContent(), message.getCreatedAt()))
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
