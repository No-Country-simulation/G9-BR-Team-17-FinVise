package com.financeai.backend.recommendation;

import com.financeai.backend.analysis.FinancialAnalysis;
import jakarta.persistence.*;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "recommendations")
@EntityListeners(AuditingEntityListener.class)
public class Recommendation {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "id", updatable = false, nullable = false)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "analysis_id", nullable = false)
    private FinancialAnalysis analysis;

    @Column(name = "title", nullable = false)
    private String title;

    @Column(name = "description", nullable = false)
    private String description;

    @Column(name = "reason")
    private String reason;

    @Enumerated(EnumType.STRING)
    @Column(name = "priority", nullable = false)
    private RecommendationPriority priority;

    @Column(name = "category")
    private String category;

    @Column(name = "expected_impact")
    private String expectedImpact;

    @Column(name = "suggested_amount", precision = 19, scale = 2)
    private BigDecimal suggestedAmount;

    @Column(name = "related_indicator")
    private String relatedIndicator;

    @CreatedDate
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    public UUID getId() {
        return id;
    }

    public void setId(UUID id) {
        this.id = id;
    }

    public FinancialAnalysis getAnalysis() {
        return analysis;
    }

    public void setAnalysis(FinancialAnalysis analysis) {
        this.analysis = analysis;
    }

    public String getTitle() {
        return title;
    }

    public void setTitle(String title) {
        this.title = title;
    }

    public String getDescription() {
        return description;
    }

    public void setDescription(String description) {
        this.description = description;
    }

    public String getReason() {
        return reason;
    }

    public void setReason(String reason) {
        this.reason = reason;
    }

    public RecommendationPriority getPriority() {
        return priority;
    }

    public void setPriority(RecommendationPriority priority) {
        this.priority = priority;
    }

    public String getCategory() {
        return category;
    }

    public void setCategory(String category) {
        this.category = category;
    }

    public String getExpectedImpact() {
        return expectedImpact;
    }

    public void setExpectedImpact(String expectedImpact) {
        this.expectedImpact = expectedImpact;
    }

    public BigDecimal getSuggestedAmount() {
        return suggestedAmount;
    }

    public void setSuggestedAmount(BigDecimal suggestedAmount) {
        this.suggestedAmount = suggestedAmount;
    }

    public String getRelatedIndicator() {
        return relatedIndicator;
    }

    public void setRelatedIndicator(String relatedIndicator) {
        this.relatedIndicator = relatedIndicator;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(Instant createdAt) {
        this.createdAt = createdAt;
    }
}
