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
import jakarta.persistence.UniqueConstraint;
import java.math.BigDecimal;

@Entity
@Table(
    name = "price_rule_package_prices",
    uniqueConstraints = @UniqueConstraint(
        name = "uk_price_rule_package_quantity",
        columnNames = {"price_rule_id", "quantity"}
    )
)
public class PriceRulePackagePrice {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "price_rule_id", nullable = false)
    private PriceRule priceRule;

    @Column(nullable = false, precision = 10, scale = 3)
    private BigDecimal quantity;

    @Column(name = "total_price", nullable = false, precision = 18, scale = 2)
    private BigDecimal totalPrice;

    @Column(name = "sort_order", nullable = false)
    private int sortOrder;

    protected PriceRulePackagePrice() {
    }

    public PriceRulePackagePrice(PriceRule priceRule, BigDecimal quantity, BigDecimal totalPrice, int sortOrder) {
        this.priceRule = priceRule;
        this.quantity = quantity;
        this.totalPrice = totalPrice;
        this.sortOrder = sortOrder;
    }

    public Long getId() { return id; }
    public BigDecimal getQuantity() { return quantity; }
    public BigDecimal getTotalPrice() { return totalPrice; }
    public int getSortOrder() { return sortOrder; }
}
