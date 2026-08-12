package com.laundry.management.auth.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Table;
import java.time.Instant;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

@Entity
@Table(name = "permissions")
public class Permission {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true, length = 100)
    private String code;

    @Column(nullable = false, length = 150)
    private String name;

    @Column(nullable = false, length = 60)
    private String module;

    @Column(length = 100)
    private String resource;

    @Column(length = 60)
    private String action;

    @Column(name = "name_vi", length = 150)
    private String nameVi;

    @Column(name = "name_en", length = 150)
    private String nameEn;

    @Column(name = "description_vi", length = 500)
    private String descriptionVi;

    @Column(name = "description_en", length = 500)
    private String descriptionEn;

    @Enumerated(EnumType.STRING)
    @Column(name = "risk_level", length = 20)
    private PermissionRiskLevel riskLevel;

    @Column(name = "display_order")
    private Integer displayOrder;

    @Column(name = "is_system", nullable = false)
    private boolean system;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private PermissionStatus status;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    protected Permission() {
    }

    public Long getId() {
        return id;
    }

    public String getCode() {
        return code;
    }

    public String getModule() { return module; }
    public String getResource() { return resource; }
    public String getAction() { return action; }
    public String getNameVi() { return nameVi; }
    public String getNameEn() { return nameEn; }
    public String getDescriptionVi() { return descriptionVi; }
    public String getDescriptionEn() { return descriptionEn; }
    public PermissionRiskLevel getRiskLevel() { return riskLevel; }
    public int getDisplayOrder() { return displayOrder == null ? 0 : displayOrder; }
    public boolean isSystem() { return system; }
    public PermissionStatus getStatus() { return status; }
}
