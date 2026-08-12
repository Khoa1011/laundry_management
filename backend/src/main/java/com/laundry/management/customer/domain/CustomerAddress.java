package com.laundry.management.customer.domain;

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
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

@Entity
@Table(name = "customer_addresses")
public class CustomerAddress {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "customer_id", nullable = false)
    private Customer customer;

    @Column(name = "receiver_name", nullable = false, length = 150)
    private String receiverName;

    @Column(name = "receiver_phone", nullable = false, length = 30)
    private String receiverPhone;

    @Column(name = "normalized_receiver_phone", nullable = false, length = 20)
    private String normalizedReceiverPhone;

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

    @Column(name = "address_line", nullable = false, length = 500)
    private String addressLine;

    @Column(name = "delivery_note", length = 1000)
    private String deliveryNote;

    @Column(name = "is_default", nullable = false)
    private boolean defaultAddress;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private AddressStatus status;

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

    protected CustomerAddress() {
    }

    public CustomerAddress(
        Customer customer,
        String receiverName,
        String receiverPhone,
        String normalizedReceiverPhone,
        AdministrativeVersion administrativeVersion,
        String province,
        Integer provinceCode,
        String district,
        Integer districtCode,
        String ward,
        Integer wardCode,
        String addressLine,
        String deliveryNote,
        boolean defaultAddress,
        UserAccount actor
    ) {
        this.customer = customer;
        this.receiverName = receiverName;
        this.receiverPhone = receiverPhone;
        this.normalizedReceiverPhone = normalizedReceiverPhone;
        this.administrativeVersion = administrativeVersion;
        this.province = province;
        this.provinceCode = provinceCode;
        this.district = district;
        this.districtCode = districtCode;
        this.ward = ward;
        this.wardCode = wardCode;
        this.addressLine = addressLine;
        this.deliveryNote = deliveryNote;
        this.defaultAddress = defaultAddress;
        this.status = AddressStatus.ACTIVE;
        this.createdBy = actor;
        this.updatedBy = actor;
    }

    public void update(
        String receiverName,
        String receiverPhone,
        String normalizedReceiverPhone,
        AdministrativeVersion administrativeVersion,
        String province,
        Integer provinceCode,
        String district,
        Integer districtCode,
        String ward,
        Integer wardCode,
        String addressLine,
        String deliveryNote,
        UserAccount actor
    ) {
        this.receiverName = receiverName;
        this.receiverPhone = receiverPhone;
        this.normalizedReceiverPhone = normalizedReceiverPhone;
        this.administrativeVersion = administrativeVersion;
        this.province = province;
        this.provinceCode = provinceCode;
        this.district = district;
        this.districtCode = districtCode;
        this.ward = ward;
        this.wardCode = wardCode;
        this.addressLine = addressLine;
        this.deliveryNote = deliveryNote;
        this.updatedBy = actor;
    }

    public void makeDefault(UserAccount actor) {
        if (status != AddressStatus.ACTIVE) {
            throw new IllegalStateException("Inactive address cannot be default");
        }
        defaultAddress = true;
        updatedBy = actor;
    }

    public void clearDefault(UserAccount actor) {
        defaultAddress = false;
        updatedBy = actor;
    }

    public void changeStatus(AddressStatus newStatus, UserAccount actor) {
        status = newStatus;
        if (newStatus == AddressStatus.INACTIVE) {
            defaultAddress = false;
        }
        updatedBy = actor;
    }

    public Long getId() { return id; }
    public Customer getCustomer() { return customer; }
    public String getReceiverName() { return receiverName; }
    public String getReceiverPhone() { return receiverPhone; }
    public String getNormalizedReceiverPhone() { return normalizedReceiverPhone; }
    public AdministrativeVersion getAdministrativeVersion() { return administrativeVersion; }
    public String getProvince() { return province; }
    public Integer getProvinceCode() { return provinceCode; }
    public String getDistrict() { return district; }
    public Integer getDistrictCode() { return districtCode; }
    public String getWard() { return ward; }
    public Integer getWardCode() { return wardCode; }
    public String getAddressLine() { return addressLine; }
    public String getDeliveryNote() { return deliveryNote; }
    public boolean isDefaultAddress() { return defaultAddress; }
    public AddressStatus getStatus() { return status; }
    public long getVersion() { return version; }
    public Instant getCreatedAt() { return createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
}
