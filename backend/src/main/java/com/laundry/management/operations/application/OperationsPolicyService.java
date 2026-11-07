package com.laundry.management.operations.application;

import com.laundry.management.auth.infrastructure.BranchRepository;
import com.laundry.management.finance.domain.FinanceSettings;
import com.laundry.management.finance.infrastructure.*;
import com.laundry.management.inventory.domain.InventorySettings;
import com.laundry.management.inventory.infrastructure.*;
import com.laundry.management.operations.api.*;
import com.laundry.management.operations.domain.PolicySettings;
import com.laundry.management.operations.infrastructure.OperationsAuditRepository;
import jakarta.validation.Valid;
import org.springframework.validation.annotation.Validated;
import java.time.*;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Validated
public class OperationsPolicyService {
    private final OperationsAccess access;
    private final CatalogPersistence data;
    private final BranchRepository branches;
    private final InventorySettingsRepository inventory;
    private final FinanceSettingsRepository finance;
    private final WarehouseRepository warehouses;
    private final CashAccountRepository accounts;
    private final OperationsAuditRepository audits;
    private final Clock clock;

    public OperationsPolicyService(OperationsAccess access, CatalogPersistence data, BranchRepository branches,
        InventorySettingsRepository inventory, FinanceSettingsRepository finance, WarehouseRepository warehouses,
        CashAccountRepository accounts, OperationsAuditRepository audits, Clock clock) {
        this.access=access; this.data=data; this.branches=branches; this.inventory=inventory; this.finance=finance;
        this.warehouses=warehouses; this.accounts=accounts; this.audits=audits; this.clock=clock;
    }

    @PreAuthorize("@permissionChecker.has(authentication, T(com.laundry.management.auth.security.permission.PermissionCodes).INVENTORY_SETTINGS_READ)")
    @Transactional(readOnly=true)
    public PolicyDtos.Response inventory(Long branchId) {
        Long branch=access.branch(branchId);
        return inventory.findById(branch).map(s -> response(s, s.getDefaultWarehouseId(), true)).orElseGet(() -> defaults(branch, true));
    }

    @PreAuthorize("@permissionChecker.has(authentication, T(com.laundry.management.auth.security.permission.PermissionCodes).FINANCE_SETTINGS_READ)")
    @Transactional(readOnly=true)
    public PolicyDtos.Response finance(Long branchId) {
        Long branch=access.branch(branchId);
        return finance.findById(branch).map(s -> response(s, s.getDefaultAccountId(), false)).orElseGet(() -> defaults(branch, false));
    }

    @PreAuthorize("@permissionChecker.has(authentication, T(com.laundry.management.auth.security.permission.PermissionCodes).INVENTORY_SETTINGS_MANAGE)")
    @Transactional
    public PolicyDtos.Response saveInventory(@Valid PolicyDtos.Request request) {
        Long branch=lock(request.branchId());
        InventorySettings settings=inventory.findCurrentForUpdate(branch).orElse(null);
        OperationsAccess.version(settings==null?-1:settings.getVersion(), request.version());
        if(request.defaultResourceId()!=null) data.active(warehouses, request.defaultResourceId(), branch);
        if(settings==null) settings=new InventorySettings(branch);
        settings.setDefaultWarehouseId(request.defaultResourceId());
        update(settings, request); inventory.saveAndFlush(settings);
        record(branch, "inventory");
        return response(settings, settings.getDefaultWarehouseId(), true);
    }

    @PreAuthorize("@permissionChecker.has(authentication, T(com.laundry.management.auth.security.permission.PermissionCodes).FINANCE_SETTINGS_MANAGE)")
    @Transactional
    public PolicyDtos.Response saveFinance(@Valid PolicyDtos.Request request) {
        Long branch=lock(request.branchId());
        FinanceSettings settings=finance.findCurrentForUpdate(branch).orElse(null);
        OperationsAccess.version(settings==null?-1:settings.getVersion(), request.version());
        if(request.defaultResourceId()!=null) data.active(accounts, request.defaultResourceId(), branch);
        if(settings==null) settings=new FinanceSettings(branch);
        settings.setDefaultAccountId(request.defaultResourceId());
        update(settings, request); finance.saveAndFlush(settings);
        record(branch, "finance");
        return response(settings, settings.getDefaultAccountId(), false);
    }

    @PreAuthorize("@permissionChecker.has(authentication, T(com.laundry.management.auth.security.permission.PermissionCodes).INVENTORY_AUDIT_READ)")
    @Transactional(readOnly=true)
    public OperationsDtos.PageResponse<PolicyDtos.Audit> inventoryHistory(Long branchId, int page, int size) { return history(branchId,"inventory",page,size); }

    @PreAuthorize("@permissionChecker.has(authentication, T(com.laundry.management.auth.security.permission.PermissionCodes).FINANCE_AUDIT_READ)")
    @Transactional(readOnly=true)
    public OperationsDtos.PageResponse<PolicyDtos.Audit> financeHistory(Long branchId, int page, int size) { return history(branchId,"finance",page,size); }

    private OperationsDtos.PageResponse<PolicyDtos.Audit> history(Long branchId, String module, int page, int size) {
        var result=audits.findByBranchIdAndModule(access.branch(branchId),module,CatalogPersistence.page(page,size));
        return data.response(result,result.stream().map(a -> new PolicyDtos.Audit(a.getId(),a.getResource(),a.getRecordId(),a.getAction(),a.getActorId(),a.getOccurredAt(),a.getChangedFields())).toList());
    }

    private Long lock(Long branchId) {
        Long branch=access.branch(branchId); branches.findByIdForUpdate(branch).orElseThrow(OperationsAccess::missing); return branch;
    }
    private void update(PolicySettings settings, PolicyDtos.Request r) { settings.update(r.allowNegative(), access.actor(), Instant.now(clock)); }
    private void record(Long branch, String module) { data.audit(branch,module,"settings",branch,"UPDATED","allowNegative,defaultResourceId"); }
    private PolicyDtos.Response defaults(Long branch, boolean stock) { return new PolicyDtos.Response(branch,-1,false,null,stock?"MOVING_WEIGHTED_AVERAGE":null,"VND",null); }
    private PolicyDtos.Response response(PolicySettings s, Long defaultId, boolean stock) { return new PolicyDtos.Response(s.getBranchId(),s.getVersion(),s.isAllowNegative(),defaultId,stock?"MOVING_WEIGHTED_AVERAGE":null,"VND",s.getUpdatedAt()); }
}
