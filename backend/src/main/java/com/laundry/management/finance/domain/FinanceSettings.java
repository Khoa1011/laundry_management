package com.laundry.management.finance.domain;

import com.laundry.management.operations.domain.PolicySettings;
import jakarta.persistence.*;

@Entity @Table(name="finance_settings")
public class FinanceSettings extends PolicySettings {
    @Column(name="default_account_id") private Long defaultAccountId;
    protected FinanceSettings() {}
    public FinanceSettings(Long branchId) { super(branchId); }
    public Long getDefaultAccountId() { return defaultAccountId; }
    public void setDefaultAccountId(Long id) { defaultAccountId=id; }
}
