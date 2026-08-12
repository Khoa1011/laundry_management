package com.laundry.management.servicecatalog.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import java.math.BigDecimal;
import java.time.Instant;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

@Entity
@Table(name = "price_rule_tiers")
public class PriceRuleTier {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "price_rule_id", nullable = false)
    private PriceRule priceRule;

    @Column(name = "from_quantity", nullable = false, precision = 10, scale = 3)
    private BigDecimal fromQuantity;

    @Column(name = "to_quantity", precision = 10, scale = 3)
    private BigDecimal toQuantity;

    @Column(name = "unit_price", nullable = false, precision = 18, scale = 2)
    private BigDecimal unitPrice;

    @Column(name = "sort_order", nullable = false)
    private int sortOrder;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    protected PriceRuleTier() {
    }

    public PriceRuleTier(
        PriceRule priceRule,
        BigDecimal fromQuantity,
        BigDecimal toQuantity,
        BigDecimal unitPrice,
        int sortOrder
    ) {
        this.priceRule = priceRule;
        this.fromQuantity = fromQuantity;
        this.toQuantity = toQuantity;
        this.unitPrice = unitPrice;
        this.sortOrder = sortOrder;
    }

    public Long getId() { return id; }
    public BigDecimal getFromQuantity() { return fromQuantity; }
    public BigDecimal getToQuantity() { return toQuantity; }
    public BigDecimal getUnitPrice() { return unitPrice; }
    public int getSortOrder() { return sortOrder; }
}
