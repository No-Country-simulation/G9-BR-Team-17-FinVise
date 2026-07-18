package com.financeai.backend.openfinance;

import com.financeai.backend.user.User;
import jakarta.persistence.*;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "open_finance_connections")
@EntityListeners(AuditingEntityListener.class)
public class OpenFinanceConnection {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(name = "provider", nullable = false)
    private String provider;

    @Column(name = "external_item_id", nullable = false)
    private String externalItemId;

    @Column(name = "display_name")
    private String displayName;

    @Column(name = "is_default", nullable = false)
    private Boolean defaultSource = false;

    @Column(name = "status", nullable = false)
    private String status;

    @Column(name = "last_sync_at")
    private Instant lastSyncAt;

    @CreatedDate
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @LastModifiedDate
    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    public UUID getId() { return id; }
    public User getUser() { return user; }
    public void setUser(User user) { this.user = user; }
    public String getProvider() { return provider; }
    public void setProvider(String provider) { this.provider = provider; }
    public String getExternalItemId() { return externalItemId; }
    public void setExternalItemId(String externalItemId) { this.externalItemId = externalItemId; }
    public String getDisplayName() { return displayName; }
    public void setDisplayName(String displayName) { this.displayName = displayName; }
    public Boolean getDefaultSource() { return defaultSource; }
    public void setDefaultSource(Boolean defaultSource) { this.defaultSource = defaultSource; }
    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
    public Instant getLastSyncAt() { return lastSyncAt; }
    public void setLastSyncAt(Instant lastSyncAt) { this.lastSyncAt = lastSyncAt; }
    public Instant getCreatedAt() { return createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
}
