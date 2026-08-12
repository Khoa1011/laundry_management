package com.laundry.management.employee.domain;

import com.laundry.management.auth.domain.UserAccount;
import jakarta.persistence.*;
import java.time.Instant;
import java.time.LocalDate;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

@Entity
@Table(name = "employee_identities")
public class EmployeeIdentity {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @ManyToOne(fetch = FetchType.LAZY, optional = false) @JoinColumn(name = "employee_id", nullable = false)
    private Employee employee;
    @Enumerated(EnumType.STRING) @Column(name = "identity_type", nullable = false, length = 30)
    private EmployeeIdentityType identityType;
    @Column(name = "encrypted_number", nullable = false, columnDefinition = "TEXT")
    private String encryptedNumber;
    @Column(name = "number_hash", nullable = false, length = 64)
    private String numberHash;
    @Column(name = "number_last4", nullable = false, length = 4)
    private String numberLast4;
    @Column(name = "issued_date") private LocalDate issuedDate;
    @Column(name = "issued_place", length = 255) private String issuedPlace;
    @Column(name = "expires_on") private LocalDate expiresOn;
    @Enumerated(EnumType.STRING) @Column(name = "verification_status", nullable = false, length = 30)
    private EmployeeIdentityVerificationStatus verificationStatus;
    @Column(name = "verification_reason", length = 500) private String verificationReason;
    @Column(name = "verified_at") private Instant verifiedAt;
    @ManyToOne(fetch = FetchType.LAZY) @JoinColumn(name = "verified_by") private UserAccount verifiedBy;
    @Version @Column(nullable = false) private long version;
    @CreationTimestamp @Column(name = "created_at", nullable = false, updatable = false) private Instant createdAt;
    @UpdateTimestamp @Column(name = "updated_at", nullable = false) private Instant updatedAt;
    @ManyToOne(fetch = FetchType.LAZY, optional = false) @JoinColumn(name = "created_by", nullable = false, updatable = false) private UserAccount createdBy;
    @ManyToOne(fetch = FetchType.LAZY, optional = false) @JoinColumn(name = "updated_by", nullable = false) private UserAccount updatedBy;

    protected EmployeeIdentity() { }

    public EmployeeIdentity(Employee employee, EmployeeIdentityType type, String encryptedNumber,
                            String numberHash, String numberLast4, LocalDate issuedDate,
                            String issuedPlace, LocalDate expiresOn, UserAccount actor) {
        this.employee = employee;
        this.identityType = type;
        apply(encryptedNumber, numberHash, numberLast4, issuedDate, issuedPlace, expiresOn, actor);
        this.createdBy = actor;
    }

    public void update(String encryptedNumber, String numberHash, String numberLast4,
                       LocalDate issuedDate, String issuedPlace, LocalDate expiresOn, UserAccount actor) {
        apply(encryptedNumber, numberHash, numberLast4, issuedDate, issuedPlace, expiresOn, actor);
    }

    private void apply(String encryptedNumber, String numberHash, String numberLast4,
                       LocalDate issuedDate, String issuedPlace, LocalDate expiresOn, UserAccount actor) {
        this.encryptedNumber = encryptedNumber;
        this.numberHash = numberHash;
        this.numberLast4 = numberLast4;
        this.issuedDate = issuedDate;
        this.issuedPlace = issuedPlace;
        this.expiresOn = expiresOn;
        this.verificationStatus = EmployeeIdentityVerificationStatus.NOT_VERIFIED;
        this.verificationReason = null;
        this.verifiedAt = null;
        this.verifiedBy = null;
        this.updatedBy = actor;
    }

    public void verify(EmployeeIdentityVerificationStatus status, String reason, UserAccount actor) {
        this.verificationStatus = status;
        this.verificationReason = reason;
        this.verifiedAt = status == EmployeeIdentityVerificationStatus.NOT_VERIFIED ? null : Instant.now();
        this.verifiedBy = status == EmployeeIdentityVerificationStatus.NOT_VERIFIED ? null : actor;
        this.updatedBy = actor;
    }

    public Long getId() { return id; }
    public EmployeeIdentityType getIdentityType() { return identityType; }
    public String getEncryptedNumber() { return encryptedNumber; }
    public String getNumberHash() { return numberHash; }
    public String getNumberLast4() { return numberLast4; }
    public LocalDate getIssuedDate() { return issuedDate; }
    public String getIssuedPlace() { return issuedPlace; }
    public LocalDate getExpiresOn() { return expiresOn; }
    public EmployeeIdentityVerificationStatus getVerificationStatus() { return verificationStatus; }
    public String getVerificationReason() { return verificationReason; }
    public Instant getVerifiedAt() { return verifiedAt; }
    public long getVersion() { return version; }
    public Instant getUpdatedAt() { return updatedAt; }
}
