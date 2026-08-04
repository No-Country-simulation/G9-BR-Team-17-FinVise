package com.financeai.backend.agent;

import com.financeai.backend.user.User;
import com.financeai.backend.transaction.TransactionSource;
import jakarta.persistence.*;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "agent_conversations")
@EntityListeners(AuditingEntityListener.class)
public class AgentConversation {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "id", updatable = false, nullable = false)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(name = "title")
    private String title;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false)
    private ConversationStatus status = ConversationStatus.ACTIVE;

    @Enumerated(EnumType.STRING)
    @Column(name = "transaction_source", nullable = false)
    private TransactionSource transactionSource = TransactionSource.CSV_IMPORT;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "rag_source_ids", nullable = false, columnDefinition = "jsonb")
    private String ragSourceIds = "[]";

    @Column(name = "rag_top_k", nullable = false)
    private Integer ragTopK = 5;

    @Column(name = "history_summary", nullable = false)
    private String historySummary = "";

    @Column(name = "summarized_through_created_at")
    private Instant summarizedThroughCreatedAt;

    @Column(name = "summarized_through_message_id")
    private UUID summarizedThroughMessageId;

    @Column(name = "summarized_message_count", nullable = false)
    private Long summarizedMessageCount = 0L;

    @CreatedDate
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @LastModifiedDate
    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    public UUID getId() {
        return id;
    }

    public void setId(UUID id) {
        this.id = id;
    }

    public User getUser() {
        return user;
    }

    public void setUser(User user) {
        this.user = user;
    }

    public String getTitle() {
        return title;
    }

    public void setTitle(String title) {
        this.title = title;
    }

    public ConversationStatus getStatus() {
        return status;
    }

    public void setStatus(ConversationStatus status) {
        this.status = status;
    }

    public TransactionSource getTransactionSource() {
        return transactionSource;
    }

    public void setTransactionSource(TransactionSource transactionSource) {
        this.transactionSource = transactionSource;
    }

    public String getRagSourceIds() {
        return ragSourceIds;
    }

    public void setRagSourceIds(String ragSourceIds) {
        this.ragSourceIds = ragSourceIds;
    }

    public Integer getRagTopK() {
        return ragTopK;
    }

    public void setRagTopK(Integer ragTopK) {
        this.ragTopK = ragTopK;
    }

    public String getHistorySummary() { return historySummary; }
    public void setHistorySummary(String value) { historySummary = value; }
    public Instant getSummarizedThroughCreatedAt() { return summarizedThroughCreatedAt; }
    public void setSummarizedThroughCreatedAt(Instant value) { summarizedThroughCreatedAt = value; }
    public UUID getSummarizedThroughMessageId() { return summarizedThroughMessageId; }
    public void setSummarizedThroughMessageId(UUID value) { summarizedThroughMessageId = value; }
    public Long getSummarizedMessageCount() { return summarizedMessageCount; }
    public void setSummarizedMessageCount(Long value) { summarizedMessageCount = value; }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(Instant createdAt) {
        this.createdAt = createdAt;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }

    public void setUpdatedAt(Instant updatedAt) {
        this.updatedAt = updatedAt;
    }
}
