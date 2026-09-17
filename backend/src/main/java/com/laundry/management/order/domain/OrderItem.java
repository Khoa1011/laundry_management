package com.laundry.management.order.domain;

import com.laundry.management.servicecatalog.domain.*;
import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.Objects;

@Entity
@Table(name="order_items")
public class OrderItem {
    @Id @GeneratedValue(strategy=GenerationType.IDENTITY) private Long id;
    @ManyToOne(fetch=FetchType.LAZY, optional=false) @JoinColumn(name="order_id") private LaundryOrder order;
    @ManyToOne(fetch=FetchType.LAZY, optional=false) @JoinColumn(name="service_id") private LaundryService service;
    @ManyToOne(fetch=FetchType.LAZY, optional=false) @JoinColumn(name="item_type_id", nullable=false) private ItemType itemType;
    @Column(name="service_code_snapshot", nullable=false, length=40) private String serviceCodeSnapshot;
    @Column(name="service_name_snapshot", nullable=false, length=150) private String serviceNameSnapshot;
    @Column(name="item_type_code_snapshot", nullable=false, length=40) private String itemTypeCodeSnapshot;
    @Column(name="item_type_name_snapshot", nullable=false, length=150) private String itemTypeNameSnapshot;
    @Enumerated(EnumType.STRING) @Column(name="pricing_method_snapshot", nullable=false, length=30) private PricingMethod pricingMethodSnapshot;
    @Enumerated(EnumType.STRING) @Column(name="unit_type_snapshot", nullable=false, length=20) private UnitType unitTypeSnapshot;
    @Enumerated(EnumType.STRING) @Column(name="sharing_mode_snapshot", nullable=false, length=30) private SharingMode sharingModeSnapshot;
    @Column(nullable=false, precision=10, scale=3) private BigDecimal quantity;
    @Column(name="billable_quantity", nullable=false, precision=10, scale=3) private BigDecimal billableQuantity;
    @Column(name="line_amount", nullable=false, precision=18, scale=2) private BigDecimal lineAmount;
    @Column(length=1000) private String note;
    @Column(name="pricing_snapshot_json", nullable=false, columnDefinition="TEXT") private String pricingSnapshotJson;
    @Column(name="quoted_at", nullable=false) private Instant quotedAt;
    protected OrderItem() {}
    public OrderItem(LaundryService service, ItemType itemType, String serviceCode, String serviceName,
                     String itemCode, String itemName, PricingMethod method, UnitType unit, SharingMode sharing,
                     BigDecimal quantity, BigDecimal billable, BigDecimal amount, String note, String snapshot, Instant quotedAt) {
        this.service=service; this.itemType=Objects.requireNonNull(itemType,"itemType"); this.serviceCodeSnapshot=serviceCode; this.serviceNameSnapshot=serviceName;
        this.itemTypeCodeSnapshot=Objects.requireNonNull(itemCode,"itemCode"); this.itemTypeNameSnapshot=Objects.requireNonNull(itemName,"itemName"); this.pricingMethodSnapshot=method;
        this.unitTypeSnapshot=unit; this.sharingModeSnapshot=sharing; this.quantity=quantity; this.billableQuantity=billable;
        this.lineAmount=amount; this.note=note; this.pricingSnapshotJson=snapshot; this.quotedAt=quotedAt;
    }
    void attach(LaundryOrder value){order=value;}
    public LaundryOrder getOrder(){return order;} public LaundryService getService(){return service;} public ItemType getItemType(){return itemType;}
    public Long getId(){return id;} public Long getServiceId(){return service.getId();} public Long getItemTypeId(){return itemType.getId();}
    public String getServiceCodeSnapshot(){return serviceCodeSnapshot;} public String getServiceNameSnapshot(){return serviceNameSnapshot;}
    public String getItemTypeCodeSnapshot(){return itemTypeCodeSnapshot;} public String getItemTypeNameSnapshot(){return itemTypeNameSnapshot;}
    public PricingMethod getPricingMethodSnapshot(){return pricingMethodSnapshot;} public UnitType getUnitTypeSnapshot(){return unitTypeSnapshot;}
    public SharingMode getSharingModeSnapshot(){return sharingModeSnapshot;} public BigDecimal getQuantity(){return quantity;}
    public BigDecimal getBillableQuantity(){return billableQuantity;} public BigDecimal getLineAmount(){return lineAmount;}
    public String getNote(){return note;} public String getPricingSnapshotJson(){return pricingSnapshotJson;} public Instant getQuotedAt(){return quotedAt;}
    public void updateNote(String value){this.note=value;}
}
