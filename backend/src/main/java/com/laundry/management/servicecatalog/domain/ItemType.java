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
import java.time.Instant;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

@Entity
@Table(name = "item_types")
public class ItemType {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true, length = 40)
    private String code;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "parent_id")
    private ItemType parent;

    @Column(name = "name_vi", nullable = false, length = 150)
    private String nameVi;

    @Column(name = "name_en", length = 150)
    private String nameEn;

    @Column(name = "description_vi", length = 1000)
    private String descriptionVi;

    @Column(name = "description_en", length = 1000)
    private String descriptionEn;

    @Enumerated(EnumType.STRING)
    @Column(name = "default_unit_type", length = 20)
    private UnitType defaultUnitType;

    @Column(name = "requires_separate_wash", nullable = false)
    private boolean requiresSeparateWash;

    @Column(name = "default_color_risk", length = 30)
    private String defaultColorRisk;

    @Column(name = "default_hygiene_level", length = 30)
    private String defaultHygieneLevel;

    @Column(name = "sort_order", nullable = false)
    private int sortOrder;

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

    protected ItemType() {
    }

    public ItemType(
        String code,
        ItemType parent,
        String nameVi,
        String nameEn,
        String descriptionVi,
        String descriptionEn,
        UnitType defaultUnitType,
        boolean requiresSeparateWash,
        String defaultColorRisk,
        String defaultHygieneLevel,
        int sortOrder,
        UserAccount actor
    ) {
        this.code = code;
        this.status = CatalogStatus.ACTIVE;
        this.createdBy = actor;
        update(parent, nameVi, nameEn, descriptionVi, descriptionEn, defaultUnitType,
            requiresSeparateWash, defaultColorRisk, defaultHygieneLevel, sortOrder, actor);
    }

    public void update(
        ItemType parent,
        String nameVi,
        String nameEn,
        String descriptionVi,
        String descriptionEn,
        UnitType defaultUnitType,
        boolean requiresSeparateWash,
        String defaultColorRisk,
        String defaultHygieneLevel,
        int sortOrder,
        UserAccount actor
    ) {
        this.parent = parent;
        this.nameVi = nameVi;
        this.nameEn = nameEn;
        this.descriptionVi = descriptionVi;
        this.descriptionEn = descriptionEn;
        this.defaultUnitType = defaultUnitType;
        this.requiresSeparateWash = requiresSeparateWash;
        this.defaultColorRisk = defaultColorRisk;
        this.defaultHygieneLevel = defaultHygieneLevel;
        this.sortOrder = sortOrder;
        this.updatedBy = actor;
    }

    public void changeStatus(CatalogStatus status, UserAccount actor) {
        this.status = status;
        this.updatedBy = actor;
    }

    public Long getId() { return id; }
    public String getCode() { return code; }
    public ItemType getParent() { return parent; }
    public String getNameVi() { return nameVi; }
    public String getNameEn() { return nameEn; }
    public String getDescriptionVi() { return descriptionVi; }
    public String getDescriptionEn() { return descriptionEn; }
    public UnitType getDefaultUnitType() { return defaultUnitType; }
    public boolean isRequiresSeparateWash() { return requiresSeparateWash; }
    public String getDefaultColorRisk() { return defaultColorRisk; }
    public String getDefaultHygieneLevel() { return defaultHygieneLevel; }
    public int getSortOrder() { return sortOrder; }
    public CatalogStatus getStatus() { return status; }
    public Instant getCreatedAt() { return createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
    public UserAccount getUpdatedBy() { return updatedBy; }
    public long getVersion() { return version; }
}
