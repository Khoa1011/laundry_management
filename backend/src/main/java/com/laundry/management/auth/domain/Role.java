package com.laundry.management.auth.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.JoinTable;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.ManyToMany;
import jakarta.persistence.Table;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Version;
import java.time.Instant;
import java.util.LinkedHashSet;
import java.util.Set;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.BatchSize;
import org.hibernate.annotations.UpdateTimestamp;

@Entity
@Table(name = "roles")
public class Role {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true, length = 60)
    private String code;

    @Column(nullable = false, length = 120)
    private String name;

    @Column(length = 500)
    private String description;

    @Column(name = "display_name", length = 150)
    private String displayName;

    @Column(name = "business_description", length = 1000)
    private String businessDescription;

    @Column(name = "name_vi", length = 120)
    private String nameVi;

    @Column(name = "name_en", length = 120)
    private String nameEn;

    @Column(name = "description_vi", length = 500)
    private String descriptionVi;

    @Column(name = "description_en", length = 500)
    private String descriptionEn;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private RoleStatus status;

    @Column(name = "is_system", nullable = false)
    private boolean system;

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

    @ManyToMany(fetch = FetchType.LAZY)
    @BatchSize(size = 50)
    @JoinTable(
        name = "role_permissions",
        joinColumns = @JoinColumn(name = "role_id"),
        inverseJoinColumns = @JoinColumn(name = "permission_id")
    )
    private Set<Permission> permissions = new LinkedHashSet<>();

    protected Role() {
    }

    public Role(String code, String displayName, String description, UserAccount actor) {
        this.code = code;
        this.displayName = displayName;
        this.businessDescription = description;
        this.name = abbreviate(displayName, 120);
        this.description = abbreviate(description, 500);
        this.status = RoleStatus.ACTIVE;
        this.system = false;
        this.createdBy = actor;
        this.updatedBy = actor;
    }

    public Long getId() {
        return id;
    }

    public String getCode() {
        return code;
    }

    public Set<Permission> getPermissions() {
        return Set.copyOf(permissions);
    }

    public void updateCustomMetadata(String displayName, String description, UserAccount actor) {
        this.displayName = displayName;
        this.businessDescription = description;
        this.name = abbreviate(displayName, 120);
        this.description = abbreviate(description, 500);
        this.updatedBy = actor;
    }

    public void changeStatus(RoleStatus status, UserAccount actor) {
        this.status = status;
        this.updatedBy = actor;
    }

    public void markUpdatedBy(UserAccount actor) {
        this.updatedBy = actor;
    }

    public void replacePermissions(Set<Permission> next) {
        permissions.clear();
        permissions.addAll(next);
    }

    public String getNameVi() { return nameVi; }
    public String getNameEn() { return nameEn; }
    public String getDescriptionVi() { return descriptionVi; }
    public String getDescriptionEn() { return descriptionEn; }
    public String getDisplayName() { return displayName == null ? name : displayName; }
    public String getBusinessDescription() {
        return businessDescription == null ? description : businessDescription;
    }
    public RoleStatus getStatus() { return status; }
    public boolean isSystem() { return system; }
    public long getVersion() { return version; }
    public Instant getCreatedAt() { return createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
    public UserAccount getCreatedBy() { return createdBy; }
    public UserAccount getUpdatedBy() { return updatedBy; }

    private static String abbreviate(String value, int maxLength) {
        if (value == null || value.length() <= maxLength) return value;
        return value.substring(0, maxLength);
    }
}
