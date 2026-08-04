package com.financeai.backend.agent;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import java.sql.Timestamp;
import java.time.Instant;
import java.util.Optional;
import java.util.UUID;

@Repository
public class AgentRequestCoordinator {

    private final JdbcTemplate jdbcTemplate;

    public AgentRequestCoordinator(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    @Transactional
    public StartResult start(UUID conversationId,
                             UUID userId,
                             UUID requestId,
                             String content,
                             long lockTimeoutMs) {
        Instant staleBefore = Instant.now().minusMillis(lockTimeoutMs);
        int inserted = jdbcTemplate.update("""
            INSERT INTO agent_message_requests(id, conversation_id, content, status)
            SELECT ?, conversation.id, ?, 'PROCESSING'
            FROM agent_conversations conversation
            WHERE conversation.id = ? AND conversation.user_id = ?
            ON CONFLICT (id) DO NOTHING
            """, requestId, content, conversationId, userId);

        RequestState state = find(requestId).orElseThrow(() ->
            new IllegalStateException("Conversa não encontrada ou requisição inválida"));
        if (!state.conversationId().equals(conversationId)) {
            throw new AgentIdempotencyConflictException(
                "Identificador idempotente pertence a outra conversa");
        }
        if (!state.content().equals(content)) {
            throw new AgentIdempotencyConflictException(
                "Identificador idempotente reutilizado com conteúdo diferente");
        }
        if (inserted == 0 && state.status() == RequestStatus.COMPLETED) {
            return new StartResult(StartOutcome.COMPLETED, state);
        }
        if (inserted == 0) {
            if (state.status() == RequestStatus.PROCESSING) {
                int stale = jdbcTemplate.update("""
                    UPDATE agent_message_requests request
                    SET status = 'FAILED', error_code = 'STALE_LOCK', updated_at = NOW()
                    FROM agent_conversations conversation
                    WHERE request.id = ?
                      AND conversation.id = request.conversation_id
                      AND ((conversation.active_request_id = request.id
                            AND conversation.active_request_started_at < ?)
                           OR (conversation.active_request_id IS NULL
                               AND request.updated_at < ?))
                    """, requestId, Timestamp.from(staleBefore), Timestamp.from(staleBefore));
                if (stale == 0) {
                    return new StartResult(StartOutcome.IN_PROGRESS, state);
                }
            }
            int retried = jdbcTemplate.update("""
                UPDATE agent_message_requests
                SET status = 'PROCESSING', error_code = NULL, updated_at = NOW()
                WHERE id = ? AND status IN ('FAILED', 'CANCELLED')
                """, requestId);
            if (retried == 0) {
                return new StartResult(StartOutcome.IN_PROGRESS, state);
            }
        }

        jdbcTemplate.update("""
            UPDATE agent_message_requests request
            SET status = 'FAILED', error_code = 'STALE_LOCK', updated_at = NOW()
            FROM agent_conversations conversation
            WHERE conversation.id = ?
              AND conversation.active_request_id = request.id
              AND conversation.active_request_started_at < ?
              AND request.id <> ?
              AND request.status = 'PROCESSING'
            """, conversationId, Timestamp.from(staleBefore), requestId);
        int claimed = jdbcTemplate.update("""
            UPDATE agent_conversations
            SET active_request_id = ?, active_request_started_at = NOW(), updated_at = NOW()
            WHERE id = ? AND user_id = ?
              AND (active_request_id IS NULL
                   OR active_request_started_at < ?
                   OR active_request_id = ?)
            """, requestId, conversationId, userId, Timestamp.from(staleBefore), requestId);
        if (claimed == 0) {
            jdbcTemplate.update("""
                UPDATE agent_message_requests
                SET status = 'FAILED', error_code = 'CONVERSATION_BUSY', updated_at = NOW()
                WHERE id = ? AND status <> 'COMPLETED'
                """, requestId);
            return new StartResult(StartOutcome.BUSY, find(requestId).orElse(state));
        }

        return new StartResult(StartOutcome.ACQUIRED, find(requestId).orElse(state));
    }

    public Optional<RequestState> find(UUID requestId) {
        return jdbcTemplate.query("""
            SELECT id, conversation_id, content, status, user_message_id, assistant_message_id
            FROM agent_message_requests WHERE id = ?
            """, (rs, row) -> new RequestState(
                rs.getObject("id", UUID.class),
                rs.getObject("conversation_id", UUID.class),
                rs.getString("content"),
                RequestStatus.valueOf(rs.getString("status")),
                rs.getObject("user_message_id", UUID.class),
                rs.getObject("assistant_message_id", UUID.class)), requestId).stream().findFirst();
    }

    public void attachUserMessage(UUID requestId, UUID messageId) {
        jdbcTemplate.update("""
            UPDATE agent_message_requests SET user_message_id = ?, updated_at = NOW()
            WHERE id = ? AND user_message_id IS NULL
            """, messageId, requestId);
    }

    public void heartbeat(UUID conversationId, UUID requestId) {
        jdbcTemplate.update("""
            UPDATE agent_conversations
            SET active_request_started_at = NOW(), updated_at = NOW()
            WHERE id = ? AND active_request_id = ?
            """, conversationId, requestId);
        jdbcTemplate.update("""
            UPDATE agent_message_requests SET updated_at = NOW()
            WHERE id = ? AND status = 'PROCESSING'
            """, requestId);
    }

    @Transactional
    public void complete(UUID conversationId, UUID requestId, UUID assistantMessageId) {
        jdbcTemplate.update("""
            UPDATE agent_message_requests
            SET assistant_message_id = ?, status = 'COMPLETED', error_code = NULL, updated_at = NOW()
            WHERE id = ?
            """, assistantMessageId, requestId);
        releaseConversation(conversationId, requestId);
    }

    @Transactional
    public void fail(UUID conversationId, UUID requestId, String status, String errorCode) {
        jdbcTemplate.update("""
            UPDATE agent_message_requests
            SET status = ?, error_code = ?, updated_at = NOW()
            WHERE id = ? AND status <> 'COMPLETED'
            """, status, errorCode, requestId);
        releaseConversation(conversationId, requestId);
    }

    private void releaseConversation(UUID conversationId, UUID requestId) {
        jdbcTemplate.update("""
            UPDATE agent_conversations
            SET active_request_id = NULL, active_request_started_at = NULL, updated_at = NOW()
            WHERE id = ? AND active_request_id = ?
            """, conversationId, requestId);
    }

    public enum StartOutcome { ACQUIRED, COMPLETED, IN_PROGRESS, BUSY }
    public enum RequestStatus { PENDING, PROCESSING, COMPLETED, FAILED, CANCELLED }
    public record StartResult(StartOutcome outcome, RequestState state) {}
    public record RequestState(UUID id, UUID conversationId, String content,
                               RequestStatus status, UUID userMessageId,
                               UUID assistantMessageId) {}
}
