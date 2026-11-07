package com.laundry.management.inventory.domain;

import com.laundry.management.operations.domain.CatalogRecord;
import jakarta.persistence.*;
import java.math.BigDecimal;

@Entity @Table(name="inventory_unit_conversions")
public class InventoryConversion extends CatalogRecord {
    @Column(name="item_id", nullable=false) private Long itemId;
    @Column(name="input_unit_id", nullable=false) private Long inputUnitId;
    @Column(name="factor", nullable=false, precision=19, scale=6) private BigDecimal factor;
    public InventoryConversion() {}
    public Long getItemId() { return itemId; }
    public void setItemId(Long value) { this.itemId = value; }
    public Long getInputUnitId() { return inputUnitId; }
    public void setInputUnitId(Long value) { this.inputUnitId = value; }
    public BigDecimal getFactor() { return factor; }
    public void setFactor(BigDecimal value) { this.factor = value; }
}
