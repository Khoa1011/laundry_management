package com.laundry.management.servicecatalog.domain;

import com.laundry.management.auth.domain.UserAccount;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import jakarta.persistence.Version;
import java.math.BigDecimal;
import java.time.Instant;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

@Entity
@Table(name = "laundry_services")
public class LaundryService {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true, length = 40)
    private String code;

    @Column(name = "name_vi", nullable = false, length = 150)
    private String nameVi;

    @Column(name = "name_en", length = 150)
    private String nameEn;

    @Column(name = "description_vi", length = 1000)
    private String descriptionVi;

    @Column(name = "description_en", length = 1000)
    private String descriptionEn;

    @Enumerated(EnumType.STRING)
    @Column(name = "processing_type", nullable = false, length = 40)
    private ProcessingType processingType;

    @Enumerated(EnumType.STRING)
    @Column(name = "default_unit_type", nullable = false, length = 20)
    private UnitType defaultUnitType;

    @Column(name = "sharing_allowed", nullable = false)
    private boolean sharingAllowed;

    @Column(name = "estimated_minutes")
    private Integer estimatedMinutes;

    @Column(name = "minimum_quantity", precision = 10, scale = 3)
    private BigDecimal minimumQuantity;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private CatalogStatus status;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "created_by", nullable = false, updatable = false)
    private UserAccount createdBy;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "updated_by", nullable = false)
    private UserAccount updatedBy;

    @Version
    @Column(nullable = false)
    private long version;

    protected LaundryService() {
    }

    public LaundryService(
        String code,
        String nameVi,
        String nameEn,
        String descriptionVi,
        String descriptionEn,
        ProcessingType processingType,
        UnitType defaultUnitType,
        boolean sharingAllowed,
        Integer estimatedMinutes,
        BigDecimal minimumQuantity,
        UserAccount actor
    ) {
        this.code = code;
        this.status = CatalogStatus.ACTIVE;
        this.createdBy = actor;
        update(nameVi, nameEn, descriptionVi, descriptionEn, processingType, defaultUnitType,
            sharingAllowed, estimatedMinutes, minimumQuantity, actor);
    }

    public void update(
        String nameVi,
        String nameEn,
        String descriptionVi,
        String descriptionEn,
        ProcessingType processingType,
        UnitType defaultUnitType,
        boolean sharingAllowed,
        Integer estimatedMinutes,
        BigDecimal minimumQuantity,
        UserAccount actor
    ) {
        this.nameVi = nameVi;
        this.nameEn = nameEn;
        this.descriptionVi = descriptionVi;
        this.descriptionEn = descriptionEn;
        this.processingType = processingType;
        this.defaultUnitType = defaultUnitType;
        this.sharingAllowed = sharingAllowed;
        this.estimatedMinutes = estimatedMinutes;
        this.minimumQuantity = minimumQuantity;
        this.updatedBy = actor;
    }

    public void changeStatus(CatalogStatus status, UserAccount actor) {
        this.status = status;
        this.updatedBy = actor;
    }

    public Long getId() { return id; }
    public String getCode() { return code; }
    public String getNameVi() { return nameVi; }
    public String getNameEn() { return nameEn; }
    public String getDescriptionVi() { return descriptionVi; }
    public String getDescriptionEn() { return descriptionEn; }
    public ProcessingType getProcessingType() { return processingType; }
    public UnitType getDefaultUnitType() { return defaultUnitType; }
    public boolean isSharingAllowed() { return sharingAllowed; }
    public Integer getEstimatedMinutes() { return estimatedMinutes; }
    public BigDecimal getMinimumQuantity() { return minimumQuantity; }
    public CatalogStatus getStatus() { return status; }
    public Instant getCreatedAt() { return createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
    public UserAccount getUpdatedBy() { return updatedBy; }
    public long getVersion() { return version; }
}
