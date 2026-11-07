package com.laundry.management.finance.domain;

import com.laundry.management.operations.domain.CatalogRecord;
import jakarta.persistence.*;
import java.math.BigDecimal;

@Entity @Table(name="cash_accounts")
public class CashAccount extends CatalogRecord {
    @Column(name="account_type", nullable=false, length=20) private String accountType;
    public CashAccount() {}
    public String getAccountType() { return accountType; }
    public void setAccountType(String value) { this.accountType = value; }
}
