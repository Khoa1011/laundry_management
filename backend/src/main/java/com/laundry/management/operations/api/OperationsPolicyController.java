package com.laundry.management.operations.api;

import com.laundry.management.operations.application.OperationsPolicyService;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.*;

@RestController
public class OperationsPolicyController {
    private final OperationsPolicyService service;
    public OperationsPolicyController(OperationsPolicyService service) { this.service=service; }
    @GetMapping("/api/inventory/settings")
    public PolicyDtos.Response inventory(@RequestParam(required=false) Long branchId) { return service.inventory(branchId); }
    @PutMapping("/api/inventory/settings")
    public PolicyDtos.Response inventory(@Valid @RequestBody PolicyDtos.Request request) { return service.saveInventory(request); }
    @GetMapping("/api/finance/settings")
    public PolicyDtos.Response finance(@RequestParam(required=false) Long branchId) { return service.finance(branchId); }
    @PutMapping("/api/finance/settings")
    public PolicyDtos.Response finance(@Valid @RequestBody PolicyDtos.Request request) { return service.saveFinance(request); }
    @GetMapping("/api/inventory/history")
    public OperationsDtos.PageResponse<PolicyDtos.Audit> inventoryHistory(@RequestParam(required=false) Long branchId,
        @RequestParam(defaultValue="0") int page, @RequestParam(defaultValue="20") int size) { return service.inventoryHistory(branchId,page,size); }
    @GetMapping("/api/finance/history")
    public OperationsDtos.PageResponse<PolicyDtos.Audit> financeHistory(@RequestParam(required=false) Long branchId,
        @RequestParam(defaultValue="0") int page, @RequestParam(defaultValue="20") int size) { return service.financeHistory(branchId,page,size); }
}
