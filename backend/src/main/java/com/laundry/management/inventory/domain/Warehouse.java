package com.laundry.management.inventory.domain;

import com.laundry.management.operations.domain.CatalogRecord;
import jakarta.persistence.*;
import java.math.BigDecimal;

@Entity @Table(name="warehouses")
public class Warehouse extends CatalogRecord {

    public Warehouse() {}

}
