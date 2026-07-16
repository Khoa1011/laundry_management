package com.laundry.management.customer.domain;

import com.laundry.management.auth.domain.Branch;
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
import java.time.LocalDate;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

@Entity
@Table(name = "customers")
public class Customer {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "customer_code", nullable = false, unique = true, length = 30)
    private String customerCode;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "branch_id", nullable = false)
    private Branch branch;

    @Column(name = "full_name", nullable = false, length = 150)
    private String fullName;

    @Column(nullable = false, length = 30)
    private String phone;

    @Column(name = "normalized_phone", nullable = false, length = 20)
    private String normalizedPhone;

    @Column(length = 254)
    private String email;

    @Column(name = "birth_date")
    private LocalDate birthDate;

    @Enumerated(EnumType.STRING)
    @Column(name = "customer_type", nullable = false, length = 20)
    private CustomerType customerType;

    @Enumerated(EnumType.STRING)
    @Column(length = 30)
    private CustomerSource source;

    @Column(length = 2000)
    private String note;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private CustomerStatus status;

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

    protected Customer() {
    }

    public Customer(
        String customerCode,
        Branch branch,
        String fullName,
        String phone,
        String normalizedPhone,
        String email,
        LocalDate birthDate,
        CustomerType customerType,
        CustomerSource source,
        String note,
        UserAccount actor
    ) {
        this.customerCode = customerCode;
        this.branch = branch;
        this.fullName = fullName;
        this.phone = phone;
        this.normalizedPhone = normalizedPhone;
        this.email = email;
        this.birthDate = birthDate;
        this.customerType = customerType;
        this.source = source;
        this.note = note;
        this.status = CustomerStatus.ACTIVE;
        this.createdBy = actor;
        this.updatedBy = actor;
    }

    public void update(
        String fullName,
        String phone,
        String normalizedPhone,
        String email,
        LocalDate birthDate,
        CustomerType customerType,
        CustomerSource source,
        String note,
        UserAccount actor
    ) {
        this.fullName = fullName;
        this.phone = phone;
        this.normalizedPhone = normalizedPhone;
        this.email = email;
        this.birthDate = birthDate;
        this.customerType = customerType;
        this.source = source;
        this.note = note;
        this.updatedBy = actor;
    }

    public void changeStatus(CustomerStatus newStatus, UserAccount actor) {
        this.status = newStatus;
        this.updatedBy = actor;
    }

    public Long getId() { return id; }
    public String getCustomerCode() { return customerCode; }
    public Branch getBranch() { return branch; }
    public String getFullName() { return fullName; }
    public String getPhone() { return phone; }
    public String getNormalizedPhone() { return normalizedPhone; }
    public String getEmail() { return email; }
    public LocalDate getBirthDate() { return birthDate; }
    public CustomerType getCustomerType() { return customerType; }
    public CustomerSource getSource() { return source; }
    public String getNote() { return note; }
    public CustomerStatus getStatus() { return status; }
    public long getVersion() { return version; }
    public Instant getCreatedAt() { return createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
}
