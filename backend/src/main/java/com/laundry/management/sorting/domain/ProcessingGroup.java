package com.laundry.management.sorting.domain;

import com.laundry.management.auth.domain.UserAccount;
import com.laundry.management.order.domain.OrderBag;
import com.laundry.management.order.domain.OrderItem;
import com.laundry.management.sorting.domain.SortingAttributes.*;
import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.Locale;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

@Entity
@Table(name = "processing_groups")
public class ProcessingGroup {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) private Long id;
    @ManyToOne(fetch = FetchType.LAZY, optional = false) @JoinColumn(name = "order_bag_id") private OrderBag bag;
    @ManyToOne(fetch = FetchType.LAZY, optional = false) @JoinColumn(name = "order_item_id") private OrderItem item;
    @Column(name = "group_code", nullable = false, unique = true, length = 80) private String groupCode;
    @Column(name = "sequence_number", nullable = false) private int sequenceNumber;
    @Column(nullable = false, precision = 10, scale = 3) private BigDecimal quantity;
    @Enumerated(EnumType.STRING) @Column(name = "color_group", nullable = false, length = 30) private ColorGroup colorGroup;
    @Enumerated(EnumType.STRING) @Column(name = "fabric_care", nullable = false, length = 30) private FabricCare fabricCare;
    @Enumerated(EnumType.STRING) @Column(name = "wash_mode", nullable = false, length = 30) private WashMode washMode;
    @Enumerated(EnumType.STRING) @Column(name = "temperature_profile", nullable = false, length = 30) private TemperatureProfile temperatureProfile;
    @Enumerated(EnumType.STRING) @Column(name = "detergent_profile", nullable = false, length = 30) private DetergentProfile detergentProfile;
    @Enumerated(EnumType.STRING) @Column(name = "softener_profile", nullable = false, length = 30) private SoftenerProfile softenerProfile;
    @Enumerated(EnumType.STRING) @Column(name = "hygiene_level", nullable = false, length = 30) private HygieneLevel hygieneLevel;
    @Column(name = "separate_wash", nullable = false) private boolean separateWash;
    @Enumerated(EnumType.STRING) @Column(name = "drying_instruction", nullable = false, length = 30) private DryingInstruction dryingInstruction;
    @Column(length = 1000) private String note;
    @Enumerated(EnumType.STRING) @Column(nullable = false, length = 30) private GroupStatus status;
    @CreationTimestamp @Column(name = "created_at", nullable = false, updatable = false) private Instant createdAt;
    @ManyToOne(fetch = FetchType.LAZY, optional = false) @JoinColumn(name = "created_by", updatable = false) private UserAccount createdBy;
    @UpdateTimestamp @Column(name = "updated_at", nullable = false) private Instant updatedAt;
    @ManyToOne(fetch = FetchType.LAZY, optional = false) @JoinColumn(name = "updated_by") private UserAccount updatedBy;
    @Column(name = "voided_at") private Instant voidedAt;
    @ManyToOne(fetch = FetchType.LAZY) @JoinColumn(name = "voided_by") private UserAccount voidedBy;
    @Column(name = "void_reason", length = 500) private String voidReason;
    @Column(name = "last_print_requested_at") private Instant lastPrintRequestedAt;
    @Column(name = "print_request_count", nullable = false) private int printRequestCount;
    @Version @Column(nullable = false) private long version;

    protected ProcessingGroup() {}
    public ProcessingGroup(OrderBag bag, OrderItem item, int sequence, BigDecimal quantity,
        ColorGroup colorGroup, FabricCare fabricCare, WashMode washMode, TemperatureProfile temperatureProfile,
        DetergentProfile detergentProfile, SoftenerProfile softenerProfile, HygieneLevel hygieneLevel,
        boolean separateWash, DryingInstruction dryingInstruction, String note, UserAccount actor) {
        this.bag = bag; this.item = item; this.sequenceNumber = sequence;
        this.groupCode = bag.getBagCode() + "-G" + String.format(Locale.ROOT, "%02d", sequence);
        this.quantity = quantity; this.colorGroup = colorGroup; this.fabricCare = fabricCare;
        this.washMode = washMode; this.temperatureProfile = temperatureProfile;
        this.detergentProfile = detergentProfile; this.softenerProfile = softenerProfile;
        this.hygieneLevel = hygieneLevel; this.separateWash = separateWash;
        this.dryingInstruction = dryingInstruction; this.note = note;
        this.status = GroupStatus.WAITING; this.createdBy = actor; this.updatedBy = actor;
    }
    public void voidGroup(UserAccount actor, Instant at, String reason) {
        status = GroupStatus.VOIDED; voidedAt = at; voidedBy = actor; voidReason = reason; updatedBy = actor;
    }
    public void recordPrintRequest(UserAccount actor, Instant at) {
        printRequestCount++; lastPrintRequestedAt = at; updatedBy = actor;
    }
    public Long getId() { return id; }
    public OrderBag getBag() { return bag; }
    public OrderItem getItem() { return item; }
    public String getGroupCode() { return groupCode; }
    public int getSequenceNumber() { return sequenceNumber; }
    public BigDecimal getQuantity() { return quantity; }
    public ColorGroup getColorGroup() { return colorGroup; }
    public FabricCare getFabricCare() { return fabricCare; }
    public WashMode getWashMode() { return washMode; }
    public TemperatureProfile getTemperatureProfile() { return temperatureProfile; }
    public DetergentProfile getDetergentProfile() { return detergentProfile; }
    public SoftenerProfile getSoftenerProfile() { return softenerProfile; }
    public HygieneLevel getHygieneLevel() { return hygieneLevel; }
    public boolean isSeparateWash() { return separateWash; }
    public DryingInstruction getDryingInstruction() { return dryingInstruction; }
    public String getNote() { return note; }
    public GroupStatus getStatus() { return status; }
    public Instant getCreatedAt() { return createdAt; }
    public Instant getVoidedAt() { return voidedAt; }
    public String getVoidReason() { return voidReason; }
    public Instant getLastPrintRequestedAt() { return lastPrintRequestedAt; }
    public int getPrintRequestCount() { return printRequestCount; }
    public long getVersion() { return version; }
}
