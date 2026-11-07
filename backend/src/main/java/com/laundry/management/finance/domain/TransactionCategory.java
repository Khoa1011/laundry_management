package com.laundry.management.finance.domain;

import com.laundry.management.operations.domain.CatalogRecord;
import jakarta.persistence.*;
import java.math.BigDecimal;

@Entity @Table(name="transaction_categories")
public class TransactionCategory extends CatalogRecord {
    @Column(name="direction", nullable=false, length=20) private String direction;
    public TransactionCategory() {}
    public String getDirection() { return direction; }
    public void setDirection(String value) { this.direction = value; }
}
