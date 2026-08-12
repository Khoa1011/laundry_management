package com.laundry.management.employee.api;

import com.laundry.management.employee.application.EmployeeCompensationService;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/employees/{employeeId}/compensation")
public class EmployeeCompensationController {
    private final EmployeeCompensationService service;
    public EmployeeCompensationController(EmployeeCompensationService service) { this.service = service; }

    @GetMapping
    public EmployeeSensitiveDtos.CompensationCurrentResponse current(@PathVariable Long employeeId) {
        return service.current(employeeId);
    }

    @GetMapping("/history")
    public EmployeeSensitiveDtos.CompensationHistoryResponse history(
        @PathVariable Long employeeId,
        @RequestParam(defaultValue = "0") int page,
        @RequestParam(defaultValue = "20") int size
    ) { return service.history(employeeId, page, size); }

    @PostMapping
    public EmployeeSensitiveDtos.CompensationResponse update(
        @PathVariable Long employeeId,
        @Valid @RequestBody EmployeeSensitiveDtos.CompensationRequest request
    ) { return service.update(employeeId, request); }
}
