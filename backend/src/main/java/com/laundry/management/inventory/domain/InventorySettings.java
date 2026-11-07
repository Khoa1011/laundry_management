package com.laundry.management.inventory.domain;

import com.laundry.management.operations.domain.PolicySettings;
import jakarta.persistence.*;

@Entity @Table(name="inventory_settings")
public class InventorySettings extends PolicySettings {
    @Column(name="default_warehouse_id") private Long defaultWarehouseId;
    protected InventorySettings() {}
    public InventorySettings(Long branchId) { super(branchId); }
    public Long getDefaultWarehouseId() { return defaultWarehouseId; }
    public void setDefaultWarehouseId(Long id) { defaultWarehouseId=id; }
}
