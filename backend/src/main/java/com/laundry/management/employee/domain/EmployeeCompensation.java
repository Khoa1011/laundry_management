package com.laundry.management.employee.domain;

import com.laundry.management.auth.domain.UserAccount;
import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

@Entity
@Table(name = "employee_compensations")
public class EmployeeCompensation {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @ManyToOne(fetch = FetchType.LAZY, optional = false) @JoinColumn(name = "employee_id", nullable = false)
    private Employee employee;
    @Column(name = "base_salary", nullable = false, precision = 18, scale = 2)
    private BigDecimal baseSalary;
    @Column(nullable = false, length = 3)
    private String currency;
    @Column(name = "effective_from", nullable = false)
    private LocalDate effectiveFrom;
    @Column(name = "effective_to")
    private LocalDate effectiveTo;
    @Enumerated(EnumType.STRING) @Column(nullable = false, length = 20)
    private EmployeeCompensationStatus status;
    @Column(nullable = false, length = 500)
    private String reason;
    @Version @Column(nullable = false)
    private long version;
    @CreationTimestamp @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;
    @UpdateTimestamp @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;
    @ManyToOne(fetch = FetchType.LAZY, optional = false) @JoinColumn(name = "created_by", nullable = false, updatable = false)
    private UserAccount createdBy;
    @ManyToOne(fetch = FetchType.LAZY, optional = false) @JoinColumn(name = "updated_by", nullable = false)
    private UserAccount updatedBy;

    protected EmployeeCompensation() { }

    public EmployeeCompensation(Employee employee, BigDecimal baseSalary, String currency,
                                LocalDate effectiveFrom, EmployeeCompensationStatus status,
                                String reason, UserAccount actor) {
        this.employee = employee;
        this.baseSalary = baseSalary;
        this.currency = currency;
        this.effectiveFrom = effectiveFrom;
        this.status = status;
        this.reason = reason;
        this.createdBy = actor;
        this.updatedBy = actor;
    }

    public void endOn(LocalDate date, UserAccount actor) {
        this.effectiveTo = date;
        this.status = date.isBefore(LocalDate.now())
            ? EmployeeCompensationStatus.ENDED : EmployeeCompensationStatus.ACTIVE;
        this.updatedBy = actor;
    }

    public void reconcileStatus(EmployeeCompensationStatus status) {
        this.status = status;
    }

    public Long getId() { return id; }
    public BigDecimal getBaseSalary() { return baseSalary; }
    public String getCurrency() { return currency; }
    public LocalDate getEffectiveFrom() { return effectiveFrom; }
    public LocalDate getEffectiveTo() { return effectiveTo; }
    public EmployeeCompensationStatus getStatus() { return status; }
    public String getReason() { return reason; }
    public long getVersion() { return version; }
    public Instant getCreatedAt() { return createdAt; }
    public UserAccount getCreatedBy() { return createdBy; }
}
