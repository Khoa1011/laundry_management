package com.laundry.management.servicecatalog.domain;

import com.laundry.management.auth.domain.Branch;
import com.laundry.management.auth.domain.UserAccount;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import jakarta.persistence.Version;
import java.time.Instant;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

@Entity
@Table(name = "price_lists")
public class PriceList {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true, length = 40)
    private String code;

    @Column(nullable = false, length = 180)
    private String name;

    @Column(length = 1000)
    private String description;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "branch_id", nullable = false)
    private Branch branch;

    @Column(nullable = false, length = 3)
    private String currency;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private PriceListStatus status;

    @Column(name = "effective_from", nullable = false)
    private Instant effectiveFrom;

    @Column(name = "effective_to")
    private Instant effectiveTo;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "created_by", nullable = false, updatable = false)
    private UserAccount createdBy;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "updated_by", nullable = false)
    private UserAccount updatedBy;

    @Column(name = "published_at")
    private Instant publishedAt;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "published_by")
    private UserAccount publishedBy;

    @Column(name = "archived_at")
    private Instant archivedAt;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "archived_by")
    private UserAccount archivedBy;

    @Version
    @Column(nullable = false)
    private long version;

    protected PriceList() {
    }

    public PriceList(
        String code,
        String name,
        String description,
        Branch branch,
        String currency,
        Instant effectiveFrom,
        Instant effectiveTo,
        UserAccount actor
    ) {
        this.code = code;
        this.branch = branch;
        this.currency = currency;
        this.status = PriceListStatus.DRAFT;
        this.createdBy = actor;
        updateDraft(name, description, effectiveFrom, effectiveTo, actor);
    }

    public void updateDraft(
        String name,
        String description,
        Instant effectiveFrom,
        Instant effectiveTo,
        UserAccount actor
    ) {
        this.name = name;
        this.description = description;
        this.effectiveFrom = effectiveFrom;
        this.effectiveTo = effectiveTo;
        this.updatedBy = actor;
    }

    public void publish(Instant now, UserAccount actor) {
        this.status = effectiveFrom.isAfter(now) ? PriceListStatus.SCHEDULED : PriceListStatus.ACTIVE;
        this.publishedAt = now;
        this.publishedBy = actor;
        this.updatedBy = actor;
    }

    public void expireAt(Instant end, UserAccount actor) {
        this.effectiveTo = end;
        this.status = PriceListStatus.EXPIRED;
        this.updatedBy = actor;
    }

    public void closeAt(Instant end, Instant now, UserAccount actor) {
        this.effectiveTo = end;
        if (!end.isAfter(now)) {
            this.status = PriceListStatus.EXPIRED;
        }
        this.updatedBy = actor;
    }

    public void archive(Instant now, UserAccount actor) {
        this.status = PriceListStatus.ARCHIVED;
        this.archivedAt = now;
        this.archivedBy = actor;
        this.updatedBy = actor;
    }

    public Long getId() { return id; }
    public String getCode() { return code; }
    public String getName() { return name; }
    public String getDescription() { return description; }
    public Branch getBranch() { return branch; }
    public String getCurrency() { return currency; }
    public PriceListStatus getStatus() { return status; }
    public Instant getEffectiveFrom() { return effectiveFrom; }
    public Instant getEffectiveTo() { return effectiveTo; }
    public Instant getCreatedAt() { return createdAt; }
    public UserAccount getUpdatedBy() { return updatedBy; }
    public Instant getUpdatedAt() { return updatedAt; }
    public Instant getPublishedAt() { return publishedAt; }
    public UserAccount getPublishedBy() { return publishedBy; }
    public Instant getArchivedAt() { return archivedAt; }
    public long getVersion() { return version; }
}
