package com.laundry.management.inventory.domain;

import com.laundry.management.operations.domain.CatalogRecord;
import jakarta.persistence.*;
import java.math.BigDecimal;

@Entity @Table(name="inventory_categories")
public class InventoryCategory extends CatalogRecord {

    public InventoryCategory() {}

}
