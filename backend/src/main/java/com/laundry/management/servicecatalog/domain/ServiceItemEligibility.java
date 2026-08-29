package com.laundry.management.servicecatalog.domain;

import com.laundry.management.auth.domain.UserAccount;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import java.time.Instant;
import org.hibernate.annotations.CreationTimestamp;

@Entity
@Table(
    name = "service_item_eligibility",
    uniqueConstraints = @UniqueConstraint(
        name = "uk_service_item_eligibility",
        columnNames = {"service_id", "item_type_id"}
    )
)
public class ServiceItemEligibility {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "service_id", nullable = false)
    private LaundryService service;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "item_type_id", nullable = false)
    private ItemType itemType;

    @CreationTimestamp
    @jakarta.persistence.Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "created_by", nullable = false, updatable = false)
    private UserAccount createdBy;

    protected ServiceItemEligibility() {
    }

    public ServiceItemEligibility(LaundryService service, ItemType itemType, UserAccount actor) {
        this.service = service;
        this.itemType = itemType;
        this.createdBy = actor;
    }

    public Long getId() { return id; }
    public LaundryService getService() { return service; }
    public ItemType getItemType() { return itemType; }
}
