package com.laundry.management.employee.api;

import com.laundry.management.employee.application.EmployeeIdentityService;
import com.laundry.management.employee.domain.EmployeeIdentityType;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/employees/{employeeId}/identity")
public class EmployeeIdentityController {
    private final EmployeeIdentityService service;
    public EmployeeIdentityController(EmployeeIdentityService service) { this.service = service; }

    @GetMapping
    public EmployeeSensitiveDtos.IdentityResponse get(
        @PathVariable Long employeeId,
        @RequestParam(defaultValue = "CITIZEN_ID") EmployeeIdentityType type,
        @RequestParam(defaultValue = "false") boolean reveal
    ) { return service.get(employeeId, type, reveal); }

    @PutMapping
    public ResponseEntity<Void> upsert(
        @PathVariable Long employeeId,
        @Valid @RequestBody EmployeeSensitiveDtos.IdentityRequest request
    ) { service.upsert(employeeId, request); return ResponseEntity.noContent().build(); }

    @PatchMapping("/verification")
    public ResponseEntity<Void> verify(
        @PathVariable Long employeeId,
        @RequestParam(defaultValue = "CITIZEN_ID") EmployeeIdentityType type,
        @Valid @RequestBody EmployeeSensitiveDtos.IdentityVerificationRequest request
    ) { service.verify(employeeId, type, request); return ResponseEntity.noContent().build(); }
}
