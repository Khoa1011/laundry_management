package com.laundry.management.employee.domain;

import com.laundry.management.auth.domain.UserAccount;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
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
@Table(name = "employee_positions")
public class EmployeePosition {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true, length = 60)
    private String code;

    @Column(name = "name_vi", nullable = false, length = 150)
    private String nameVi;

    @Column(name = "name_en", nullable = false, length = 150)
    private String nameEn;

    @Column(name = "description_vi", length = 500)
    private String descriptionVi;

    @Column(name = "description_en", length = 500)
    private String descriptionEn;

    @Column(nullable = false)
    private boolean active;

    @Column(name = "sort_order", nullable = false)
    private int sortOrder;

    @Version
    @Column(nullable = false)
    private long version;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "created_by")
    private UserAccount createdBy;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "updated_by")
    private UserAccount updatedBy;

    protected EmployeePosition() {
    }

    public EmployeePosition(
        String code,
        String nameVi,
        String nameEn,
        String descriptionVi,
        String descriptionEn,
        int sortOrder,
        UserAccount actor
    ) {
        this.code = code;
        this.nameVi = nameVi;
        this.nameEn = nameEn;
        this.descriptionVi = descriptionVi;
        this.descriptionEn = descriptionEn;
        this.active = true;
        this.sortOrder = sortOrder;
        this.createdBy = actor;
        this.updatedBy = actor;
    }

    public void update(
        String nameVi,
        String nameEn,
        String descriptionVi,
        String descriptionEn,
        boolean active,
        int sortOrder,
        UserAccount actor
    ) {
        this.nameVi = nameVi;
        this.nameEn = nameEn;
        this.descriptionVi = descriptionVi;
        this.descriptionEn = descriptionEn;
        this.active = active;
        this.sortOrder = sortOrder;
        this.updatedBy = actor;
    }

    public Long getId() { return id; }
    public String getCode() { return code; }
    public String getNameVi() { return nameVi; }
    public String getNameEn() { return nameEn; }
    public String getDescriptionVi() { return descriptionVi; }
    public String getDescriptionEn() { return descriptionEn; }
    public boolean isActive() { return active; }
    public int getSortOrder() { return sortOrder; }
    public long getVersion() { return version; }
    public Instant getCreatedAt() { return createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
}
