package com.laundry.management.inventory.domain;

import com.laundry.management.operations.domain.CatalogRecord;
import jakarta.persistence.*;
import java.math.BigDecimal;

@Entity @Table(name="suppliers")
public class Supplier extends CatalogRecord {
    @Column(name="phone", nullable=true, length=30) private String phone;
    @Column(name="email", nullable=true, length=150) private String email;
    @Column(name="address", nullable=true, length=500) private String address;
    @Column(name="tax_number", nullable=true, length=50) private String taxNumber;
    @Column(name="contact_name", nullable=true, length=150) private String contactName;
    @Column(name="material_groups", nullable=true, length=500) private String materialGroups;
    public Supplier() {}
    public String getPhone() { return phone; }
    public void setPhone(String value) { this.phone = value; }
    public String getEmail() { return email; }
    public void setEmail(String value) { this.email = value; }
    public String getAddress() { return address; }
    public void setAddress(String value) { this.address = value; }
    public String getTaxNumber() { return taxNumber; }
    public void setTaxNumber(String value) { this.taxNumber = value; }
    public String getContactName() { return contactName; }
    public void setContactName(String value) { this.contactName = value; }
    public String getMaterialGroups() { return materialGroups; }
    public void setMaterialGroups(String value) { this.materialGroups = value; }
}
