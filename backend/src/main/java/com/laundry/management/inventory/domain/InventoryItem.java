package com.laundry.management.inventory.domain;

import com.laundry.management.operations.domain.CatalogRecord;
import jakarta.persistence.*;
import java.math.BigDecimal;

@Entity @Table(name="inventory_items")
public class InventoryItem extends CatalogRecord {
    @Column(name="category_id", nullable=false) private Long categoryId;
    @Column(name="base_unit_id", nullable=false) private Long baseUnitId;
    @Column(name="supplier_id", nullable=true) private Long supplierId;
    @Column(name="description", nullable=true, length=1000) private String description;
    @Column(name="reference_price", nullable=true, precision=19, scale=2) private BigDecimal referencePrice;
    @Column(name="minimum_stock", nullable=false, precision=19, scale=6) private BigDecimal minimumStock;
    @Column(name="maximum_stock", nullable=true, precision=19, scale=6) private BigDecimal maximumStock;
    @Column(name="track_lots", nullable=false) private boolean trackLots;
    @Column(name="track_expiry", nullable=false) private boolean trackExpiry;
    public InventoryItem() {}
    public Long getCategoryId() { return categoryId; }
    public void setCategoryId(Long value) { this.categoryId = value; }
    public Long getBaseUnitId() { return baseUnitId; }
    public void setBaseUnitId(Long value) { this.baseUnitId = value; }
    public Long getSupplierId() { return supplierId; }
    public void setSupplierId(Long value) { this.supplierId = value; }
    public String getDescription() { return description; }
    public void setDescription(String value) { this.description = value; }
    public BigDecimal getReferencePrice() { return referencePrice; }
    public void setReferencePrice(BigDecimal value) { this.referencePrice = value; }
    public BigDecimal getMinimumStock() { return minimumStock; }
    public void setMinimumStock(BigDecimal value) { this.minimumStock = value; }
    public BigDecimal getMaximumStock() { return maximumStock; }
    public void setMaximumStock(BigDecimal value) { this.maximumStock = value; }
    public boolean getTrackLots() { return trackLots; }
    public void setTrackLots(boolean value) { this.trackLots = value; }
    public boolean getTrackExpiry() { return trackExpiry; }
    public void setTrackExpiry(boolean value) { this.trackExpiry = value; }
}
