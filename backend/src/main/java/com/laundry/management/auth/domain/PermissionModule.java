package com.laundry.management.auth.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

@Entity
@Table(name = "permission_modules")
public class PermissionModule {

    @Id
    @Column(length = 60)
    private String code;

    @Column(name = "name_vi", nullable = false, length = 150)
    private String nameVi;

    @Column(name = "name_en", nullable = false, length = 150)
    private String nameEn;

    @Column(name = "display_order", nullable = false)
    private int displayOrder;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private PermissionStatus status;

    protected PermissionModule() {
    }

    public String getCode() { return code; }
    public String getNameVi() { return nameVi; }
    public String getNameEn() { return nameEn; }
    public int getDisplayOrder() { return displayOrder; }
    public PermissionStatus getStatus() { return status; }
}
