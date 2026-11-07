package com.laundry.management.inventory.domain;

import com.laundry.management.operations.domain.CatalogRecord;
import jakarta.persistence.*;
import java.math.BigDecimal;

@Entity @Table(name="inventory_units")
public class InventoryUnit extends CatalogRecord {
    @Column(name="dimension", nullable=false, length=20) private String dimension;
    public InventoryUnit() {}
    public String getDimension() { return dimension; }
    public void setDimension(String value) { this.dimension = value; }
}
