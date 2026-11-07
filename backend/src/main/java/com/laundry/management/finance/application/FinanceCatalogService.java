package com.laundry.management.finance.application;

import com.laundry.management.finance.domain.*;
import com.laundry.management.finance.infrastructure.*;
import com.laundry.management.operations.api.OperationsDtos.*;
import com.laundry.management.operations.application.*;
import com.laundry.management.auth.security.permission.PermissionCodes;
import com.laundry.management.common.exception.*;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.util.*;
import jakarta.validation.Valid;
import org.springframework.validation.annotation.Validated;

@Service
@Validated
public class FinanceCatalogService {
    private final CatalogPersistence data;
    private final OperationsAccess access;
    private final CashAccountRepository cashAccount;
    private final TransactionCategoryRepository transactionCategory;
    private final FinanceSettingsRepository settings;
    public FinanceCatalogService(CatalogPersistence data, OperationsAccess access, CashAccountRepository cashAccount, TransactionCategoryRepository transactionCategory, FinanceSettingsRepository settings) {
        this.data=data; this.access=access;
        this.cashAccount=cashAccount;
        this.transactionCategory=transactionCategory;
        this.settings=settings;
    }
    @PreAuthorize("@permissionChecker.has(authentication, T(com.laundry.management.auth.security.permission.PermissionCodes).FINANCE_ACCOUNT_READ)")
    @Transactional(readOnly=true)
    public PageResponse<CashAccountResponse> listCashAccount(Long branchId, int page, int size, String search, Boolean active) {
        var result=data.list(cashAccount, branchId, page, size, search, active);
        return data.response(result, result.getContent().stream().map(this::mapCashAccount).toList());
    }
    @PreAuthorize("@permissionChecker.has(authentication, T(com.laundry.management.auth.security.permission.PermissionCodes).FINANCE_ACCOUNT_READ)")
    @Transactional(readOnly=true)
    public CashAccountResponse getCashAccount(Long id, Long branchId) { return mapCashAccount(data.get(cashAccount, id, branchId)); }
    @PreAuthorize("@permissionChecker.has(authentication, T(com.laundry.management.auth.security.permission.PermissionCodes).FINANCE_ACCOUNT_MANAGE)")
    @Transactional
    public CashAccountResponse saveCashAccount(Long id, @Valid CashAccountRequest request) {
        Long branch=access.branch(request.branchId());
        data.lockBranch(branch);
        if(id!=null && !request.active() && settings.findCurrentForUpdate(branch).filter(s -> id.equals(s.getDefaultAccountId())).isPresent())
            throw new OperationsValidationException("active","defaultInUse");
        CashAccount record;
        if(id==null) { record=new CashAccount(); data.initialize(record, branch, "CashAccount", "QUY"); }
        else { record=data.get(cashAccount, id, branch); OperationsAccess.version(record.getVersion(), request.version()); }
        data.update(record, request.name(), request.active(), request.note());
        record.setAccountType(request.accountType());
        cashAccount.saveAndFlush(record);
        data.audit(branch, "finance", "accounts", record.getId(), id==null?"CREATED":"UPDATED", "name,active,note,accountType");
        return mapCashAccount(record);
    }
    private CashAccountResponse mapCashAccount(CashAccount record) { return new CashAccountResponse(record.getId(), record.getBranchId(), record.getCode(), record.getName(), record.isActive(), record.getNote(), record.getVersion(), record.getCreatedAt(), record.getUpdatedAt(), record.getAccountType()); }
    @PreAuthorize("@permissionChecker.has(authentication, T(com.laundry.management.auth.security.permission.PermissionCodes).FINANCE_CATEGORY_READ)")
    @Transactional(readOnly=true)
    public PageResponse<TransactionCategoryResponse> listTransactionCategory(Long branchId, int page, int size, String search, Boolean active) {
        var result=data.list(transactionCategory, branchId, page, size, search, active);
        return data.response(result, result.getContent().stream().map(this::mapTransactionCategory).toList());
    }
    @PreAuthorize("@permissionChecker.has(authentication, T(com.laundry.management.auth.security.permission.PermissionCodes).FINANCE_CATEGORY_READ)")
    @Transactional(readOnly=true)
    public TransactionCategoryResponse getTransactionCategory(Long id, Long branchId) { return mapTransactionCategory(data.get(transactionCategory, id, branchId)); }
    @PreAuthorize("@permissionChecker.has(authentication, T(com.laundry.management.auth.security.permission.PermissionCodes).FINANCE_CATEGORY_MANAGE)")
    @Transactional
    public TransactionCategoryResponse saveTransactionCategory(Long id, @Valid TransactionCategoryRequest request) {
        Long branch=access.branch(request.branchId());
        TransactionCategory record;
        if(id==null) { record=new TransactionCategory(); data.initialize(record, branch, "TransactionCategory", "TC"); }
        else { record=data.get(transactionCategory, id, branch); OperationsAccess.version(record.getVersion(), request.version()); }
        if(id!=null && !record.getDirection().equals(request.direction())) throw new OperationsValidationException("direction","immutable");
        data.update(record, request.name(), request.active(), request.note());
        record.setDirection(request.direction());
        transactionCategory.saveAndFlush(record);
        data.audit(branch, "finance", "categories", record.getId(), id==null?"CREATED":"UPDATED", "name,active,note,direction");
        return mapTransactionCategory(record);
    }
    private TransactionCategoryResponse mapTransactionCategory(TransactionCategory record) { return new TransactionCategoryResponse(record.getId(), record.getBranchId(), record.getCode(), record.getName(), record.isActive(), record.getNote(), record.getVersion(), record.getCreatedAt(), record.getUpdatedAt(), record.getDirection()); }
}
