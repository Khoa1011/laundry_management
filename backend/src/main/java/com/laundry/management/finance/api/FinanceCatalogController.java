package com.laundry.management.finance.api;

import com.laundry.management.finance.application.FinanceCatalogService;
import com.laundry.management.operations.api.OperationsDtos.*;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.net.URI;

@RestController
@RequestMapping("/api/finance")
public class FinanceCatalogController {
    private final FinanceCatalogService service;
    public FinanceCatalogController(FinanceCatalogService service) { this.service=service; }

    @GetMapping("/accounts")
    public PageResponse<CashAccountResponse> listCashAccount(@RequestParam(required=false) Long branchId, @RequestParam(defaultValue="0") int page,
        @RequestParam(defaultValue="20") int size, @RequestParam(required=false) String search, @RequestParam(required=false) Boolean active) {
        return service.listCashAccount(branchId, page, size, search, active);
    }
    @GetMapping("/accounts/{id}")
    public CashAccountResponse getCashAccount(@PathVariable Long id, @RequestParam(required=false) Long branchId) { return service.getCashAccount(id, branchId); }
    @PostMapping("/accounts")
    public ResponseEntity<CashAccountResponse> createCashAccount(@Valid @RequestBody CashAccountRequest request) {
        var created=service.saveCashAccount(null, request);
        return ResponseEntity.created(URI.create("/api/finance/accounts/"+created.id())).body(created);
    }
    @PutMapping("/accounts/{id}")
    public CashAccountResponse updateCashAccount(@PathVariable Long id, @Valid @RequestBody CashAccountRequest request) { return service.saveCashAccount(id, request); }

    @GetMapping("/categories")
    public PageResponse<TransactionCategoryResponse> listTransactionCategory(@RequestParam(required=false) Long branchId, @RequestParam(defaultValue="0") int page,
        @RequestParam(defaultValue="20") int size, @RequestParam(required=false) String search, @RequestParam(required=false) Boolean active) {
        return service.listTransactionCategory(branchId, page, size, search, active);
    }
    @GetMapping("/categories/{id}")
    public TransactionCategoryResponse getTransactionCategory(@PathVariable Long id, @RequestParam(required=false) Long branchId) { return service.getTransactionCategory(id, branchId); }
    @PostMapping("/categories")
    public ResponseEntity<TransactionCategoryResponse> createTransactionCategory(@Valid @RequestBody TransactionCategoryRequest request) {
        var created=service.saveTransactionCategory(null, request);
        return ResponseEntity.created(URI.create("/api/finance/categories/"+created.id())).body(created);
    }
    @PutMapping("/categories/{id}")
    public TransactionCategoryResponse updateTransactionCategory(@PathVariable Long id, @Valid @RequestBody TransactionCategoryRequest request) { return service.saveTransactionCategory(id, request); }
}
