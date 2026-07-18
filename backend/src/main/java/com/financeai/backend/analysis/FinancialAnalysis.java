package com.financeai.backend.analysis;

import com.financeai.backend.user.User;
import jakarta.persistence.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

@Entity
@Table(name = "financial_analyses")
@EntityListeners(AuditingEntityListener.class)
public class FinancialAnalysis {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "id", updatable = false, nullable = false)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(name = "analysis_period")
    private String analysisPeriod;

    @Column(name = "profile_classification")
    private String profileClassification;

    @Column(name = "score", precision = 5, scale = 2)
    private BigDecimal score;

    @Column(name = "confidence", precision = 4, scale = 3)
    private BigDecimal confidence;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "model_versions", columnDefinition = "jsonb")
    private Map<String, String> modelVersions = new HashMap<>();

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

    public String getAnalysisPeriod() {
        return analysisPeriod;
    }

    public void setAnalysisPeriod(String analysisPeriod) {
        this.analysisPeriod = analysisPeriod;
    }

    public String getProfileClassification() {
        return profileClassification;
    }

    public void setProfileClassification(String profileClassification) {
        this.profileClassification = profileClassification;
    }

    public BigDecimal getScore() {
        return score;
    }

    public void setScore(BigDecimal score) {
        this.score = score;
    }

    public BigDecimal getConfidence() {
        return confidence;
    }

    public void setConfidence(BigDecimal confidence) {
        this.confidence = confidence;
    }

    public Map<String, String> getModelVersions() {
        return modelVersions;
    }

    public void setModelVersions(Map<String, String> modelVersions) {
        this.modelVersions = modelVersions;
    }

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
