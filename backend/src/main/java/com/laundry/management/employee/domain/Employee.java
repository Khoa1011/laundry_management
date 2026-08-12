package com.laundry.management.employee.domain;

import com.laundry.management.auth.domain.UserAccount;
import com.laundry.management.location.domain.AdministrativeVersion;
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
import java.time.LocalDate;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

@Entity
@Table(name = "employees")
public class Employee {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "employee_code", nullable = false, unique = true, length = 30, updatable = false)
    private String employeeCode;

    @Column(name = "full_name", nullable = false, length = 150)
    private String fullName;

    @Column(length = 30)
    private String phone;

    @Column(name = "normalized_phone", length = 20)
    private String normalizedPhone;

    @Column(length = 254)
    private String email;

    @Column(name = "birth_date")
    private LocalDate birthDate;

    @Column(length = 500)
    private String address;

    @Enumerated(EnumType.STRING)
    @Column(name = "administrative_version", length = 10)
    private AdministrativeVersion administrativeVersion;

    @Column(length = 120)
    private String province;

    @Column(name = "province_code")
    private Integer provinceCode;

    @Column(length = 120)
    private String district;

    @Column(name = "district_code")
    private Integer districtCode;

    @Column(length = 120)
    private String ward;

    @Column(name = "ward_code")
    private Integer wardCode;

    @Column(name = "hire_date", nullable = false)
    private LocalDate hireDate;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "position_id", nullable = false)
    private EmployeePosition position;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private EmployeeStatus status;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "linked_user_id", unique = true)
    private UserAccount linkedUser;

    @Version
    @Column(nullable = false)
    private long version;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "created_by", nullable = false, updatable = false)
    private UserAccount createdBy;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "updated_by", nullable = false)
    private UserAccount updatedBy;

    protected Employee() {
    }

    public Employee(
        String employeeCode,
        String fullName,
        String phone,
        String normalizedPhone,
        String email,
        LocalDate birthDate,
        String address,
        LocalDate hireDate,
        EmployeePosition position,
        EmployeeStatus status,
        UserAccount actor
    ) {
        this(
            employeeCode,
            fullName,
            phone,
            normalizedPhone,
            email,
            birthDate,
            address,
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            hireDate,
            position,
            status,
            actor
        );
    }

    public Employee(
        String employeeCode,
        String fullName,
        String phone,
        String normalizedPhone,
        String email,
        LocalDate birthDate,
        String address,
        AdministrativeVersion administrativeVersion,
        String province,
        Integer provinceCode,
        String district,
        Integer districtCode,
        String ward,
        Integer wardCode,
        LocalDate hireDate,
        EmployeePosition position,
        EmployeeStatus status,
        UserAccount actor
    ) {
        this.employeeCode = employeeCode;
        this.fullName = fullName;
        this.phone = phone;
        this.normalizedPhone = normalizedPhone;
        this.email = email;
        this.birthDate = birthDate;
        this.address = address;
        this.administrativeVersion = administrativeVersion;
        this.province = province;
        this.provinceCode = provinceCode;
        this.district = district;
        this.districtCode = districtCode;
        this.ward = ward;
        this.wardCode = wardCode;
        this.hireDate = hireDate;
        this.position = position;
        this.status = status;
        this.createdBy = actor;
        this.updatedBy = actor;
    }

    public void updateProfile(
        String fullName,
        String phone,
        String normalizedPhone,
        String email,
        LocalDate birthDate,
        String address,
        AdministrativeVersion administrativeVersion,
        String province,
        Integer provinceCode,
        String district,
        Integer districtCode,
        String ward,
        Integer wardCode,
        LocalDate hireDate,
        UserAccount actor
    ) {
        this.fullName = fullName;
        this.phone = phone;
        this.normalizedPhone = normalizedPhone;
        this.email = email;
        this.birthDate = birthDate;
        this.address = address;
        this.administrativeVersion = administrativeVersion;
        this.province = province;
        this.provinceCode = provinceCode;
        this.district = district;
        this.districtCode = districtCode;
        this.ward = ward;
        this.wardCode = wardCode;
        this.hireDate = hireDate;
        markChanged(actor);
    }

    public void changeStatus(EmployeeStatus status, UserAccount actor) {
        this.status = status;
        markChanged(actor);
    }

    public void changePosition(EmployeePosition position, UserAccount actor) {
        this.position = position;
        markChanged(actor);
    }

    public void linkUser(UserAccount user, UserAccount actor) {
        this.linkedUser = user;
        markChanged(actor);
    }

    public void unlinkUser(UserAccount actor) {
        this.linkedUser = null;
        markChanged(actor);
    }

    public void markChanged(UserAccount actor) {
        this.updatedBy = actor;
        this.updatedAt = Instant.now();
    }

    public Long getId() { return id; }
    public String getEmployeeCode() { return employeeCode; }
    public String getFullName() { return fullName; }
    public String getPhone() { return phone; }
    public String getNormalizedPhone() { return normalizedPhone; }
    public String getEmail() { return email; }
    public LocalDate getBirthDate() { return birthDate; }
    public String getAddress() { return address; }
    public AdministrativeVersion getAdministrativeVersion() { return administrativeVersion; }
    public String getProvince() { return province; }
    public Integer getProvinceCode() { return provinceCode; }
    public String getDistrict() { return district; }
    public Integer getDistrictCode() { return districtCode; }
    public String getWard() { return ward; }
    public Integer getWardCode() { return wardCode; }
    public LocalDate getHireDate() { return hireDate; }
    public EmployeePosition getPosition() { return position; }
    public EmployeeStatus getStatus() { return status; }
    public UserAccount getLinkedUser() { return linkedUser; }
    public long getVersion() { return version; }
    public Instant getCreatedAt() { return createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
}
