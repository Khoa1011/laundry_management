package com.laundry.management.employee.api;

import com.laundry.management.employee.application.EmployeeAuditService;
import com.laundry.management.employee.application.EmployeeCommandService;
import com.laundry.management.employee.application.EmployeeQueryService;
import com.laundry.management.employee.domain.EmployeeAccountState;
import com.laundry.management.employee.domain.EmployeeStatus;
import jakarta.validation.Valid;
import java.net.URI;
import java.util.List;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/employees")
public class EmployeeController {

    private final EmployeeQueryService queryService;
    private final EmployeeCommandService commandService;
    private final EmployeeAuditService auditService;

    public EmployeeController(
        EmployeeQueryService queryService,
        EmployeeCommandService commandService,
        EmployeeAuditService auditService
    ) {
        this.queryService = queryService;
        this.commandService = commandService;
        this.auditService = auditService;
    }

    @GetMapping
    public EmployeeDtos.ListResponse list(
        @RequestParam(defaultValue = "0") int page,
        @RequestParam(defaultValue = "20") int size,
        @RequestParam(required = false) String search,
        @RequestParam(required = false) String keyword,
        @RequestParam(required = false) EmployeeStatus status,
        @RequestParam(required = false) Long positionId,
        @RequestParam(required = false) Long branchId,
        @RequestParam(required = false) Boolean hasLinkedAccount,
        @RequestParam(required = false) EmployeeAccountState accountStatus,
        @RequestParam(required = false) String sort
    ) {
        return queryService.list(
            page, size, search == null ? keyword : search, status, positionId, branchId,
            hasLinkedAccount, accountStatus, sort == null ? List.of() : List.of(sort)
        );
    }

    @GetMapping("/me")
    public EmployeeDtos.SelfProfileResponse me() {
        return queryService.me();
    }

    @GetMapping("/options/branches")
    public List<EmployeeDtos.BranchOptionResponse> branchOptions() {
        return queryService.branchOptions();
    }

    @GetMapping("/account-options")
    public EmployeeDtos.AccountOptionListResponse accountOptions(
        @RequestParam(required = false) Long employeeId,
        @RequestParam(required = false) String search,
        @RequestParam(defaultValue = "0") int page,
        @RequestParam(defaultValue = "20") int size
    ) {
        return queryService.accountOptions(employeeId, search, page, size);
    }

    @GetMapping("/{employeeId}")
    public EmployeeDtos.DetailResponse get(@PathVariable Long employeeId) {
        return queryService.get(employeeId);
    }

    @PostMapping
    public ResponseEntity<EmployeeDtos.DetailResponse> create(
        @Valid @RequestBody EmployeeDtos.CreateRequest request
    ) {
        EmployeeDtos.DetailResponse created = commandService.create(request);
        return ResponseEntity.created(URI.create("/api/employees/" + created.id())).body(created);
    }

    @PutMapping("/{employeeId}")
    public EmployeeDtos.DetailResponse update(
        @PathVariable Long employeeId,
        @Valid @RequestBody EmployeeDtos.UpdateRequest request
    ) {
        return commandService.update(employeeId, request);
    }

    @PatchMapping("/{employeeId}/status")
    public EmployeeDtos.DetailResponse changeStatus(
        @PathVariable Long employeeId,
        @Valid @RequestBody EmployeeDtos.StatusRequest request
    ) {
        return commandService.changeStatus(employeeId, request);
    }

    @PatchMapping("/{employeeId}/position")
    public EmployeeDtos.DetailResponse assignPosition(
        @PathVariable Long employeeId,
        @Valid @RequestBody EmployeeDtos.PositionAssignmentRequest request
    ) {
        return commandService.assignPosition(employeeId, request);
    }

    @PostMapping("/{employeeId}/branches")
    public EmployeeDtos.DetailResponse assignBranch(
        @PathVariable Long employeeId,
        @Valid @RequestBody EmployeeDtos.BranchAssignmentRequest request
    ) {
        return commandService.assignBranch(employeeId, request);
    }

    @PatchMapping("/{employeeId}/branches/{branchId}/primary")
    public EmployeeDtos.DetailResponse makePrimaryBranch(
        @PathVariable Long employeeId,
        @PathVariable Long branchId,
        @Valid @RequestBody EmployeeDtos.VersionRequest request
    ) {
        return commandService.makePrimaryBranch(employeeId, branchId, request);
    }

    @DeleteMapping("/{employeeId}/branches/{branchId}")
    public EmployeeDtos.DetailResponse removeBranch(
        @PathVariable Long employeeId,
        @PathVariable Long branchId,
        @Valid @RequestBody EmployeeDtos.VersionRequest request
    ) {
        return commandService.removeBranch(employeeId, branchId, request);
    }

    @PutMapping("/{employeeId}/account")
    public EmployeeDtos.DetailResponse linkAccount(
        @PathVariable Long employeeId,
        @Valid @RequestBody EmployeeDtos.AccountLinkRequest request
    ) {
        return commandService.linkAccount(employeeId, request);
    }

    @DeleteMapping("/{employeeId}/account")
    public EmployeeDtos.DetailResponse unlinkAccount(
        @PathVariable Long employeeId,
        @Valid @RequestBody EmployeeDtos.VersionRequest request
    ) {
        return commandService.unlinkAccount(employeeId, request);
    }

    @GetMapping("/{employeeId}/branches")
    public List<EmployeeDtos.BranchResponse> branches(
        @PathVariable Long employeeId,
        @RequestParam(defaultValue = "false") boolean includeHistory
    ) {
        return queryService.branches(employeeId, includeHistory);
    }

    @GetMapping({"/{employeeId}/audit", "/{employeeId}/audit-history"})
    public EmployeeDtos.AuditListResponse audit(
        @PathVariable Long employeeId,
        @RequestParam(defaultValue = "0") int page,
        @RequestParam(defaultValue = "20") int size
    ) {
        return auditService.list(employeeId, page, size);
    }
}
