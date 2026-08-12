package com.laundry.management.servicecatalog.domain;

import com.laundry.management.auth.domain.UserAccount;
import jakarta.persistence.CascadeType;
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
import jakarta.persistence.OneToMany;
import jakarta.persistence.OrderBy;
import jakarta.persistence.Table;
import jakarta.persistence.Version;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

@Entity
@Table(name = "price_rules")
public class PriceRule {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "price_list_id", nullable = false)
    private PriceList priceList;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "service_id", nullable = false)
    private LaundryService service;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "item_type_id")
    private ItemType itemType;

    @Enumerated(EnumType.STRING)
    @Column(name = "pricing_method", nullable = false, length = 30)
    private PricingMethod pricingMethod;

    @Enumerated(EnumType.STRING)
    @Column(name = "unit_type", nullable = false, length = 20)
    private UnitType unitType;

    @Enumerated(EnumType.STRING)
    @Column(name = "sharing_mode", nullable = false, length = 30)
    private SharingMode sharingMode;

    @Column(name = "priority_level")
    private Integer priorityLevel;

    @Column(name = "base_price", precision = 18, scale = 2)
    private BigDecimal basePrice;

    @Column(name = "unit_price", precision = 18, scale = 2)
    private BigDecimal unitPrice;

    @Column(name = "minimum_quantity", precision = 10, scale = 3)
    private BigDecimal minimumQuantity;

    @Column(name = "maximum_quantity", precision = 10, scale = 3)
    private BigDecimal maximumQuantity;

    @Column(name = "minimum_charge", precision = 18, scale = 2)
    private BigDecimal minimumCharge;

    @Column(name = "included_quantity", precision = 10, scale = 3)
    private BigDecimal includedQuantity;

    @Column(name = "excess_unit_price", precision = 18, scale = 2)
    private BigDecimal excessUnitPrice;

    @Enumerated(EnumType.STRING)
    @Column(name = "tier_calculation_mode", length = 20)
    private TierCalculationMode tierCalculationMode;

    @Column(name = "rule_priority", nullable = false)
    private int rulePriority;

    @Column(name = "effective_from", nullable = false)
    private Instant effectiveFrom;

    @Column(name = "effective_to")
    private Instant effectiveTo;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private PriceRuleStatus status;

    @Column(name = "version_number", nullable = false)
    private int versionNumber;

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

    @Version
    @Column(name = "row_version", nullable = false)
    private long rowVersion;

    @OneToMany(mappedBy = "priceRule", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("sortOrder ASC, id ASC")
    private final List<PriceRuleTier> tiers = new ArrayList<>();

    protected PriceRule() {
    }

    public PriceRule(PriceList priceList, LaundryService service, ItemType itemType, UserAccount actor) {
        this.priceList = priceList;
        this.service = service;
        this.itemType = itemType;
        this.status = PriceRuleStatus.DRAFT;
        this.versionNumber = 1;
        this.createdBy = actor;
        this.updatedBy = actor;
    }

    public void configure(
        LaundryService service,
        ItemType itemType,
        PricingMethod pricingMethod,
        UnitType unitType,
        SharingMode sharingMode,
        Integer priorityLevel,
        BigDecimal basePrice,
        BigDecimal unitPrice,
        BigDecimal minimumQuantity,
        BigDecimal maximumQuantity,
        BigDecimal minimumCharge,
        BigDecimal includedQuantity,
        BigDecimal excessUnitPrice,
        TierCalculationMode tierCalculationMode,
        int rulePriority,
        Instant effectiveFrom,
        Instant effectiveTo,
        int versionNumber,
        List<PriceRuleTierValue> tierValues,
        UserAccount actor
    ) {
        this.service = service;
        this.itemType = itemType;
        this.pricingMethod = pricingMethod;
        this.unitType = unitType;
        this.sharingMode = sharingMode;
        this.priorityLevel = priorityLevel;
        this.basePrice = basePrice;
        this.unitPrice = unitPrice;
        this.minimumQuantity = minimumQuantity;
        this.maximumQuantity = maximumQuantity;
        this.minimumCharge = minimumCharge;
        this.includedQuantity = includedQuantity;
        this.excessUnitPrice = excessUnitPrice;
        this.tierCalculationMode = tierCalculationMode;
        this.rulePriority = rulePriority;
        this.effectiveFrom = effectiveFrom;
        this.effectiveTo = effectiveTo;
        this.versionNumber = versionNumber;
        this.updatedBy = actor;
        tiers.clear();
        tierValues.forEach(value -> tiers.add(new PriceRuleTier(
            this, value.fromQuantity(), value.toQuantity(), value.unitPrice(), value.sortOrder()
        )));
    }

    public void publish(Instant now, UserAccount actor) {
        this.status = PriceRuleStatus.ACTIVE;
        this.publishedAt = now;
        this.publishedBy = actor;
        this.updatedBy = actor;
    }

    public void expireAt(Instant end, UserAccount actor) {
        this.effectiveTo = end;
        this.status = PriceRuleStatus.EXPIRED;
        this.updatedBy = actor;
    }

    public void closeAt(Instant end, Instant now, UserAccount actor) {
        this.effectiveTo = end;
        if (!end.isAfter(now)) {
            this.status = PriceRuleStatus.EXPIRED;
        }
        this.updatedBy = actor;
    }

    public void archive(UserAccount actor) {
        this.status = PriceRuleStatus.ARCHIVED;
        this.updatedBy = actor;
    }

    public Long getId() { return id; }
    public PriceList getPriceList() { return priceList; }
    public LaundryService getService() { return service; }
    public ItemType getItemType() { return itemType; }
    public PricingMethod getPricingMethod() { return pricingMethod; }
    public UnitType getUnitType() { return unitType; }
    public SharingMode getSharingMode() { return sharingMode; }
    public Integer getPriorityLevel() { return priorityLevel; }
    public BigDecimal getBasePrice() { return basePrice; }
    public BigDecimal getUnitPrice() { return unitPrice; }
    public BigDecimal getMinimumQuantity() { return minimumQuantity; }
    public BigDecimal getMaximumQuantity() { return maximumQuantity; }
    public BigDecimal getMinimumCharge() { return minimumCharge; }
    public BigDecimal getIncludedQuantity() { return includedQuantity; }
    public BigDecimal getExcessUnitPrice() { return excessUnitPrice; }
    public TierCalculationMode getTierCalculationMode() { return tierCalculationMode; }
    public int getRulePriority() { return rulePriority; }
    public Instant getEffectiveFrom() { return effectiveFrom; }
    public Instant getEffectiveTo() { return effectiveTo; }
    public PriceRuleStatus getStatus() { return status; }
    public int getVersionNumber() { return versionNumber; }
    public Instant getCreatedAt() { return createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
    public Instant getPublishedAt() { return publishedAt; }
    public long getRowVersion() { return rowVersion; }
    public List<PriceRuleTier> getTiers() { return List.copyOf(tiers); }

    public record PriceRuleTierValue(
        BigDecimal fromQuantity,
        BigDecimal toQuantity,
        BigDecimal unitPrice,
        int sortOrder
    ) {
    }
}
